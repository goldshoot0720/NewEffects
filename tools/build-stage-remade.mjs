#!/usr/bin/env node
// 舞台九人重製：從 imagegen 重建的透明立繪產生 cast/stage-0.png～stage-8.png，
// 並更新 cast.json 的 stage 群組。舊的垂直分割切割會把鄰居的裙襬碎片一起帶進來，
// 這裡改用獨立立繪，碎片就沒有了。
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(ROOT, 'assets/ref/stage-remade');
const OUT = path.join(ROOT, 'assets/ref/cast');
const run = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {maxBuffer: 64 << 20});
const MAX_H = 900;   // 切圖高度上限，跟其他組的素材尺度相當

const manifestPath = path.join(OUT, 'cast.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const previous = manifest.stage;
if (!previous || previous.length !== 9) throw new Error('需要既有的九人 stage 群組作為座標基準');

const entries = [];
for (let i = 0; i < 9; i++) {
  const input = path.join(REF, `transparent-${i}.png`);
  if (!fs.existsSync(input)) throw new Error('缺少 ' + input);
  const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', input]).toString().trim().split(',').map(Number);
  const rgba = run(['-i', input, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, clear = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] < 8) { clear++; continue; }
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (clear < w * h * .15 || x1 <= x0 || y1 <= y0) throw new Error('沒有 alpha 或人物 ' + i);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, pad = 8, file = `stage-${i}.png`;
  // 裁到主體後縮到高度上限，再補 8 像素透明邊距
  const outH = Math.min(ch, MAX_H), outW = Math.round(cw * outH / ch);
  // 頭頂往下 14% 內的不透明像素平均位置當作頭部中心（換算到縮放後的座標）
  let sx = 0, n = 0;
  for (let y = y0; y < y0 + ch * .14; y++) for (let x = x0; x <= x1; x++) if (rgba[(y * w + x) * 4 + 3] > 128) { sx += x - x0; n++; }
  const headX = Math.round((sx / Math.max(1, n)) * outW / cw) + pad;
  run(['-i', input, '-vf', `crop=${cw}:${ch}:${x0}:${y0},scale=${outW}:${outH}:flags=lanczos,pad=${outW + 16}:${outH + 16}:8:8:color=black@0`, '-frames:v', '1', '-pix_fmt', 'rgba', path.join(OUT, file)]);
  // 人物 PV 的舞台段落用整張群像 matte 畫，編號與光暈的位置來自 cast.json 的 source 座標。
  // 新立繪不在原合圖裡，所以沿用舊切圖的中線與底線，讓標號與光暈仍對準原圖上的同一位。
  const old = previous[i];
  const centerX = old.source[0] + old.w / 2, bottomY = old.source[1] + old.h;
  entries.push({
    file,
    w: outW + 16,
    h: outH + 16,
    headX,
    headY: Math.round(outH * .10) + pad,
    source: [Math.round(centerX - (outW + 16) / 2), Math.round(bottomY - (outH + 16))],
    sheet: `stage-remade/transparent-${i}.png`,
  });
}

manifest.stage = entries;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
console.log('stage：已替換九張獨立立繪切圖並更新 cast.json');
for (const e of entries) console.log(`  ${e.file} ${e.w}x${e.h} head(${e.headX},${e.headY})`);
