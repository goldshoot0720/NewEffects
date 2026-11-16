#!/usr/bin/env node
// 「最最最高級のお世話して」（angela／TVアニメ『才女のお世話』OP）
// 八位角色：使用者提供八張白底立繪，各自一位角色。
// 以邊緣洪水填充去掉白底、只保留最大前景連通塊，輸出 cast/osewa-0..7.png，
// 更新 cast.json 的 osewa 群組，並拼出 1920×1080 群像 assets/ref/osewa/group.png。
// 用法：node tools/build-osewa.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(ROOT, 'assets/ref/osewa'), CAST = path.join(ROOT, 'assets/ref/cast');
const GROUP = 'osewa', MAX_H = 960, PAD = 8, T = 34;

// 索引順序就是 PV 卡司順序：主唱（友成伊月）放第一位，舞台會排到正中央。
const MEMBERS = [
  {file: '01-itsuki.png', name: '友成伊月', color: '#4a5a78'},
  {file: '02-hinako.jpg', name: '此花雛子', color: '#e8913f'},
  {file: '03-mirei.jpg', name: '天王寺美麗', color: '#e8c44a'},
  {file: '04-narika.jpg', name: '都島成香', color: '#8a6ad6'},
  {file: '05-shizune.jpg', name: '鶴見静音', color: '#4b3f5e'},
  {file: '06-taisho.png', name: '大将勝也', color: '#3f6f4a'},
  {file: '07-karen.jpg', name: '朝日花蓮', color: '#d4674f'},
  {file: '08-kagen.png', name: '此花華玄', color: '#7d2f3c'}
];

const probe = file => execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim().split(',').map(Number);
function load(file){
  const [w, h] = probe(file);
  const rgba = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], {maxBuffer: 1 << 30});
  return {w, h, rgba};
}
const savePng = (file, w, h, rgba) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-compression_level', '9', file], {input: rgba});

// 兩種來源：官方 PNG 已帶透明去背，直接用它的 alpha；JPG 是白底，走洪水填充。
// 白制服、白襪都被外框線包住，洪水不會灌進去。
function cut(file){
  const {w, h, rgba} = load(file);
  let clear = 0;
  for(let i = 0; i < w*h; i++) if(rgba[i*4 + 3] < 8) clear++;
  const hasAlpha = clear > w*h*.01;
  let bg = null, label = null, best = {n: 0, k: -1, x0: w, x1: 0, y0: h, y1: 0};
  const dist = i => {
    const r = rgba[i*4], g = rgba[i*4+1], b = rgba[i*4+2];
    return Math.sqrt((r - 254)**2 + (g - 254)**2 + (b - 254)**2);
  };
  if(hasAlpha){
    // 已去背：前景就是 alpha > 0 的像素
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      if(rgba[(y*w + x)*4 + 3] < 8) continue;
      if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
    }
    best = {n: 1, k: 0, x0, x1, y0, y1};
  } else {
    const nearWhite = i => {
      const r = rgba[i*4], g = rgba[i*4+1], b = rgba[i*4+2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      return mn > 196 && mx - mn < 14;
    };
    bg = new Uint8Array(w*h);
    const q = new Int32Array(w*h);
    let qh = 0, qt = 0;
    const seed = i => { if(!bg[i] && nearWhite(i) && dist(i) < T){ bg[i] = 1; q[qt++] = i; } };
    for(let x = 0; x < w; x++){ for(let y = 0; y < 8; y++) seed(y*w + x); seed((h - 1)*w + x); }
    for(let y = 0; y < h; y++){ seed(y*w); seed(y*w + w - 1); }
    while(qh < qt){
      const i = q[qh++], x = i % w, y = (i - x)/w;
      if(x > 0) seed(i - 1); if(x < w - 1) seed(i + 1);
      if(y > 0) seed(i - w); if(y < h - 1) seed(i + w);
    }
    // 只留最大的一塊前景，去掉零散的白底殘點
    label = new Int32Array(w*h).fill(-1);
    let k = 0;
    for(let s = 0; s < w*h; s++){
      if(bg[s] || label[s] >= 0) continue;
      let h0 = 0, t0 = 0, n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
      q[t0++] = s; label[s] = k;
      while(h0 < t0){
        const i = q[h0++], x = i % w, y = (i - x)/w;
        n++; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y;
        for(const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
          if(j >= 0 && !bg[j] && label[j] < 0){ label[j] = k; q[t0++] = j; }
      }
      if(n > best.n) best = {n, k, x0, x1, y0, y1};
      k++;
    }
  }
  if(best.x1 <= best.x0 || best.y1 <= best.y0) throw new Error(`${file}: 找不到角色前景`);
  const c = best, pad = 6;
  const x0 = Math.max(0, c.x0 - pad), x1 = Math.min(w - 1, c.x1 + pad);
  const y0 = Math.max(0, c.y0 - pad), y1 = Math.min(h - 1, c.y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = Buffer.alloc(cw*ch*4);
  let topSum = 0, topN = 0;
  for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
    const i = y*w + x, o = ((y - y0)*cw + (x - x0))*4;
    let a;
    if(hasAlpha){
      a = rgba[i*4 + 3];
    } else {
      a = 0;
      if(label[i] === c.k){
        const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
        a = edge ? Math.max(0, Math.min(255, Math.round((dist(i) - T*.5)/(T*1.6)*255))) : 255;
      }
    }
    out[o] = rgba[i*4]; out[o + 1] = rgba[i*4+1]; out[o + 2] = rgba[i*4+2];
    if(a > 0 && a < 255){
      const near = [-2, -1, 1, 2].some(d => (x + d >= 0 && x + d < w && (hasAlpha ? rgba[(i + d)*4 + 3] < 8 : bg[i + d])) ||
                                           (y + d >= 0 && y + d < h && (hasAlpha ? rgba[(i + d*w)*4 + 3] < 8 : bg[i + d*w])));
      if(near){
        const al = Math.max(.35, Math.min(1, a/255*.85));
        for(let ch3 = 0; ch3 < 3; ch3++) out[o + ch3] = Math.max(0, Math.min(255, Math.round((rgba[i*4 + ch3] - (1 - al)*254)/al)));
      }
    }
    out[o + 3] = a;
    if(a > 8 && y - c.y0 < (c.y1 - c.y0)*.12){ topSum += x - x0; topN++; }
  }
  // 等比縮到 MAX_H 以內（PV 最長只畫到約 700px），再補透明邊
  const outH = Math.min(ch, MAX_H), outW = Math.max(1, Math.round(cw*outH/ch));
  const scaled = Buffer.alloc(outW*outH*4);
  for(let y = 0; y < outH; y++) for(let x = 0; x < outW; x++){
    const sx = Math.min(cw - 1, Math.floor(x*cw/outW)), sy = Math.min(ch - 1, Math.floor(y*ch/outH));
    const so = (sy*cw + sx)*4, to = (y*outW + x)*4;
    scaled[to] = out[so]; scaled[to + 1] = out[so + 1]; scaled[to + 2] = out[so + 2]; scaled[to + 3] = out[so + 3];
  }
  const W = outW + PAD*2, H = outH + PAD*2, canvas = Buffer.alloc(W*H*4);
  for(let y = 0; y < outH; y++) scaled.copy(canvas, ((y + PAD)*W + PAD)*4, y*outW*4, (y + 1)*outW*4);
  return {
    w: W, h: H, rgba: canvas,
    headX: Math.round((topSum/Math.max(1, topN))*outW/cw) + PAD,
    headY: Math.round(outH*.09) + PAD,
    source: [x0, y0]
  };
}

fs.mkdirSync(CAST, {recursive: true});
const entries = MEMBERS.map((m, i) => {
  const r = cut(path.join(REF, m.file));
  const file = `${GROUP}-${i}.png`;
  savePng(path.join(CAST, file), r.w, r.h, r.rgba);
  console.log(`${m.file} → ${file} ${r.w}x${r.h} head(${r.headX},${r.headY}) ${m.name}`);
  return {file, w: r.w, h: r.h, headX: r.headX, headY: r.headY, source: r.source, sheet: `osewa/${m.file}`, name: m.name};
});

const manifestPath = path.join(CAST, 'cast.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest[GROUP] = entries;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');

// 群像主視覺：兩排錯位，前排五人、後排三人，主角與大小姐在中央，
// 底色是學院禮堂的奶油金到玫瑰，地板上打一盞柔光。
const W = 1920, H = 1080;
const canvas = Buffer.alloc(W*H*4);
for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
  const v = y/H, o = (y*W + x)*4;
  const dx = (x - W*.5)/(W*.55), dy = (y - H*.45)/(H*.62), d = Math.min(1, Math.hypot(dx, dy));
  const glow = Math.pow(1 - d, 2.4);
  canvas[o]     = Math.round(72*(1 - v) + 255*v + 34*glow);
  canvas[o + 1] = Math.round(30*(1 - v) + 236*v + 26*glow);
  canvas[o + 2] = Math.round(56*(1 - v) + 198*v + 6*glow);
  canvas[o + 3] = 255;
}
// 舞台地板：下半部壓暗，中央一盞暖光
for(let y = Math.round(H*.72); y < H; y++) for(let x = 0; x < W; x++){
  const o = (y*W + x)*4, u = (y - H*.72)/(H*.28);
  const dx = (x - W*.5)/(W*.42), dy = (y - H*.94)/(H*.16);
  const spot = Math.max(0, 1 - Math.hypot(dx, dy*1.1));
  const k = 1 - .34*u*(1 - spot*.85);
  canvas[o] = Math.round(canvas[o]*k); canvas[o + 1] = Math.round(canvas[o + 1]*k); canvas[o + 2] = Math.round(canvas[o + 2]*k);
}
// index / 中心 x / 腳底 y / 身高；後排先畫
const LAYOUT = [
  {i: 3, x: 430, base: 742, h: 640},   // 都島成香
  {i: 5, x: 960, base: 728, h: 660},   // 大将勝也
  {i: 6, x: 1490, base: 742, h: 640},  // 朝日花蓮
  {i: 4, x: 232, base: 1042, h: 760},  // 鶴見静音
  {i: 1, x: 616, base: 1056, h: 800},  // 此花雛子
  {i: 0, x: 960, base: 1064, h: 812},  // 友成伊月
  {i: 2, x: 1304, base: 1056, h: 800}, // 天王寺美麗
  {i: 7, x: 1690, base: 1042, h: 760}  // 此花華玄
];
const faces = new Array(entries.length);
for(const slot of LAYOUT){
  const meta = entries[slot.i];
  const {w: iw, h: ih, rgba} = load(path.join(CAST, meta.file));
  const k = slot.h/ih, dw = Math.round(iw*k), dh = Math.round(ih*k);
  const left = Math.round(slot.x - dw/2), top = Math.round(slot.base - dh);
  // 腳下淡淡的影子
  const cx = slot.x, cy = slot.base - 6, rx = dw*.34, ry = 13;
  for(let y = Math.round(cy - ry); y <= cy + ry; y++) for(let x = Math.round(cx - rx); x <= cx + rx; x++){
    if(x < 0 || x >= W || y < 0 || y >= H) continue;
    const u = ((x - cx)/rx)**2 + ((y - cy)/ry)**2;
    if(u > 1) continue;
    const o = (y*W + x)*4, k2 = .28*(1 - u);
    canvas[o] = Math.round(canvas[o]*(1 - k2)); canvas[o + 1] = Math.round(canvas[o + 1]*(1 - k2)); canvas[o + 2] = Math.round(canvas[o + 2]*(1 - k2));
  }
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
  faces[slot.i] = [Math.round(left + meta.headX*k), Math.round(top + meta.headY*k + dh*.05)];
}
const groupOut = path.join(REF, 'group.png');
savePng(groupOut, W, H, canvas);
console.log(`osewa：八張切圖與 cast.json 已更新，群像 → ${path.relative(ROOT, groupOut)}`);
console.log('faces: [' + faces.map(f => `[${f[0]}, ${f[1]}]`).join(', ') + ']');
