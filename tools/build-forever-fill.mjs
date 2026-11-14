#!/usr/bin/env node
// 用 ASR 的逐字時間戳把歌詞對到音訊，產生 PV 卡拉OK填色用的「逐個字」時間軸。
//
// 輸入：
//   assets/ref/forever/lyrics-ja.txt   43 行日文歌詞
//   assets/ref/forever/asr-ja.json     ASR 的逐字時間戳
// 輸出：
//   assets/ref/forever/fill-ja.json    每個字「開始唱／唱完」的時間
//
// 為什麼要記兩個時間：一句裡面常有停頓（「宝物みたいな時間」與「未来動かす…」中間空了兩秒多）。
// 只有「唱完時間」的話，停頓會被下一個字的寬度填掉，後半句在沒人唱的时候就亮起來。
// 記下每個字起唱的時間，填色才會在停頓處真的停住。
//
// 用法：node tools/build-forever-fill.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(root, 'assets/ref/forever');

// 播放器用的斷詞規則要跟 pv.js 完全一致，否則字數對不上就會填錯位置。
const box = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'lyric-text.js'), 'utf8'), box);
const LyricText = box.window.LyricText;

const PUNCT = '、。・「」『』…,.';
function tokenize(text) {
  const out = []; let bk = false;
  const re = /([一-鿿々〆ヶ]+|[A-Za-z]+(?: +[A-Za-z]+)*)[(（]([ぁ-ゟ゠-ヿ]+)[)）]|[A-Za-z0-9'’!?！？\-_~]+|./gsu;
  for (const m of text.matchAll(re)) {
    const c = m[0];
    if (m[1]) { out.push({t: m[1], ruby: m[2], bk, w: m[1].length + .3}); continue; }
    if ('［《[(（'.includes(c)) { bk = true; continue; }
    if ('］》])）'.includes(c)) { bk = false; continue; }
    if (/^\s$/u.test(c)) out.push({t: ' ', sp: true, bk, w: .5});
    else if (/^[A-Za-z0-9]/.test(c)) out.push({t: c, latin: true, bk, w: Math.max(1, c.length * .45)});
    else if (PUNCT.includes(c) || /^[!?！？\-_~]+$/.test(c)) out.push({t: c, bk, w: .3, punct: true});
    else out.push({t: c, bk, w: 1});
  }
  return out;
}

// ASR 逐字比對用的正規化：去掉標點空白，全形英數轉半形，片假名轉平假名。
const SKIP = /[\s、。,.!?！？☆★…「」『』()（）\-—~〜♪＆&・“”"'’]/;
function normChar(c) {
  c = c.normalize('NFKC');
  if (c >= 'ァ' && c <= 'ヺ') c = String.fromCharCode(c.charCodeAt(0) - 0x60);
  return c;
}
function normChars(text) {
  const out = [];
  for (const c of text) { const n = normChar(c); if (SKIP.test(n)) continue; out.push(n); }
  return out;
}

// ASR 的每一個字配上起訖時間
function asrChars(words) {
  const chars = [], starts = [], ends = [];
  for (const w of words) {
    const cs = normChars(w.w);
    if (!cs.length) continue;
    const span = Math.max(1e-3, w.e - w.s);
    for (let i = 0; i < cs.length; i++) {
      chars.push(cs[i]);
      starts.push(w.s + span * i / cs.length);
      ends.push(w.s + span * (i + 1) / cs.length);
    }
  }
  return {chars, starts, ends};
}

// Levenshtein 對齊：把 ASR 的字對到歌詞的字，對上的字沿用 ASR 的時間。
function align(aChars, lChars) {
  const n = aChars.length, m = lChars.length, INF = 1 << 30;
  let prev = Array.from({length: m + 1}, (_, j) => j);
  const back = [];
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(INF);
    cur[0] = i;
    const row = new Uint8Array(m + 1);
    const ac = aChars[i - 1];
    for (let j = 1; j <= m; j++) {
      const cost = ac === lChars[j - 1] ? 0 : 1;
      const d = prev[j - 1] + cost, u = prev[j] + 1, l = cur[j - 1] + 1;
      let best = d, mv = 0;
      if (u < best) { best = u; mv = 1; }
      if (l < best) { best = l; mv = 2; }
      cur[j] = best; row[j] = mv;
    }
    back.push(row); prev = cur;
  }
  const si = new Array(m).fill(-1), ei = new Array(m).fill(-1);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const mv = back[i - 1][j];
    if (mv === 0) { si[j - 1] = i - 1; ei[j - 1] = i - 1; i--; j--; }
    else if (mv === 1) i--;
    else j--;
  }
  return {si, ei};
}

const lines = fs.readFileSync(path.join(REF, 'lyrics-ja.txt'), 'utf8')
  .split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
const asr = JSON.parse(fs.readFileSync(path.join(REF, 'asr-ja.json'), 'utf8'));
const {chars: aChars, starts: aStart, ends: aEnd} = asrChars(asr.words);

// 整首歌一次對齊：逐行對齊會讓重複的句子配到歌裡別的位置。
// 斷詞的粒度跟畫面一樣：漢字與假名逐字，英文單字拆成字母（英文也是逐字母填色）。
const lChars = [], owner = [];
const lineGlyphs = lines.map((line, li) => {
  const toks = tokenize(LyricText.clean(line)).filter(u => !u.sp);
  const glyphs = [];
  for (const u of toks) {
    for (const ch of u.t) {
      for (const c of normChars(ch)) { lChars.push(c); owner.push([li, glyphs.length]); glyphs.push(c); }
    }
  }
  return glyphs;
});
const {si, ei} = align(aChars, lChars);

// 每個字取對上的 ASR 時間
const glyphStart = [], glyphEnd = [];
for (let li = 0; li < lines.length; li++) {
  glyphStart.push(new Array(lineGlyphs[li].length).fill(null));
  glyphEnd.push(new Array(lineGlyphs[li].length).fill(null));
}
lChars.forEach((_, k) => {
  if (si[k] < 0) return;
  const [li, gi] = owner[k];
  if (glyphStart[li][gi] == null || aStart[si[k]] < glyphStart[li][gi]) glyphStart[li][gi] = aStart[si[k]];
  if (glyphEnd[li][gi] == null || aEnd[ei[k]] > glyphEnd[li][gi]) glyphEnd[li][gi] = aEnd[ei[k]];
});

const out = [];
let missing = 0;
for (let li = 0; li < lines.length; li++) {
  const N = lineGlyphs[li].length;
  const known = [];
  for (let gi = 0; gi < N; gi++) if (glyphStart[li][gi] != null) known.push(gi);
  if (!known.length) { missing++; continue; }
  const times = [];
  for (let gi = 0; gi < N; gi++) {
    let s = glyphStart[li][gi], e = glyphEnd[li][gi];
    if (s == null) {
      // 對不上的字（例如 ASR 認不出來的英文）用前後有對上的字內插
      const before = [...known].reverse().find(k => k < gi);
      const after = known.find(k => k > gi);
      const b = before != null ? glyphEnd[li][before] : null;
      const a = after != null ? glyphStart[li][after] : null;
      s = b != null && a != null ? (b + a) / 2 : (b ?? a);
      e = s;
    }
    if (e == null) e = s;
    times.push({s: +s.toFixed(3), e: +e.toFixed(3)});
  }
  out.push({
    i: li,
    jp: lines[li],
    start: +times[0].s.toFixed(3),
    end: +Math.max(...times.map(x => x.e)).toFixed(3),
    t: times.map(x => [x.s, x.e]),
  });
}

fs.writeFileSync(path.join(REF, 'fill-ja.json'), JSON.stringify({
  song: 'Forever＆ever',
  note: '逐字填色時間軸：[開始, 唱完]。由 ASR 逐字時間戳對到 lyrics-ja.txt，再對齊 pv.js 的斷詞。',
  lines: out,
}, null, 1) + '\n');

console.log(`${out.length} 行 → assets/ref/forever/fill-ja.json`);
for (const l of out) {
  const spread = l.t.map(([s, e]) => `${s.toFixed(2)}-${e.toFixed(2)}`).join(' ');
  console.log(`${String(l.i + 1).padStart(3)} ${l.start.toFixed(2).padStart(7)}-${l.end.toFixed(2).padStart(7)} | ${spread} | ${l.jp.slice(0, 22)}`);
}
if (missing) console.log(`有 ${missing} 行完全對不上 ASR，已略過`);
