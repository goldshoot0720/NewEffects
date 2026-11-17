#!/usr/bin/env node
// FX戦士くるみちゃん：用 ASR 的逐字時間戳把歌詞對到音訊，產生 PV 卡拉OK填色用的「逐個字」時間軸。
//
// 輸入：
//   assets/ref/fx/timings-ja.json        60 句人工校過的起訖（句框）
//   assets/ref/fx/lyrics-ja.txt          60 行日文歌詞
//   assets/ref/fx/lyrics-zh.txt          60 行繁中翻譯
//   assets/ref/fx/fill-overrides.json    少數句子的手工重建（見 README）
//   .zwork/fx/asr-*.json                 ASR 的詞級時間戳（可給多份，逐句擇優）
// 輸出：
//   assets/ref/fx/fill-ja.json           每個字「開始唱／唱完」（t＝日文、z＝繁中）
//   .zwork/fx/fx-report.json             逐句的對齊品質、建議句框
//   .zwork/fx/timings-proposed.json      建議回寫的 timings-ja.json
//
// 為什麼要以人工校過的句框為先驗、只在框內對齊：
//   整首歌一次做字元對齊時，「ドル円…」「押せ！…」這種重複唱段會互相搶字，
//   導致整段錯位一行。句框把「哪一句該配哪一段音」先定死，框內再對字，就不會跑掉。
//
// 為什麼要把跨框的字詞裁掉：
//   ASR 的詞是按呼吸與語意切，不會剛好切在樂句邊界。直接拿鄰句的詞來對，
//   會把上一句的字配到這句、或這句的字配到下一句。取用時一律先裁到框內，
//   重疊不到一半的詞整個丟掉。
//
// 用法：node tools/build-fx-fill.mjs [.zwork/fx/asr-plain.json .zwork/fx/asr-prompt.json]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(root, 'assets/ref/fx');
const args = process.argv.slice(2);
const asrPaths = (args.length ? args : [path.join(root, '.zwork/fx/asr-plain.json')])
  .map(p => path.isAbsolute(p) ? p : path.join(root, p));

const AUDIO_END = 203.75;   // FX戦士くるみちゃん.mp3 的長度
const WIN_PRE = 0.25;       // 句框前後各放寬一點，讓框邊的字也有機會對上
const WIN_POST = 0.35;
const MAX_SPAN = 6.0;       // 單句最多取多長的區間來對字（避免跨過間奏）
const COVER_MIN = 0.55;     // 對上的字低於這個比例就改用均勻分配
const WORD_KEEP = 0.5;      // 詞落在框內的比例低於這個值就整個丟掉（那是鄰句的字）

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

// ASR 的每一個字配上起訖時間（詞內均分）
function asrChars(words, winStart, winEnd) {
  const chars = [], starts = [], ends = [];
  for (const w of words) {
    const cs = normChars(w.w);
    if (!cs.length) continue;
    // 詞的時間裁到框內，避免把鄰句的聲音算進來
    const s = Math.max(w.s, winStart), e = Math.min(w.e, winEnd);
    if (e <= s) continue;
    const span = e - s;
    for (let i = 0; i < cs.length; i++) {
      chars.push(cs[i]);
      starts.push(s + span * i / cs.length);
      ends.push(s + span * (i + 1) / cs.length);
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
const zhLines = fs.readFileSync(path.join(REF, 'lyrics-zh.txt'), 'utf8')
  .split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
const prior = JSON.parse(fs.readFileSync(path.join(REF, 'timings-ja.json'), 'utf8'));
const overrides = JSON.parse(fs.readFileSync(path.join(REF, 'fill-overrides.json'), 'utf8'));

// 斷詞後每句的字序列（與 pv.js 的 c.ju 一致）
function glyphsOf(line) {
  const glyphs = [];
  for (const u of tokenize(LyricText.clean(line))) {
    if (u.sp) continue;
    for (const ch of u.t) for (const c of normChars(ch)) glyphs.push(c);
  }
  return glyphs;
}
const lineGlyphs = lines.map(glyphsOf);
const zhGlyphs = zhLines.map(glyphsOf);

const asrRuns = asrPaths.map(p => {
  const asr = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {path: p, words: asr.flatMap(d => d.words || [])};
});

const out = [];
const report = [];
const proposed = [];

for (let li = 0; li < lines.length; li++) {
  const glyphs = lineGlyphs[li];
  const N = glyphs.length;
  const pStart = prior[li].start, pEnd = prior[li].end;
  const nextStart = li + 1 < prior.length ? prior[li + 1].start : AUDIO_END;
  const winStart = Math.max(0, pStart - WIN_PRE);
  const winEnd = Math.min(nextStart - 0.02, pEnd + WIN_POST, winStart + MAX_SPAN);

  let times = null, method = 'even', cover = 0, asrName = null, vocalStart = pStart, vocalEnd = pEnd;

  const ov = overrides[String(li)];
  if (ov?.t) {
    times = ov.t.map(([s, e]) => ({s, e}));
    method = 'override';
    vocalStart = times[0].s; vocalEnd = times[times.length - 1].e;
  } else {
    // 每份 ASR 各算一次，逐句挑覆蓋率最高的那份
    let best = null;
    for (const run of asrRuns) {
      const inWin = run.words.filter(w => {
        const ov2 = Math.min(w.e, winEnd) - Math.max(w.s, winStart);
        return ov2 > 0 && ov2 >= WORD_KEEP * (w.e - w.s);
      });
      if (!inWin.length) continue;
      const {chars: aChars, starts, ends} = asrChars(inWin, winStart, winEnd);
      if (!aChars.length) continue;
      const {si, ei} = align(aChars, glyphs);
      const gStart = new Array(N).fill(null);
      const gEnd = new Array(N).fill(null);
      let matched = 0;
      for (let k = 0; k < si.length; k++) {
        if (si[k] < 0) continue;
        const gi = k;              // 逐句對齊：歌詞字索引就是這句的第 k 個字
        matched++;
        const s = starts[si[k]], e = ends[ei[k]];
        if (gStart[gi] == null || s < gStart[gi]) gStart[gi] = s;
        if (gEnd[gi] == null || e > gEnd[gi]) gEnd[gi] = e;
      }
      const cov = matched / Math.max(1, N);
      if (!best || cov > best.cover) best = {cover: cov, gStart, gEnd, matched, path: run.path};
    }
    cover = best?.cover ?? 0;
    if (best && cover >= COVER_MIN) {
      const known = [];
      for (let gi = 0; gi < N; gi++) if (best.gStart[gi] != null) known.push(gi);
      times = [];
      for (let gi = 0; gi < N; gi++) {
        let s = best.gStart[gi], e = best.gEnd[gi];
        if (s == null) {
          const before = [...known].reverse().find(k => k < gi);
          const after = known.find(k => k > gi);
          const b = before != null ? best.gEnd[before] : null;
          const a = after != null ? best.gStart[after] : null;
          s = b != null && a != null ? (b + a) / 2 : (b ?? a);
          e = s;
        }
        if (e == null) e = s;
        times.push({s: +s.toFixed(3), e: +e.toFixed(3)});
      }
      method = 'asr';
      asrName = best.path.split('/').pop();
      vocalStart = Math.min(...times.map(t => t.s));
      vocalEnd = Math.max(...times.map(t => t.e));
    } else {
      // 對不上就在句框內均勻分配（重複唱段、拖音、口白都屬於這一類）
      const span = Math.max(0.35, pEnd - pStart);
      times = [];
      for (let gi = 0; gi < N; gi++) {
        times.push({s: +(pStart + span * gi / N).toFixed(3), e: +(pStart + span * (gi + 1) / N).toFixed(3)});
      }
      method = 'even';
      vocalStart = pStart; vocalEnd = pEnd;
    }
  }

  // 繁中逐字：中文句與日文句字數不同，按相對位置對應回日文的時間軸。
  const zhTimes = [];
  const M = zhGlyphs[li].length;
  for (let j = 0; j < M; j++) {
    const gi = Math.min(N - 1, Math.floor(j * N / Math.max(1, M)));
    const t = times[gi] || times[times.length - 1];
    zhTimes.push([t.s, t.e]);
  }

  out.push({
    i: li,
    jp: lines[li],
    start: times[0].s,
    end: times[times.length - 1].e,
    t: times.map(x => [x.s, x.e]),
    z: zhTimes,
  });

  // 建議的句框：起點對齊人聲，訖點沿用「下一句起點」的慣例
  const newStart = Math.max(0, Math.min(vocalStart, nextStart - 0.1));
  const newEnd = Math.max(newStart + 0.4, Math.min(nextStart - 0.02, Math.max(vocalEnd + 0.6, pEnd)));
  proposed.push({...prior[li], start: +newStart.toFixed(3), end: +newEnd.toFixed(3), hits: prior[li].hits ?? 0, final: true});
  report.push({
    i: li, jp: lines[li], method, cover: +cover.toFixed(3), asr: asrName,
    priorStart: pStart, priorEnd: pEnd,
    newStart: +newStart.toFixed(2), newEnd: +newEnd.toFixed(2),
    fillStart: times[0].s, fillEnd: times[times.length - 1].e,
    moved: +(newStart - pStart).toFixed(2),
  });
}

fs.writeFileSync(path.join(REF, 'fill-ja.json'), JSON.stringify({
  song: 'FX戦士くるみちゃん',
  note: '逐字填色時間軸：[開始, 唱完]。以人工校過的句框為先驗，在框內用 ASR 逐字時間戳對齊 lyrics-ja.txt；少數句子另見 fill-overrides.json。',
  lines: out,
}, null, 1) + '\n');

fs.mkdirSync(path.join(root, '.zwork/fx'), {recursive: true});
fs.writeFileSync(path.join(root, '.zwork/fx/fx-report.json'), JSON.stringify(report, null, 1) + '\n');
fs.writeFileSync(path.join(root, '.zwork/fx/timings-proposed.json'), JSON.stringify(proposed, null, 1) + '\n');

console.log(`${out.length}/${lines.length} 行 → assets/ref/fx/fill-ja.json`);
console.log('  行  方法      覆蓋  舊起點   新起點   位移   舊訖點   新訖點  歌詞');
for (const r of report) {
  const mv = r.moved > 0.02 ? `+${r.moved.toFixed(2)}` : (r.moved < -0.02 ? r.moved.toFixed(2) : '  —');
  console.log(`${String(r.i + 1).padStart(4)} ${r.method.padEnd(8)} ${String(Math.round(r.cover * 100)).padStart(4)}% ` +
    `${r.priorStart.toFixed(2).padStart(8)} ${r.newStart.toFixed(2).padStart(8)} ${mv.padStart(7)} ` +
    `${r.priorEnd.toFixed(2).padStart(8)} ${r.newEnd.toFixed(2).padStart(8)}  ${r.jp.slice(0, 22)}`);
}
