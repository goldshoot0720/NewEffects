#!/usr/bin/env node
// 由去背切圖拼出「幸運八人」的群像主視覺（assets/ref/lucky8.png，1920×1080）。
// pv.js 的 ARTS.lucky8 用它做 Ken Burns 運鏡；臉部座標由切圖的 headX/headY 換算後印出。
// 用法：node tools/build-group.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAST = path.join(ROOT, 'assets/ref/cast');
const OUT = path.join(ROOT, 'assets/ref/lucky8.png');
const W = 1920, H = 1080, COLS = 4, ROWS = 2;
const CELL_W = W/COLS, CELL_H = H/ROWS, FIG = CELL_H - 40, PAD = 8;

function load(file){
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',').map(Number);
  const rgba = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {maxBuffer: 1 << 30});
  return {w, h, rgba};
}
function savePng(file, w, h, rgba){
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-compression_level', '9', file], {input: rgba});
}

const cast = JSON.parse(fs.readFileSync(path.join(CAST, 'cast.json'), 'utf8'));
const list = cast.lucky;
if(!list || list.length !== 8) throw new Error('cast.json 的 lucky 不是 8 位，請先執行 node tools/cutout-solo.mjs');

const canvas = Buffer.alloc(W*H*4);
// 暖色調漸層底：招財紅到金，中央一顆柔光
for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
  const v = y/H, o = (y*W + x)*4;
  const dx = (x - W/2)/(W/2), dy = (y - H*.42)/(H/2), d = Math.min(1, Math.hypot(dx, dy));
  const glow = Math.pow(1 - d, 2.2);
  canvas[o]     = Math.round(120*(1 - v) + 58*v + 120*glow);
  canvas[o + 1] = Math.round(16*(1 - v) + 12*v + 74*glow);
  canvas[o + 2] = Math.round(38*(1 - v) + 26*v + 24*glow);
  canvas[o + 3] = 255;
}
// 角落壓暗
for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
  const o = (y*W + x)*4, dx = (x - W/2)/(W/2), dy = (y - H/2)/(H/2);
  const k = 1 - .45*Math.min(1, Math.hypot(dx, dy))**3;
  for(let c = 0; c < 3; c++) canvas[o + c] = Math.round(canvas[o + c]*k);
}

const faces = [];
list.forEach((meta, i) => {
  const {w: iw, h: ih, rgba} = load(path.join(CAST, meta.file));
  const k = FIG/ih, dw = Math.round(iw*k), dh = FIG;
  const cx = (i % COLS)*CELL_W, cy = Math.floor(i/COLS)*CELL_H;
  const left = Math.round(cx + (CELL_W - dw)/2), top = Math.round(cy + CELL_H - PAD - dh);
  for(let y = 0; y < dh; y++) for(let x = 0; x < dw; x++){
    const sx = Math.min(iw - 1, Math.floor(x/k)), sy = Math.min(ih - 1, Math.floor(y/k));
    const so = (sy*iw + sx)*4, a = rgba[so + 3]/255;
    if(!a) continue;
    const tx = left + x, ty = top + y;
    if(tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
    const to = (ty*W + tx)*4;
    for(let c = 0; c < 3; c++) canvas[to + c] = Math.round(rgba[so + c]*a + canvas[to + c]*(1 - a));
    canvas[to + 3] = 255;
  }
  // headY 是頭頂往下 9% 的髮際線，鏡頭對臉再往下移一點
  faces.push([Math.round(left + meta.headX*k), Math.round(top + meta.headY*k + dh*.05)]);
});
savePng(OUT, W, H, canvas);
console.log(`已輸出 ${path.relative(ROOT, OUT)}`);
console.log('faces: [' + faces.map(f => `[${f[0]}, ${f[1]}]`).join(', ') + ']');
