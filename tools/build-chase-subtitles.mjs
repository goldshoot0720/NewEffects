#!/usr/bin/env node
// 「Chase the Light!」日中雙語字幕。
// 這首是高速電子金屬，英文段落 ASR 幾乎辨識不出來，時間軸改用段落錨點＋字數比例分配：
//   30.00 進歌、39.70 英文 A 段、66.18 A 段收、69.80 第二個 A 段、76.38 收、
//   78.20 日文副歌、98.12 收；98.12–151.70 是嘶吼／間奏，不掛字幕；
//   151.70 英文 B 段、216.34 收。
// 段落內的句子按字數比例分配，整體平滑；若要逐句微調，改這張表再重跑即可。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'Chase the Light!.srt');

// 固定錨點：[起, 訖, 原文, 繁中]
const FIXED = [
  [30.00, 32.37, '手を伸ばしたのにまだ届かない', '伸出了手 卻還是搆不著'],
  [32.37, 34.74, '夜ごと正論嫌になる', '每個夜晚 都厭倦了那些大道理'],
  [34.74, 39.70, '便利な言い訳を這い回る衝動', '四處爬竄的衝動 找著方便的藉口'],
  [78.20, 81.56, '絡まる意図ほどいた時に', '在解開那些糾纏的意圖時'],
  [81.56, 83.90, '笑いたいから', '我想笑'],
  [83.90, 88.64, '迷える日々も確かめる', '迷惘的日子也要好好確認'],
  [88.64, 91.74, '探せなくて目を逸らすけど', '找不到 所以別開了眼'],
  [91.74, 94.93, '君なら出来る', '你做得到的'],
  [94.93, 98.12, 'その手を伸ばせ', '伸出那隻手吧'],
  // 2026-11-21 independent English clip (49–61s) confirms these calls.
  [55.18, 56.56, 'Take it easy', '放輕鬆'],
  [56.56, 57.98, "It's gonna be alright", '一切都會好的'],
];

// 區段：[起, 訖, [[原文, 繁中], …]]，段內按字數比例分配
const SPANS = [
  [39.70, 55.18, [
    ['(From) time to time,', '偶爾'],
    ['I feel like running away', '我會想逃開'],
    ['Trying to face away', '試著別過臉'],
    ['from this situation', '不去面對這一切'],
    ['But for me to live', '但為了活下去'],
    ['I have to decide my own way', '我得決定自己的路'],
  ]],
  [57.98, 66.18, [
    ['Have faith and trust what a person you are', '相信自己 相信你是什麼樣的人'],
    ['In times when you feel lost believe yourself', '迷惘的時候 就相信你自己'],
    ['Overcome all the enemies', '跨越所有的敵人'],
    ["Are you ready? Let's go!!", '準備好了嗎？走吧！！'],
  ]],
  [69.80, 76.38, [
    ['Chill out and be easygoing sometimes', '偶爾也放鬆一下 隨性一點'],
    ["That was what you've told me in bad times", '那是你在難熬的時候對我說的話'],
  ]],
  [151.70, 216.34, [
    ['Fog hanged over', '濃霧籠罩'],
    ['Making me blind (Making me blind)', '讓我什麼都看不見'],
    ['I cut through the air with my hand', '我用手劃破空氣'],
    ['And then I realized', '然後我明白了'],
    ['I ran into a wonderland filled with mysteries', '我闖進了一座充滿謎團的仙境'],
    ['I knew if I kept running without stopping', '我知道只要不停下腳步'],
    ['I will someday find the way out from here', '總有一天能找到離開這裡的路'],
    ['Take a look around', '看看四周'],
    ['Each one of us shares different thoughts and features', '我們每個人都有不同的想法與模樣'],
    ["No one is the same and that's what makes us the only special", '沒有人是一樣的 這正是我們獨特的地方'],
    ['Spring has arrived', '春天來了'],
    ['Season of new life has come', '新生命的季節到了'],
    ['そう 透明で まばゆい 明日へ', '是啊 走向透明而耀眼的明天'],
    ['We all face and go through tough moments', '我們都會面對並熬過艱難的時刻'],
    ['But with the help of others', '但有了別人的幫助'],
    ['we gain the power to stand up again', '我們就能再次站起來'],
  ]],
];

const rows = [...FIXED];
for (const [a, b, lines] of SPANS) {
  const weight = lines.map(([ja]) => ja.replace(/\s/g, '').length);
  const total = weight.reduce((x, y) => x + y, 0);
  let cur = a;
  lines.forEach(([ja, zh], i) => {
    const next = i === lines.length - 1 ? b : cur + (b - a) * weight[i] / total;
    rows.push([+cur.toFixed(2), +next.toFixed(2), ja, zh]);
    cur = next;
  });
}
rows.sort((x, y) => x[0] - y[0]);

const stamp = t => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60, f = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(f).padStart(3, '0')}`;
};

const out = rows.map(([a, b, ja, zh], i) =>
  `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${ja}\n${zh}\n`).join('\n');
fs.writeFileSync(OUT, out);
console.log(`${rows.length} 句 → ${path.relative(root, OUT)}`);
