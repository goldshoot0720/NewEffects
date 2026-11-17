#!/usr/bin/env node
// 用 ASR 的逐字時間產生 PV 卡拉OK 的逐字填色時間軸（每一句都對到音訊）。
//
// 輸入：
//   <srt>                               這首歌的字幕（句數、句子文字、每句的時間窗）
//   assets/ref/perfect/asr-ja.json      faster-whisper 的逐字時間戳
// 輸出：
//   assets/ref/perfect/fill-ja.json     每句 start/end 與逐字 [起,訖]
//
// 已經人工調過的句子（檔案裡帶 "hand": true）不會被覆蓋。
//
// 用法：node tools/build-perfect-fill.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRT = path.join(root, '完璧じゃないわたし.srt');
const ASR = path.join(root, 'assets/ref/perfect/asr-ja.json');
const OUT = path.join(root, 'assets/ref/perfect/fill-ja.json');
const WIN = 2.0;          // 每句對齊時往前往後多看幾秒
const WIDE = 5.0;         // 窄視窗對不到時，再放大到這個範圍
const TRUST = 0.7;        // ASR 起唱與字幕窗差超過這個秒數，就把整句平移到字幕窗
const hit_count = s => s.filter(v => v != null).length;

const SKIP_FILL = /[\s\p{P}\p{S}]/u;
function tokenize(text){
  const out = []; let bk = false;
  const re = /([一-鿿々〆ヶ]+|[A-Za-z]+(?: +[A-Za-z]+)*)[(（]([ぁ-ゟ゠-ヿ]+)[)）]|[A-Za-z0-9'’!?！？\-_~]+|./gsu;
  for(const m of text.matchAll(re)){
    const c = m[0];
    if(m[1]){ out.push({t: m[1], ruby: m[2], bk, w: m[1].length + .3}); continue; }
    if('［《[(（'.includes(c)){ bk = true; continue; }
    if('］》])）'.includes(c)){ bk = false; continue; }
    if(/^\s$/u.test(c)) out.push({t: ' ', sp: true, bk, w: .5});
    else if(/^[A-Za-z0-9]/.test(c)) out.push({t: c, latin: true, bk, w: Math.max(1, c.length*.45)});
    else out.push({t: c, bk, w: 1});
  }
  return out;
}

const norm = c => {
  c = c.normalize('NFKC');
  if(c >= 'ァ' && c <= 'ヺ') c = String.fromCharCode(c.charCodeAt(0) - 0x60);
  return c;
};
const SKIP = /[\s\p{P}\p{S}]/u;
function normChars(text){
  const out = [];
  for(const c of text){ const n = norm(c); if(!SKIP.test(n)) out.push(n); }
  return out;
}

function parseSrt(p){
  const cues = [];
  for(const block of fs.readFileSync(p, 'utf8').replace(/\r/g, '').split(/\n\s*\n/)){
    const ls = block.split('\n').filter(x => x.trim());
    if(ls.length < 2 || !ls[1].includes('-->')) continue;
    const m = ls[1].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
    if(!m) continue;
    const t = m.slice(1).map(Number);
    cues.push({
      start: t[0]*3600 + t[1]*60 + t[2] + t[3]/1000,
      end: t[4]*3600 + t[5]*60 + t[6] + t[7]/1000,
      jp: ls[2],
    });
  }
  return cues;
}

// Levenshtein 對齊：回傳 [歌詞索引, ASR 索引] 的配對
function align(lyric, asr){
  const n = asr.length, m = lyric.length;
  const INF = 1e9;
  let prev = Array.from({length: m + 1}, (_, j) => j);
  const back = [];
  for(let i = 1; i <= n; i++){
    const cur = new Array(m + 1).fill(0); cur[0] = i;
    const row = new Uint8Array(m + 1);
    for(let j = 1; j <= m; j++){
      const cost = asr[i - 1] === lyric[j - 1] ? 0 : 1;
      let best = prev[j - 1] + cost, step = 0;
      if(prev[j] + 1 < best){ best = prev[j] + 1; step = 1; }
      if(cur[j - 1] + 1 < best){ best = cur[j - 1] + 1; step = 2; }
      cur[j] = best; row[j] = step;
    }
    back.push(row); prev = cur;
  }
  let i = n, j = m;
  const pairs = [];
  while(i > 0 && j > 0){
    const step = back[i - 1][j];
    if(step === 0){
      if(asr[i - 1] === lyric[j - 1]) pairs.push([j - 1, i - 1]);
      i--; j--;
    } else if(step === 1) i--;
    else j--;
  }
  return pairs.reverse();
}

const cues = parseSrt(SRT);
const segs = JSON.parse(fs.readFileSync(ASR, 'utf8'));
const asrChar = [], asrS = [], asrE = [];
for(const s of segs){
  for(const w of s.words || []){
    const cs = normChars(w.w);
    const span = Math.max(1e-3, w.e - w.s);
    cs.forEach((c, k) => {
      asrChar.push(c);
      asrS.push(w.s + span*k/cs.length);
      asrE.push(w.s + span*(k + 1)/cs.length);
    });
  }
}

// 在視窗內把這句的歌詞字對到 ASR 的字，回傳每個字的 [起,訖] 或 null
function matchLine(chars, lo, hi){
  const idx = [];
  for(let k = 0; k < asrChar.length; k++) if(asrS[k] >= lo && asrS[k] <= hi) idx.push(k);
  if(!idx.length) return null;
  const s = new Array(chars.length).fill(null), e = new Array(chars.length).fill(null);
  let hit = 0;
  for(const [lj, ai] of align(chars.map(norm), idx.map(k => asrChar[k]))){
    if(asrChar[idx[ai]] !== norm(chars[lj]) || s[lj] != null) continue;
    s[lj] = asrS[idx[ai]]; e[lj] = asrE[idx[ai]]; hit++;
  }
  return {s, e, hit, ratio: hit/chars.length};
}

const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {lines: []};
// 人工句依「句子文字」對回現在的 cue（字幕重排後 index 會變，不能只看 i）
const cleanKey = s => s.replace(/[\s\p{P}\p{S}]/gu, '');
const hand = new Map();
for(const l of old.lines.filter(l => l.hand)){
  const k = cleanKey(l.jp);
  const hits = cues.map((c, i) => [c, i]).filter(([c]) => cleanKey(c.jp) === k);
  const exact = hits.find(([c, i]) => Math.abs(c.start - l.start) < 0.6) || hits[0];
  if(exact) hand.set(exact[1], {...l, i: exact[1], jp: exact[0].jp});
  else console.warn('人工句找不到對應字幕：', l.jp);
}
const out = [];

cues.forEach((cue, i) => {
  if(hand.has(i)){ out.push(hand.get(i)); return; }
  // 這一頁要填的字（與 pv.js 的 attachFill 相同規則：跳過標點符號）
  const chars = [];
  for(const u of tokenize(cue.jp)){
    if(u.sp) continue;
    for(const ch of [...u.t]) if(!SKIP_FILL.test(ch)) chars.push(ch);
  }
  if(!chars.length) return;

  // 先用窄視窗（信得過的就用絕對時間），對不到再放大視窗並整句平移
  let m = matchLine(chars, cue.start - WIN, cue.end + WIN);
  let wide = false;
  if(!m || m.ratio < 0.5){
    const m2 = matchLine(chars, cue.start - WIDE, cue.end + WIDE);
    if(m2 && (!m || m2.ratio > m.ratio)) { m = m2; wide = true; }
  }
  if(!m || m.ratio < 0.4) return;   // 還對不到就放棄，退回原本的估算
  const {s, e} = m;
  if(hit_count(s) === 0) return;
  // 放寬視窗抓到的若差太多，代表抓到的是鄰句：不要用。
  const off = Math.abs(Math.min(...s.filter(v => v != null)) - cue.start);
  if(wide && off > (m.ratio >= 0.8 ? 4.5 : 2.0)) return;

  // 沒對上的字：在前後兩個對上的字之間平均分配（開頭、結尾接字幕窗）
  let k = 0;
  while(k < chars.length){
    if(s[k] != null){ k++; continue; }
    let j = k; while(j < chars.length && s[j] == null) j++;
    const a = k ? e[k - 1] : (j < chars.length ? s[j] - 0.5*(j - k) : cue.start);
    const b = j < chars.length ? s[j] : a + 0.5*(j - k);
    const step = (b - a)/Math.max(1, j - k);
    for(let q = k; q < j; q++){ s[q] = a + step*(q - k); e[q] = a + step*(q - k + 1); }
    k = j;
  }
  // 單調、最短 60ms
  for(let k = 0; k < chars.length; k++){
    if(k) s[k] = Math.max(s[k], e[k - 1]);
    e[k] = Math.max(e[k], s[k] + 0.06);
  }

  // ASR 與字幕窗差太多時整句平移到字幕窗，維持字幕與填色一致
  if(Math.abs(s[0] - cue.start) > TRUST){
    const d = cue.start - s[0];
    for(let k = 0; k < chars.length; k++){ s[k] += d; e[k] += d; }
  }
  if(s[0] < cue.start){
    const d = cue.start - s[0];
    for(let k = 0; k < chars.length; k++){ s[k] += d; e[k] += d; }
  }
  let end = e[e.length - 1];
  if(end > cue.end){
    const span = end - s[0], room = cue.end - s[0];
    if(room > 0.4){
      const scale = room/span;
      for(let k = 0; k < chars.length; k++){ s[k] = s[0] + (s[k] - s[0])*scale; e[k] = s[0] + (e[k] - s[0])*scale; }
      end = cue.end;
    } else return;   // 字幕窗太短，這句不要硬塞
  }
  if(end - s[0] < 0.4) return;
  // 句中若有一段超過 1.2 秒的空白，通常是對錯了段落，寧可退回估算。
  let maxGap = 0;
  for(let k = 1; k < chars.length; k++) maxGap = Math.max(maxGap, s[k] - e[k - 1]);
  if(maxGap > 1.8) return;
  // 前面幾個字若全擠在句首一小段、最後一個字才拖長，代表對歪了。
  const span = end - s[0];
  if(chars.length > 2 && (e[chars.length - 2] - s[0]) < 0.3*span) return;
  out.push({
    i, jp: cue.jp, start: +s[0].toFixed(3), end: +end.toFixed(3),
    ...(wide ? {wide: true} : {}),
    t: s.map((v, k) => [+v.toFixed(3), +e[k].toFixed(3)]),
  });
});

out.sort((a, b) => a.i - b.i);
const doc = {
  song: '完璧じゃないわたし',
  note: '逐字填色時間軸：以 ASR 逐字時間對齊每一句（tools/build-perfect-fill.mjs）。'
      + 'hand:true 的句子是人工逐句核對過的，重建時不會被覆蓋。',
  lines: out,
};
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
console.log(`寫入 ${path.relative(root, OUT)}：${out.length} 句（人工 ${hand.size} 句、自動 ${out.length - hand.size} 句）`);
