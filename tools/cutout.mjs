#!/usr/bin/env node
// 角色去背切圖：從參考圖的邊緣做背景填充（遇到線稿就停），再依連通區塊切出每位角色。
// 用法：node tools/cutout.mjs   → 讀 assets/ref/*.webp，輸出 assets/ref/cast/*.png 與 cast.json
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(ROOT, 'assets/ref'), OUT = path.join(REF, 'cast');
fs.mkdirSync(OUT, {recursive: true});

// 每張圖：背景類型、裁掉腳下倒影的高度、角色數，以及（必要時）角色之間的分割線 x 座標
const SHEETS = [
  {file: 'rise5.webp', name: 'idol', bg: 'white', count: 5, splits: [296, 614, 878, 1146]},
  {file: 'lineup12.webp', name: 'casual', bg: 'stripes', cutY: 822, count: 12,
   splits: [166, 315, 450, 617, 740, 892, 1046, 1182, 1355, 1459, 1626]}
];

function load(file){
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',').map(Number);
  const rgb = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer: 1 << 30});
  return {w, h, rgb};
}
function savePng(file, w, h, rgba){
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-compression_level', '9', file], {input: rgba});
}
const d2 = (r, g, b, c) => (r - c[0])**2 + (g - c[1])**2 + (b - c[2])**2;

function cut(sheet){
  const {w, h: fullH, rgb} = load(path.join(REF, sheet.file));
  const h = Math.min(fullH, sheet.cutY || fullH);
  // 背景色：白底取白／淺灰；色條底取最上排的色條顏色
  let palette = [[254, 254, 254]];
  if(sheet.bg === 'stripes'){
    palette = [];
    for(let x = 0; x < w; x++) palette.push([rgb[x*3 + 3*w*4], rgb[x*3 + 1 + 3*w*4], rgb[x*3 + 2 + 3*w*4]]);
  }
  const T = sheet.bg === 'white' ? 34 : 46;
  const bgDist = i => {
    const r = rgb[i*3], g = rgb[i*3 + 1], b = rgb[i*3 + 2];
    if(sheet.bg === 'white'){
      // 白底加上腳下的淺灰陰影
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mn > 196 && mx - mn < 14 ? 0 : Math.sqrt(d2(r, g, b, palette[0]));
    }
    // 色條底：只跟這一欄自己的色條比，避免衣服顏色剛好像別的色條而被吃掉
    const x = i % w; let best = 1e9;
    for(let k = Math.max(0, x - 2); k <= Math.min(w - 1, x + 2); k++) best = Math.min(best, d2(r, g, b, palette[k]));
    return Math.sqrt(best);
  };
  // 從四邊做背景填充；色條圖在分割線上也當作牆，避免越過鄰居
  const bg = new Uint8Array(w*h), q = new Int32Array(w*h);
  let qh = 0, qt = 0;
  const seed = i => { if(!bg[i] && bgDist(i) < T){ bg[i] = 1; q[qt++] = i; } };
  for(let x = 0; x < w; x++){ for(let y = 0; y < 12; y++) seed(y*w + x); seed((h - 1)*w + x); }
  for(let y = 0; y < h; y++){ seed(y*w); seed(y*w + w - 1); }
  while(qh < qt){
    const i = q[qh++], x = i % w, y = (i - x)/w;
    if(x > 0) seed(i - 1); if(x < w - 1) seed(i + 1); if(y > 0) seed(i - w); if(y < h - 1) seed(i + w);
  }
  // 被頭髮、手臂圍住的背景洞：顏色幾乎等於背景、且面積夠大的封閉區塊也挖掉
  // 白底的衣服也是白色，只對色條底做（色條是完全平塗，容差收緊）
  const close = i => bgDist(i) < 10;
  const seen = new Uint8Array(w*h);
  for(let s = 0; s < w*h && sheet.bg !== 'white'; s++){
    if(bg[s] || seen[s] || !close(s)) continue;
    qh = 0; qt = 0; q[qt++] = s; seen[s] = 1;
    while(qh < qt){
      const i = q[qh++], x = i % w, y = (i - x)/w;
      for(const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if(j >= 0 && !bg[j] && !seen[j] && close(j)){ seen[j] = 1; q[qt++] = j; }
    }
    if(qt > 150) for(let k = 0; k < qt; k++) bg[q[k]] = 1;
  }
  // 前景連通區塊
  const label = new Int32Array(w*h).fill(-1), comps = [];
  const wall = new Uint8Array(w); for(const s of sheet.splits || []) wall[s] = 1;
  for(let s = 0; s < w*h; s++){
    if(bg[s] || label[s] >= 0) continue;
    const id = comps.length, c = {id, n: 0, x0: w, x1: 0, y0: h, y1: 0, sx: 0};
    label[s] = id; qh = 0; qt = 0; q[qt++] = s;
    while(qh < qt){
      const i = q[qh++], x = i % w, y = (i - x)/w;
      if(wall[x] || wall[x + 1] || x === 0 || x === w - 1) c.edge = true;
      c.n++; c.sx += x; if(x < c.x0) c.x0 = x; if(x > c.x1) c.x1 = x; if(y < c.y0) c.y0 = y; if(y > c.y1) c.y1 = y;
      const nb = [];
      if(x > 0 && !wall[x]) nb.push(i - 1); if(x < w - 1 && !wall[x + 1]) nb.push(i + 1);
      if(y > 0) nb.push(i - w); if(y < h - 1) nb.push(i + w);
      for(const j of nb) if(!bg[j] && label[j] < 0){ label[j] = id; q[qt++] = j; }
    }
    comps.push(c);
  }
  const chars = comps.filter(c => c.n > 4000).sort((a, b) => b.n - a.n).slice(0, sheet.count).sort((a, b) => a.sx/a.n - b.sx/b.n);
  if(chars.length < sheet.count) throw new Error(`${sheet.file}: 只找到 ${chars.length} 位角色`);
  // 小碎片（髮絲、手指間隙）歸給包住它的角色
  const owner = new Int32Array(comps.length).fill(-1);
  chars.forEach((c, k) => owner[c.id] = k);
  for(const c of comps){
    if(owner[c.id] >= 0 || c.n > 4000 || c.edge) continue;  // 貼著分割線的是鄰居的碎片
    const cx = c.sx/c.n, k = chars.findIndex(m => cx > m.x0 && cx < m.x1 && c.y0 >= m.y0 && c.y1 <= m.y1);
    if(k >= 0) owner[c.id] = k;
  }
  return chars.map((c, k) => {
    const pad = 6, x0 = Math.max(0, c.x0 - pad), x1 = Math.min(w - 1, c.x1 + pad), y0 = Math.max(0, c.y0 - pad), y1 = Math.min(h - 1, c.y1);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = Buffer.alloc(cw*ch*4);
    let topSum = 0, topN = 0;
    for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
      const i = y*w + x, o = ((y - y0)*cw + (x - x0))*4, l = label[i];
      let a = 0;
      if(l >= 0 && owner[l] === k){
        a = 255;
        // 邊緣反鋸齒：貼著背景的像素依與背景色的距離給半透明，並去掉背景色的溢色
        const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
        if(edge) a = Math.max(0, Math.min(255, Math.round((bgDist(i) - T*.5)/(T*1.6)*255)));
      }
      if(a && y - c.y0 < (c.y1 - c.y0)*.12){ topSum += x - x0; topN++; }
      out[o] = rgb[i*3]; out[o + 1] = rgb[i*3 + 1]; out[o + 2] = rgb[i*3 + 2]; out[o + 3] = a;
    }
    const file = `${sheet.name}-${k}.png`;
    savePng(path.join(OUT, file), cw, ch, out);
    return {file, w: cw, h: ch, headX: Math.round(topSum/Math.max(1, topN)), headY: Math.round((c.y1 - c.y0)*.09) + (c.y0 - y0), source: [x0, y0]};
  });
}

const manifest = {};
for(const s of SHEETS){
  manifest[s.name] = cut(s);
  console.log(`${s.file}: ${manifest[s.name].map(c => `${c.w}x${c.h}`).join(' ')}`);
}
fs.writeFileSync(path.join(OUT, 'cast.json'), JSON.stringify(manifest, null, 1));
