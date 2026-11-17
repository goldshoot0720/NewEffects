#!/usr/bin/env node
// 檢查 assets/ref/fx/fill-ja.json 的時間軸能不能被 pv.js 的 attachFill 接受。
//
// pv.js 的 attachFill 規定：時間軸的長度必須剛好等於斷詞後的非空白字數，
// 少一個或多一個都會整句 return null（寧可退回原本的能量估算，也不填錯位置）。
// 所以這裡逐句核對日文與繁中的字數，並把每句的時間軸攤開來看有沒有異常
// （時間倒退、負長度、超出音訊長度）。
//
// 用法：node tools/check-fx-fill.mjs [音訊長度秒]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(root, 'assets/ref/fx');
const dur = Number(process.argv[2] || 203.75);

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
const glyphCount = text => tokenize(LyricText.clean(text)).filter(u => !u.sp)
  .reduce((a, u) => a + [...u.t].length, 0);

const fill = JSON.parse(fs.readFileSync(path.join(REF, 'fill-ja.json'), 'utf8'));
const zh = fs.readFileSync(path.join(REF, 'lyrics-zh.txt'), 'utf8').split('\n').filter(l => l.trim());

let bad = 0;
console.log('  行  日文字  日文t  繁中字  繁中z  起始     結束     備註');
for (const L of fill.lines) {
  const nj = glyphCount(L.jp);
  const nz = glyphCount(zh[L.i] || '');
  const notes = [];
  if (L.t.length !== nj) { notes.push(`日文字數不符 ${L.t.length}≠${nj}`); bad++; }
  if (L.z && L.z.length !== nz) { notes.push(`繁中字數不符 ${L.z.length}≠${nz}`); bad++; }
  for (let i = 1; i < L.t.length; i++) {
    if (L.t[i][0] < L.t[i - 1][0] - 1e-6) { notes.push(`第${i + 1}字時間倒退`); bad++; break; }
  }
  for (const [s, e] of L.t) {
    if (e < s - 1e-6) { notes.push('負長度'); bad++; break; }
    if (s < -1e-6 || e > dur + 1) { notes.push('超出音訊長度'); bad++; break; }
  }
  console.log(`${String(L.i + 1).padStart(4)} ${String(nj).padStart(6)} ${String(L.t.length).padStart(6)} ` +
    `${String(nz).padStart(7)} ${String((L.z || []).length).padStart(6)} ` +
    `${L.start.toFixed(2).padStart(8)} ${L.end.toFixed(2).padStart(8)}  ${notes.join('；')}`);
}
console.log(bad ? `\n❌ ${bad} 個問題` : `\n✅ 全部 ${fill.lines.length} 句的字數與時間軸都對得上`);
process.exit(bad ? 1 : 0);
