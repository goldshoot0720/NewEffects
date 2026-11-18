#!/usr/bin/env node
// 檢查 FX戦士くるみちゃん 的逐字填色時間能不能真的套進 PV：
// 用 pv.js 的斷詞與 attachFill 規則跑一次，確認每一句都拿到 fill、字數對得上、時間往前走。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUNCT = '、。・「」『』…,.';
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
    else if(PUNCT.includes(c) || /^[!?！？\-_~]+$/.test(c)) out.push({t: c, bk, w: .3, punct: true});
    else out.push({t: c, bk, w: 1});
  }
  return out;
}

function attachFill(units, times, total){
  let k = 0, w = 0;
  const fill = [];
  for(const u of units){
    if(u.sp){ w += u.w; continue; }
    const cs = [...u.t];
    const per = u.w / cs.length;
    for(const ch of cs){
      w += per;
      if(SKIP_FILL.test(ch)) continue;
      if(k >= times.length) return null;
      const [s, e] = times[k++];
      fill.push({w, s, e});
    }
  }
  if(k !== times.length) return null;
  if(fill.length) fill[fill.length - 1].w = total;
  return fill;
}

const srt = fs.readFileSync(path.join(root, 'FX戦士くるみちゃん.srt'), 'utf8');
const cues = [];
for(const block of srt.trim().split(/\n\n/)){
  const ls = block.split('\n');
  const m = /(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/.exec(ls[1]);
  const t = [1, 2, 3, 4, 5, 6, 7, 8].map((x, i) => +m[x]);
  cues.push({
    start: t[0]*3600 + t[1]*60 + t[2] + t[3]/1000,
    end: t[4]*3600 + t[5]*60 + t[6] + t[7]/1000,
    jp: ls[2], zh: ls[3] || '',
  });
}

const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/ref/fx/fill-ja.json'), 'utf8'));
const timings = JSON.parse(fs.readFileSync(path.join(root, 'assets/ref/fx/timings-ja.json'), 'utf8'));
assert.equal(data.lines.length, cues.length);
assert.equal(timings.length, cues.length);
assert.equal(cues.length, 60);
let ok = 0, bad = [];
for(const line of data.lines){
  const c = cues[line.i];
  if(!c){ bad.push(`${line.i}: 沒有這句字幕`); continue; }
  const source = timings[line.i];
  assert.equal(line.jp, source.jp);
  assert.equal(c.jp, source.jp);
  for (const field of ['start', 'end']) {
    assert.ok(Math.abs(c[field] - source[field]) < .0011, `${line.i}: SRT differs from timings`);
    assert.ok(Math.abs(line[field] - source[field]) < .0011, `${line.i}: fill differs from timings`);
  }
  assert.ok(c.end > c.start);
  if (line.i) assert.ok(c.start >= cues[line.i - 1].end, `${line.i}: overlapping cues`);
  for (const [s, e] of [...line.t, ...(line.z || [])]) {
    assert.ok(Number.isFinite(s) && Number.isFinite(e) && s <= e);
    assert.ok(s >= c.start - .001 && e <= c.end + .001);
  }
  assert.equal(line.t[0][0], line.start);
  assert.equal(line.t.at(-1)[1], line.end);
  const ju = tokenize(c.jp);
  const jW = ju.reduce((a, u) => a + u.w, 0);
  const fill = attachFill(ju, line.t, jW);
  if(!fill){ bad.push(`${line.i}: 字數對不上（${line.t.length} 個時間 / ${c.jp}`); continue; }
  for(let i = 1; i < fill.length; i++){
    if(fill[i].s < fill[i-1].s - 0.001) bad.push(`${line.i}: 第 ${i} 個字的時間往回跑`);
    if(fill[i].s < fill[i-1].e - 0.001) bad.push(`${line.i}: 第 ${i} 個字和前一個字重疊`);
  }
  if(fill[fill.length-1].e > c.end + 0.35) bad.push(`${line.i}: 最後一個字超出字幕結尾`);
  if(fill[0].s < c.start - 0.2) bad.push(`${line.i}: 第一個字早於字幕起點`);
  if(!line.z) bad.push(`${line.i}: 少了中文的逐字時間`);
  ok++;
}
console.log(`${ok}/${data.lines.length} 句套得上逐字填色`);
if(bad.length){
  console.log('有問題：');
  for(const b of bad.slice(0, 20)) console.log('  ' + b);
  process.exit(1);
}
console.log('每一句的字數、順序與時間範圍都對得上');
// Regression anchors from independent audio windows: include opening calls
// and keep the English tail active after the Japanese melody has finished.
assert.equal(cues[49].start, 158.52);
assert.equal(cues[51].start, 164.44);
assert.ok(data.lines[46].t.at(-1)[1] > 155);
assert.ok(cues[55].start > 178.5);
assert.ok(cues[58].start > 193);
console.log('SRT、逐字填色與時間軸一致，後段喊聲及英文尾段回歸檢查通過');
