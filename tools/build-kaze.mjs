#!/usr/bin/env node
// 「風の中は走るっきゃないっ！」（三月のパンタシア／TVアニメ『生徒会にも穴はある！』OP）
// 的六人跑步造型：把官方網站的 OP 角色立繪（每張已單獨去背）裁成共用切圖，
// 寫入 cast/kaze-0..5.png、更新 cast.json，並拼出群像圖 assets/ref/kaze/group.png。
// 用法：node tools/build-kaze.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(ROOT, 'assets/ref/kaze'), CAST = path.join(ROOT, 'assets/ref/cast');
const MAX_H = 900, PAD = 8;
// 索引對齊 anaru 群組的順序（梅／寿子／こころ／たん／有栖／敏深），
// 官方 OP 立繪檔名則是網站上的 op_chara_1..6。
const MEMBERS = [
  {op: 3, name: '水之江梅'},
  {op: 1, name: '古都吹寿子'},
  {op: 5, name: '陸奥こまろ'},
  {op: 6, name: '尾鳥たん'},
  {op: 4, name: '照井有栖'},
  {op: 2, name: '平塚敏深'},
];

const load = file => {
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',').map(Number);
  const rgba = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {maxBuffer: 1 << 30});
  return {w, h, rgba};
};
const savePng = (file, w, h, rgba) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-compression_level', '9', file], {input: rgba});

const entries = [];
for(let i = 0; i < MEMBERS.length; i++){
  const {op, name} = MEMBERS[i];
  const input = path.join(REF, `op-chara-${op}.png`);
  if(!fs.existsSync(input)) throw new Error('缺少 ' + input);
  const {w, h, rgba} = load(input);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, clear = 0;
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    if(rgba[(y*w + x)*4 + 3] < 8){ clear++; continue; }
    if(x < x0) x0 = x; if(x > x1) x1 = x;
    if(y < y0) y0 = y; if(y > y1) y1 = y;
  }
  if(clear < w*h*.5 || x1 <= x0 || y1 <= y0) throw new Error(`op-chara-${op}.png 沒有 alpha 或人物`);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const outH = Math.min(ch, MAX_H), outW = Math.max(1, Math.round(cw*outH/ch));
  // 頭頂往下 14% 內的不透明像素平均位置當作頭部中心
  let sx = 0, n = 0;
  for(let y = y0; y < y0 + ch*.14; y++) for(let x = x0; x <= x1; x++) if(rgba[(y*w + x)*4 + 3] > 128){ sx += x - x0; n++; }
  const headX = Math.round((sx/Math.max(1, n))*outW/cw) + PAD;
  const file = `kaze-${i}.png`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input,
    '-vf', `crop=${cw}:${ch}:${x0}:${y0},scale=${outW}:${outH}:flags=lanczos,pad=${outW+16}:${outH+16}:8:8:color=black@0`,
    '-frames:v', '1', '-pix_fmt', 'rgba', path.join(CAST, file)]);
  // 六張都是「跑」的姿勢畫，拆出手腳會把伸出的手臂與腿切開，因此整張畫不拆層。
  entries.push({file, w: outW + 16, h: outH + 16, headX, headY: Math.round(outH*.10) + PAD,
    source: [x0, y0], sheet: `kaze/op-chara-${op}.png`, name, intact: true});
}

const manifestPath = path.join(CAST, 'cast.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.kaze = entries;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');

// 群像主視覺：六人 3×2 排列，底色沿用單曲封面的青藍到粉紅。
// 跑步造型的張開幅度差很多（壽子的長髮最寬），因此用等高而不是等寬來縮放，
// 否則髮型寬的人會被欄寬壓得比其他人大一截。
const W = 1920, H = 1080, COLS = 3, ROWS = 2;
const CELL_W = W/COLS, CELL_H = H/ROWS, FIG = CELL_H - 70, BASELINE = H/ROWS - 30;
const canvas = Buffer.alloc(W*H*4);
for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
  const v = y/H, o = (y*W + x)*4;
  const dx = (x - W/2)/(W/2), dy = (y - H*.42)/(H/2), d = Math.min(1, Math.hypot(dx, dy));
  const glow = Math.pow(1 - d, 2.4);
  canvas[o]     = Math.round(38*(1 - v) + 236*v + 40*glow);
  canvas[o + 1] = Math.round(178*(1 - v) + 150*v + 40*glow);
  canvas[o + 2] = Math.round(206*(1 - v) + 184*v + 40*glow);
  canvas[o + 3] = 255;
}
const faces = [];
entries.forEach((meta, i) => {
  const {w: iw, h: ih, rgba} = load(path.join(CAST, meta.file));
  const k = FIG/ih, dw = Math.round(iw*k), dh = Math.round(ih*k);
  const left = Math.round(i%COLS*CELL_W + (CELL_W - dw)/2), top = Math.round(Math.floor(i/COLS)*CELL_H + BASELINE - dh);
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
  faces.push([Math.round(left + meta.headX*k), Math.round(top + meta.headY*k + dh*.05)]);
});
const groupOut = path.join(REF, 'group.png');
savePng(groupOut, W, H, canvas);
console.log('kaze：六張切圖與 cast.json 已更新');
for(const e of entries) console.log(`  ${e.file} ${e.w}x${e.h} head(${e.headX},${e.headY}) ${e.name}`);
console.log(`已輸出 ${path.relative(ROOT, groupOut)}`);
console.log('faces: [' + faces.map(f => `[${f[0]}, ${f[1]}]`).join(', ') + ']');
