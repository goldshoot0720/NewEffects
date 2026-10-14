#!/usr/bin/env node
// 單張立繪去背切圖：參考圖是「一張一位角色」的 T-pose 立繪（lucky1..lucky8.png）。
// 白底圖沿用 cutout.mjs 的邊緣背景填充；複雜背景（兩隻貓）先用 tools/matte-vision.py 產生
// assets/ref/luckyN-matte.png，再用它的灰階值當 alpha。
// 用法：node tools/cutout-solo.mjs  → 輸出 assets/ref/cast/lucky-*.png 並併入 cast.json
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(ROOT, 'assets/ref'), OUT = path.join(REF, 'cast');
fs.mkdirSync(OUT, {recursive: true});

const GROUP = 'lucky';
const SHEETS = [
  {file: 'lucky1.png', bg: 'white'},
  {file: 'lucky2.png', bg: 'white'},
  {file: 'lucky3.png', bg: 'white'},
  {file: 'lucky4.png', bg: 'white'},
  {file: 'lucky5.png', bg: 'matte', matte: 'lucky5-matte.png'},
  {file: 'lucky6.png', bg: 'matte', matte: 'lucky6-matte.png'},
  {file: 'lucky7.png', bg: 'white'},
  {file: 'lucky8.png', bg: 'white'}
];

function probe(file){
  return execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',').map(Number);
}
function load(file){
  const [w, h] = probe(file);
  const rgba = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {maxBuffer: 1 << 30});
  const rgb = Buffer.alloc(w*h*3), alpha = new Uint8Array(w*h);
  for(let i = 0; i < w*h; i++){ rgb[i*3] = rgba[i*4]; rgb[i*3+1] = rgba[i*4+1]; rgb[i*3+2] = rgba[i*4+2]; alpha[i] = rgba[i*4+3]; }
  return {w, h, rgb, alpha};
}
function savePng(file, w, h, rgba){
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-compression_level', '9', file], {input: rgba});
}
const d2 = (r, g, b, c) => (r - c[0])**2 + (g - c[1])**2 + (b - c[2])**2;

function cut(sheet){
  const {w, h, rgb, alpha: srcAlpha} = load(path.join(REF, sheet.file));
  const T = 34;
  let bg;                                            // 1 = 背景
  let bgDist = () => 255;
  if(sheet.bg === 'matte'){
    const m = load(path.join(REF, sheet.matte));
    if(m.w !== w || m.h !== h) throw new Error(`${sheet.matte}: 尺寸與原圖不符`);
    // Vision 遮罩是灰階：>128 為前景，邊緣留一點漸層
    bg = new Uint8Array(w*h);
    for(let i = 0; i < w*h; i++) bg[i] = m.rgb[i*3] < 8 ? 1 : 0;
    bgDist = i => m.rgb[i*3];
  } else {
    const palette = [[254, 254, 254]];
    bgDist = i => {
      const r = rgb[i*3], g = rgb[i*3+1], b = rgb[i*3+2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mn > 196 && mx - mn < 14 ? 0 : Math.sqrt(d2(r, g, b, palette[0]));
    };
    // 從四邊往內填充背景，遇到線稿就停。
    // 白鞋和白底是同一種顏色，洪水會沿著鞋面灌進去，鞋子整雙消失。
    // lucky-1（企鵝鞋）、lucky-2、lucky-3（白球鞋）已另補回切圖，直接重跑這支會再切掉。
    bg = new Uint8Array(w*h);
    const q = new Int32Array(w*h);
    let qh = 0, qt = 0;
    const seed = i => { if(!bg[i] && bgDist(i) < T){ bg[i] = 1; q[qt++] = i; } };
    for(let x = 0; x < w; x++){ for(let y = 0; y < 8; y++) seed(y*w + x); seed((h - 1)*w + x); }
    for(let y = 0; y < h; y++){ seed(y*w); seed(y*w + w - 1); }
    while(qh < qt){
      const i = q[qh++], x = i % w, y = (i - x)/w;
      if(x > 0) seed(i - 1); if(x < w - 1) seed(i + 1); if(y > 0) seed(i - w); if(y < h - 1) seed(i + w);
    }
  }
  // 邊界外的殘留（例如白底圖中封閉的淺色塊）不處理，單張立繪只取最大連通區塊
  const label = new Int32Array(w*h).fill(-1);
  const q = new Int32Array(w*h);
  let best = {n: 0, k: -1, x0: w, x1: 0, y0: h, y1: 0}, k = 0;
  for(let s = 0; s < w*h; s++){
    if(bg[s] || label[s] >= 0) continue;
    let qh = 0, qt = 0, n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    q[qt++] = s; label[s] = k;
    while(qh < qt){
      const i = q[qh++], x = i % w, y = (i - x)/w;
      n++; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
      for(const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if(j >= 0 && !bg[j] && label[j] < 0){ label[j] = k; q[qt++] = j; }
    }
    if(n > best.n) best = {n, k, x0, x1, y0, y1};
    k++;
  }
  if(best.n < 4000) throw new Error(`${sheet.file}: 找不到角色前景（只切到 ${best.n} px）`);
  const c = best, pad = 6;
  const x0 = Math.max(0, c.x0 - pad), x1 = Math.min(w - 1, c.x1 + pad), y0 = Math.max(0, c.y0 - pad), y1 = Math.min(h - 1, c.y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = Buffer.alloc(cw*ch*4);
  let topSum = 0, topN = 0;
  for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
    const i = y*w + x, o = ((y - y0)*cw + (x - x0))*4, l = label[i];
    let a = 0;
    if(l === c.k){
      if(sheet.bg === 'matte') a = bgDist(i);
      else {
        // 邊緣反鋸齒：貼著背景的像素依與背景色的距離給半透明
        const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
        a = edge ? Math.max(0, Math.min(255, Math.round((bgDist(i) - T*.5)/(T*1.6)*255))) : 255;
      }
    }
    // 邊緣兩像素內去掉背景色溢色（白底圖用白色、遮罩圖用附近的內部像素色）
    if(a > 0 && a < 255){
      const near = [-2, -1, 1, 2].some(d => (x + d >= 0 && x + d < w && bg[i + d]) || (y + d >= 0 && y + d < h && bg[i + d*w]));
      if(near){
        if(sheet.bg === 'matte'){
          let r = 0, gg = 0, b = 0, nn = 0;
          for(let dy = -3; dy <= 3; dy++) for(let dx = -3; dx <= 3; dx++){
            const xx = x + dx, yy = y + dy; if(xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
            const j = yy*w + xx; if(label[j] !== c.k || bgDist(j) < 250) continue;
            r += rgb[j*3]; gg += rgb[j*3+1]; b += rgb[j*3+2]; nn++;
          }
          if(nn){ const al = Math.max(.35, a/255); rgb[i*3] = Math.round(lerp(rgb[i*3], r/nn, 1 - al)); rgb[i*3+1] = Math.round(lerp(rgb[i*3+1], gg/nn, 1 - al)); rgb[i*3+2] = Math.round(lerp(rgb[i*3+2], b/nn, 1 - al)); }
        } else {
          const al = Math.max(.35, Math.min(1, a/255*.85));
          for(let ch3 = 0; ch3 < 3; ch3++) rgb[i*3 + ch3] = Math.max(0, Math.min(255, Math.round((rgb[i*3 + ch3] - (1 - al)*254)/al)));
        }
      }
    }
    if(a && y - c.y0 < (c.y1 - c.y0)*.12){ topSum += x - x0; topN++; }
    out[o] = rgb[i*3]; out[o + 1] = rgb[i*3 + 1]; out[o + 2] = rgb[i*3 + 2]; out[o + 3] = a;
  }
  return {cw, ch, out, x0, y0, c, headX: Math.round(topSum/Math.max(1, topN)), headY: Math.round((c.y1 - c.y0)*.09) + (c.y0 - y0), src: sheet.file};
}
const lerp = (a, b, u) => a + (b - a)*u;

const manifest = fs.existsSync(path.join(OUT, 'cast.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'cast.json'), 'utf8')) : {};
manifest[GROUP] = SHEETS.map((s, i) => {
  const r = cut(s);
  const file = `${GROUP}-${i}.png`;
  savePng(path.join(OUT, file), r.cw, r.ch, r.out);
  console.log(`${s.file}: ${r.cw}x${r.ch} head(${r.headX},${r.headY})`);
  return {file, w: r.cw, h: r.ch, headX: r.headX, headY: r.headY, source: [r.x0, r.y0], sheet: s.file};
});
fs.writeFileSync(path.join(OUT, 'cast.json'), JSON.stringify(manifest, null, 1));
console.log(`cast.json 已更新（${GROUP} ${manifest[GROUP].length} 位）`);
