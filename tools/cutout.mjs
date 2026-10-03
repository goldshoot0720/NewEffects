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
  {file: 'lineup12.webp', name: 'casual', bg: 'stripes', cutY: 815, count: 12,
   splits: [166, 315, 450, 617, 740, 892, 1046, 1182, 1355, 1459, 1626],
   // 橘色帽T、粉色開襟衫跟背後色條同色，這兩欄不挖封閉洞
   keepHoles: [[617, 740], [1355, 1459]]}
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
  const T = sheet.bg === 'white' ? 34 : 24;
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
    // 腳邊地板的陰影：與色條同色相、只是比較暗
    if(i >= w*Math.floor(h*.93)){
      const c = palette[x], k = (r*c[0] + g*c[1] + b*c[2])/(c[0]**2 + c[1]**2 + c[2]**2);
      if(k > .45 && k < 1.08) best = Math.min(best, d2(r, g, b, c.map(v => v*k))*2.2);
    }
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
    if((sheet.keepHoles || []).some(([a, b]) => s % w >= a && s % w < b)) continue;
    qh = 0; qt = 0; q[qt++] = s; seen[s] = 1;
    while(qh < qt){
      const i = q[qh++], x = i % w, y = (i - x)/w;
      for(const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if(j >= 0 && !bg[j] && !seen[j] && close(j)){ seen[j] = 1; q[qt++] = j; }
    }
    if(qt > 150) for(let k = 0; k < qt; k++) bg[q[k]] = 1;
  }
  // 分配給角色：從每位角色身體中段（兩條分割線中間）同時往外擴，前景像素歸給沿著身體最先走到的那位
  const cuts = [0, ...(sheet.splits || []), w];
  const label = new Int32Array(w*h).fill(-1);
  qh = 0; qt = 0;
  for(let k = 0; k < sheet.count; k++){
    const cx = Math.round((cuts[k] + cuts[k + 1])/2);
    for(let y = Math.round(h*.2); y < h*.985; y++) for(let x = cx - 10; x <= cx + 10; x++){
      const i = y*w + x; if(!bg[i] && label[i] < 0){ label[i] = k; q[qt++] = i; }
    }
  }
  // 第一輪只在自己那一欄內擴張，第二輪才允許越線（伸出去的手、頭髮）
  const cellOf = new Int32Array(w); for(let k = 0; k < sheet.count; k++) for(let x = cuts[k]; x < cuts[k + 1]; x++) cellOf[x] = k;
  for(const cross of [false, true]){
    if(cross){ qt = 0; for(let i = 0; i < w*h; i++) if(label[i] >= 0) q[qt++] = i; }
    qh = 0;
    while(qh < qt){
      const i = q[qh++], x = i % w, y = (i - x)/w, k = label[i];
      for(const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if(j >= 0 && !bg[j] && label[j] < 0 && (cross || cellOf[j % w] === k)){ label[j] = k; q[qt++] = j; }
    }
  }
  const chars = [];
  for(let k = 0; k < sheet.count; k++) chars.push({n: 0, x0: w, x1: 0, y0: h, y1: 0});
  for(let i = 0; i < w*h; i++){
    const k = label[i]; if(k < 0) continue;
    const c = chars[k], x = i % w, y = (i - x)/w;
    c.n++; if(x < c.x0) c.x0 = x; if(x > c.x1) c.x1 = x; if(y < c.y0) c.y0 = y; if(y > c.y1) c.y1 = y;
  }
  if(chars.some(c => c.n < 4000)) throw new Error(`${sheet.file}: 有角色沒切到`);
  const owner = Array.from({length: sheet.count}, (_, k) => k);
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
      // 邊緣兩像素內去掉背景色溢色：c = (p - (1 - α)·bg) / α
      const near = a > 0 && [-2, -1, 1, 2].some(d => (x + d >= 0 && x + d < w && bg[i + d]) || (y + d >= 0 && y + d < h && bg[i + d*w]));
      if(near){
        const bgc = palette[sheet.bg === 'white' ? 0 : x], al = Math.max(.35, Math.min(1, a/255*.85));
        for(let ch3 = 0; ch3 < 3; ch3++) rgb[i*3 + ch3] = Math.max(0, Math.min(255, Math.round((rgb[i*3 + ch3] - (1 - al)*bgc[ch3])/al)));
      }
      if(a && y - c.y0 < (c.y1 - c.y0)*.12){ topSum += x - x0; topN++; }
      out[o] = rgb[i*3]; out[o + 1] = rgb[i*3 + 1]; out[o + 2] = rgb[i*3 + 2]; out[o + 3] = a;
    }
    // 鄰居越過分割線的殘片：從邊緣往內找第一條幾乎全空的欄，邊緣那一側整段清掉
    const colN = new Int32Array(cw);
    for(let y = 0; y < ch; y++) for(let x = 0; x < cw; x++) if(out[(y*cw + x)*4 + 3] > 40) colN[x]++;
    const trim = (from, dir) => {
      for(let d = 0; d < 40; d++){
        const x = from + dir*d;
        if(x < 0 || x >= cw) return;
        if(colN[x] <= 2){ for(let e = 0; e <= d; e++){ const xx = from + dir*e; for(let y = 0; y < ch; y++) out[(y*cw + xx)*4 + 3] = 0; } return; }
      }
    };
    trim(pad, 1); trim(cw - 1 - pad, -1);
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
