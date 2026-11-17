#!/usr/bin/env node
// FX戦士くるみちゃん：把歌詞逐字對到音訊，產生 PV 卡拉OK填色用的「逐個字」時間軸。
//
// 輸入：
//   assets/ref/fx/timings-ja.json        句框（起訖），當人工校過的先驗
//   assets/ref/fx/lyrics-ja.txt          60 行日文歌詞
//   assets/ref/fx/lyrics-zh.txt          60 行繁中翻譯
//   assets/ref/fx/fill-overrides.json    少數句子的手工重建（見 README）
//   .zwork/fx/asr-*.json                 ASR 的詞級時間戳（可給多份，逐句擇優）
// 輸出：
//   assets/ref/fx/fill-ja.json           每個字「開始唱／唱完」（t＝日文、z＝繁中）
//   .zwork/fx/fx-report.json             逐句的對齊品質、建議句框
//   .zwork/fx/timings-proposed.json      建議回寫的 timings-ja.json
//
// 為什麼要「全歌一次對齊」而不是逐句開視窗：
//   逐句開視窗的前提是句框本身對。一旦某句的框偏了（聽起來像別句），
//   在框內再怎麼對字都會把別句的字配到這句。整首歌一次做單調對齊，
//   ASR 的字只能往前配，句子順序就不會錯位。
//   （本首歌 115–155 秒就是這種情況：人工句框整整慢了一句。）
//
// 為什麼覆蓋率要「完全相同的字」才算：
//   Levenshtein 走對角線時，取代與相符的代價都記在同一步，
//   只看「有沒有對到字」會把「東京市場」配上「ドル円」的時間。
//   所以這裡只認字元完全相同的對應，其餘用插值補。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(root, 'assets/ref/fx');
const args = process.argv.slice(2);
const asrPaths = (args.length ? args : [
  path.join(REF, 'asr-ja.json'),
  path.join(REF, 'asr-ja-prompt.json'),
]).map(p => path.isAbsolute(p) ? p : path.join(root, p));

const AUDIO_END = 203.75;   // FX戦士くるみちゃん.mp3 的長度
const COVER_MIN = 0.50;     // 全歌對齊後，完全相符的比例低於這個就改用句框內均勻分配
const MAX_SEG = 12.0;       // ASR 分段比這還長的不要（整句被攤平，段內時間不可信）
const WIN_PRE = 0.60;       // 句框往前後放寬一點，讓框邊的字也有機會對上
const WIN_POST = 0.60;

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

// 斷詞後每句的字序列（與 pv.js 的 c.ju 一致）
function glyphsOf(line) {
  const glyphs = [];
  for (const u of tokenize(LyricText.clean(line))) {
    if (u.sp) continue;
    for (const ch of u.t) for (const c of normChars(ch)) glyphs.push(c);
  }
  return glyphs;
}

// 全歌一次做單調對齊：回傳 [asrIdx, lyrIdx, 完全相同?]
// priorBias：文字打平時（例如三句都叫「ねぇねぇくるみ」），用人工句框當打破平手的依據。
// 文字完全相符時成本是 0，偏置再大也贏不了，所以真正聽錯的地方不會被句框帶走。
function align(A, L, priorBias) {
  const n = A.length, m = L.length, INF = 1 << 30;
  let prev = Array.from({length: m + 1}, (_, j) => j);
  const back = new Uint8Array((n + 1) * (m + 1));
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(INF);
    cur[0] = i;
    const ac = A[i - 1].c;
    const at = A[i - 1].s;
    for (let j = 1; j <= m; j++) {
      const cost = (ac === L[j - 1].c ? 0 : 1) + priorBias(L[j - 1].line, at);
      const d = prev[j - 1] + cost, u = prev[j] + 1, l = cur[j - 1] + 1;
      let best = d, mv = 0;
      if (u < best) { best = u; mv = 1; }
      if (l < best) { best = l; mv = 2; }
      cur[j] = best; back[i * (m + 1) + j] = mv;
    }
    prev = cur;
  }
  const pairs = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i === 0) { j--; continue; }
    if (j === 0) { i--; continue; }
    const mv = back[i * (m + 1) + j];
    if (mv === 0) { pairs.push([i - 1, j - 1, A[i - 1].c === L[j - 1].c]); i--; j--; }
    else if (mv === 1) i--;
    else j--;
  }
  pairs.reverse();
  return pairs;
}

const lines = fs.readFileSync(path.join(REF, 'lyrics-ja.txt'), 'utf8')
  .split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
const zhLines = fs.readFileSync(path.join(REF, 'lyrics-zh.txt'), 'utf8')
  .split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
const prior = JSON.parse(fs.readFileSync(path.join(REF, 'timings-ja.json'), 'utf8'));
const overrides = JSON.parse(fs.readFileSync(path.join(REF, 'fill-overrides.json'), 'utf8'));

const lineGlyphs = lines.map(glyphsOf);
const zhGlyphs = zhLines.map(glyphsOf);

// 歌詞全部攤平成一個字序列，記住每個字屬於哪一句
const LYR = [];
lineGlyphs.forEach((g, li) => g.forEach(c => LYR.push({c, line: li})));

// 每份 ASR 攤平成字序列（詞內均分），再跟歌詞做一次全歌對齊
const runs = asrPaths.map(p => {
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const asr = Array.isArray(raw) ? raw : raw.segments;
  const chars = [];
  asr.forEach(d => {
    // 太長的分段代表整句被併成一段，段內的字時間是攤平出來的，不可用
    if (d.e - d.s > MAX_SEG) return;
    for (const w of d.words || []) {
      const cs = normChars(w.w);
      if (!cs.length) continue;
      const span = Math.max(1e-6, w.e - w.s);
      cs.forEach((c, k) => chars.push({
        c,
        s: w.s + span * k / cs.length,
        e: w.s + span * (k + 1) / cs.length,
        segS: d.s, segE: d.e,
        segFirst: k === 0 && w.s <= d.s + 0.02,
      }));
    }
  });
  const pairs = align(chars, LYR, (line, t) => {
    const p = prior[line];
    if (!p) return 0;
    return (t >= p.start - 0.8 && t <= p.end + 0.8) ? 0 : 0.45;
  });
  const segs = asr.filter(d => d.e - d.s <= MAX_SEG).map(d => ({s: d.s, e: d.e}));
  // 每句的字在歌詞扁平序列裡的起始位置
  const offsets = [];
  let acc = 0;
  for (const g of lineGlyphs) { offsets.push(acc); acc += g.length; }
  // 依歌詞行整理：完全相同的對應才算「對上」
  // assigned＝被指派給這一句的所有 ASR 字（含取代），hits＝完全相同的那���
  const byLine = new Map();
  for (const [ai, li, exact] of pairs) {
    const line = LYR[li].line;
    if (!byLine.has(line)) byLine.set(line, {hits: [], assigned: [], text: ''});
    const g = byLine.get(line);
    g.assigned.push({gi: li - offsets[line], ai});
    if (exact) { g.hits.push({gi: li - offsets[line], ai}); g.text += chars[ai].c; }
  }
  for (const g of byLine.values()) {
    g.hits.sort((x, y) => x.gi - y.gi);
    g.assigned.sort((x, y) => x.ai - y.ai);
  }
  return {path: p, chars, segs, byLine};
});

// 句框重疊時互相裁開：後一句的開頭不能被前一句吃掉
function reconcile(spans) {
  for (let i = 0; i < spans.length; i++) {
    const next = spans[i + 1];
    if (next && spans[i].end > next.start - 0.02) spans[i].end = next.start - 0.02;
    const prev = spans[i - 1];
    if (prev && spans[i].start < prev.end + 0.02) spans[i].start = prev.end + 0.02;
  }
  return spans;
}

const out = [];
const report = [];
const proposed = [];

// 第一步：每一句各自挑一個來源（人工覆寫 > 全歌對齊 > 句框均勻）
const picks = [];
for (let li = 0; li < lines.length; li++) {
  const N = lineGlyphs[li].length;
  const pStart = prior[li].start, pEnd = prior[li].end;
  const ov = overrides[String(li)];
  if (ov?.t) {
    const t = ov.t.map(([s, e]) => ({s, e}));
    picks.push({method: 'override', times: t, cover: 1,
      frame: {s: t[0].s, e: t[t.length - 1].e}, note: ov.why || ''});
    continue;
  }
  // 全歌對齊的候選：完全相符的字越多越好
  let best = null;
  for (const run of runs) {
    const g = run.byLine.get(li);
    if (!g || !g.hits.length) continue;
    const cover = g.hits.length / N;
    // 指派給這一句的 ASR 字不能離譜地多（那代表對齊在這裡亂了）
    if (g.assigned.length > N * 2.5) continue;
    // 分段很長時，段內的字時間是攤平出來的，不可信，要扣分
    const segLen = g.hits.reduce((a, h) => Math.max(a, run.chars[h.ai].segE - run.chars[h.ai].segS), 0);
    const score = cover - Math.min(0.30, segLen / 24);
    // 句框：這一句分到的第一個與最後一個 ASR 字
    const fa = run.chars[g.assigned[0].ai], la = run.chars[g.assigned[g.assigned.length - 1].ai];
    const frame = {
      s: fa.segFirst ? fa.segS : fa.s,
      e: la.e,
    };
    if (!best || score > best.score) {
      best = {score, cover, frame, hits: g.hits, chars: run.chars, path: run.path, text: g.text};
    }
  }
  if (best && best.cover >= COVER_MIN) {
    const times = new Array(N).fill(null);
    for (const h of best.hits) {
      const c = best.chars[h.ai];
      times[h.gi] = {s: c.s, e: c.e};
    }
    // 沒對上的字用前後的字夾出來（沒有前後就用旁邊那一個）
    const known = [];
    for (let gi = 0; gi < N; gi++) if (times[gi]) known.push(gi);
    for (let gi = 0; gi < N; gi++) {
      if (times[gi]) continue;
      const before = [...known].reverse().find(k => k < gi);
      const after = known.find(k => k > gi);
      const b = before != null ? times[before].e : null;
      const a = after != null ? times[after].s : null;
      const s = b != null && a != null ? (b + a) / 2 : (b ?? a);
      times[gi] = {s: s ?? best.frame.s, e: s ?? best.frame.s};
    }
    // 句首的字沒對上時，用句框的開頭補（整句的開頭通常就是第一個字的起唱）
    if (times[0].s > best.frame.s + 0.12) times[0].s = best.frame.s;
    picks.push({method: 'asr', times, cover: best.cover, frame: best.frame,
      asr: best.path.split('/').pop(), hits: best.hits.length, text: best.text});
    continue;
  }
  // 對不上就在句框內均勻分配（重複唱段、拖音、口白都屬於這一類）
  const span = Math.max(0.35, pEnd - pStart);
  const times = [];
  for (let gi = 0; gi < N; gi++) {
    times.push({s: +(pStart + span * gi / N).toFixed(3), e: +(pStart + span * (gi + 1) / N).toFixed(3)});
  }
  picks.push({method: 'even', times, cover: best?.cover ?? 0, frame: {s: pStart, e: pEnd}});
}

// 第二步：ASR 的句框跟前後句重疊太多，代表對齊把別句的字吃過來了，改用人工句框
for (let li = 0; li < picks.length; li++) {
  const p = picks[li];
  if (p.method !== 'asr') continue;
  const prev = picks[li - 1], next = picks[li + 1];
  const overlapPrev = prev ? Math.min(p.frame.e, prev.frame.e) - p.frame.s : 0;
  const overlapNext = next ? p.frame.e - Math.max(p.frame.s, next.frame.s) : 0;
  if (overlapPrev > 0.3 || overlapNext > 0.3) {
    const N = lineGlyphs[li].length;
    const pStart = prior[li].start, pEnd = prior[li].end;
    const span = Math.max(0.35, pEnd - pStart);
    const even = [];
    for (let gi = 0; gi < N; gi++) {
      even.push({s: +(pStart + span * gi / N).toFixed(3), e: +(pStart + span * (gi + 1) / N).toFixed(3)});
    }
    picks[li] = {method: 'even', times: even, cover: p.cover, frame: {s: pStart, e: pEnd},
      text: p.text, note: 'ASR 句框與前後句重疊，改用人工句框'};
  }
}

// 第三步：把每句的時間軸整理成單調、不重疊、不出框
function sanitize(times, lo, hi) {
  const t = times.map(x => ({s: +x.s.toFixed(3), e: +x.e.toFixed(3)}));
  for (let i = 0; i < t.length; i++) {
    if (t[i].e < t[i].s) t[i].e = t[i].s;
    if (i > 0 && t[i].s < t[i - 1].e) t[i].s = t[i - 1].e;
    if (t[i].e < t[i].s) t[i].e = t[i].s;
  }
  // 句框外的字：夾回框內
  for (let i = 0; i < t.length; i++) {
    if (t[i].s < lo) { t[i].e = Math.max(t[i].e, lo); t[i].s = lo; }
    if (t[i].e > hi) { t[i].s = Math.min(t[i].s, hi); t[i].e = hi; }
    if (t[i].e < t[i].s) t[i].e = t[i].s;
  }
  for (let i = 1; i < t.length; i++) if (t[i].s < t[i - 1].s) t[i].s = t[i - 1].s;
  return t;
}

for (let li = 0; li < lines.length; li++) {
  const pick = picks[li];
  const pStart = prior[li].start, pEnd = prior[li].end;
  // 句框以對到的區間為準；對不上時就是人工句框
  const lo = Math.max(0, Math.min(pStart, pick.frame.s) - 0.15);
  const hi = Math.min(AUDIO_END, Math.max(pEnd, pick.frame.e) + 0.15);

  const times = sanitize(pick.times, lo, hi);
  const start = times[0].s;
  const end = times[times.length - 1].e;

  // 繁中逐字：中文句與日文句字數不同，按相對位置對應回日文的時間軸。
  const zhTimes = [];
  const M = zhGlyphs[li].length;
  const N = times.length;
  for (let j = 0; j < M; j++) {
    const gi = Math.min(N - 1, Math.floor(j * N / Math.max(1, M)));
    const t = times[gi] || times[times.length - 1];
    zhTimes.push([t.s, t.e]);
  }

  out.push({
    i: li,
    jp: lines[li],
    start,
    end,
    t: times.map(x => [x.s, x.e]),
    z: zhTimes,
  });

  // 建議的句框：起點對齊人聲，訖點沿用「下一句起點」的慣例
  const nextStart = li + 1 < prior.length ? prior[li + 1].start : AUDIO_END;
  const newStart = Math.max(0, Math.min(start, nextStart - 0.1));
  const newEnd = Math.max(newStart + 0.4, Math.min(nextStart - 0.02, Math.max(end + 0.6, pEnd)));
  proposed.push({...prior[li], start: +newStart.toFixed(3), end: +newEnd.toFixed(3), hits: prior[li].hits ?? 0, final: true});
  report.push({
    i: li, jp: lines[li], method: pick.method, cover: +pick.cover.toFixed(3),
    asr: pick.asr || null, text: pick.text || '', frame: [+pick.frame.s.toFixed(2), +pick.frame.e.toFixed(2)],
    priorStart: pStart, priorEnd: pEnd,
    newStart: +newStart.toFixed(2), newEnd: +newEnd.toFixed(2),
    fillStart: +start.toFixed(3), fillEnd: +end.toFixed(3),
    moved: +(newStart - pStart).toFixed(2),
  });
}

fs.writeFileSync(path.join(REF, 'fill-ja.json'), JSON.stringify({
  song: 'FX戦士くるみちゃん',
  note: '逐字填色時間軸：[開始, 唱完]。以 ASR 的詞級時間戳對全歌歌詞做單調對齊，再逐句選出最可靠的一段；少數句子另見 fill-overrides.json。',
  lines: out,
}, null, 1) + '\n');

fs.mkdirSync(path.join(root, '.zwork/fx'), {recursive: true});
fs.writeFileSync(path.join(root, '.zwork/fx/fx-report.json'), JSON.stringify(report, null, 1) + '\n');
fs.writeFileSync(path.join(root, '.zwork/fx/timings-proposed.json'), JSON.stringify(proposed, null, 1) + '\n');

console.log(`${out.length}/${lines.length} 行 → assets/ref/fx/fill-ja.json`);
console.log('  行  方法      覆蓋  句首  舊起點   新起點   位移   舊訖點   新訖點  歌詞');
for (const r of report) {
  const mv = r.moved > 0.02 ? `+${r.moved.toFixed(2)}` : (r.moved < -0.02 ? r.moved.toFixed(2) : '  —');
  console.log(`${String(r.i + 1).padStart(4)} ${r.method.padEnd(8)} ${String(Math.round(r.cover * 100)).padStart(4)}% ` +
    `${r.frame ? String(r.frame[0]).padStart(6) : "      "} ${r.priorStart.toFixed(2).padStart(8)} ${r.newStart.toFixed(2).padStart(8)} ${mv.padStart(7)} ` +
    `${r.priorEnd.toFixed(2).padStart(8)} ${r.newEnd.toFixed(2).padStart(8)}  ${r.jp.slice(0, 20)}`);
}
