#!/usr/bin/env python3
"""檢查 SRT 每一句與 ASR 逐字時間的落差。

把 ASR 的段落依歌詞順序單調指派給每一句（相似度最大化），
再回報每句的起唱差、收尾差。落差大的句子列在最後，方便逐句修。

用法：
    python3 tools/check-srt-timing.py <srt> <asr.json> [--tol 0.4]
"""
import argparse
import difflib
import json
import re
import unicodedata

SKIP = re.compile(r'[\s、。,.!?！？・「」『』()（）\[\]［］《》\-—~〜♪…＆&“”"\'’]')


def norm(t):
    out = []
    for c in t:
        c = unicodedata.normalize('NFKC', c)
        if 'ァ' <= c <= 'ヺ':
            c = chr(ord(c) - 0x60)
        if SKIP.match(c):
            continue
        out.append(c)
    return ''.join(out)


def parse_srt(path):
    cues = []
    for b in open(path, encoding='utf-8').read().strip().split('\n\n'):
        ls = [x for x in b.split('\n') if x.strip()]
        if len(ls) < 2 or '-->' not in ls[1]:
            continue
        m = re.match(r'(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)', ls[1])
        t = [int(x) for x in m.groups()]
        cues.append(dict(start=t[0] * 3600 + t[1] * 60 + t[2] + t[3] / 1000,
                         end=t[4] * 3600 + t[5] * 60 + t[6] + t[7] / 1000, jp=ls[2]))
    return cues


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('srt')
    ap.add_argument('asr')
    ap.add_argument('--tol', type=float, default=0.4)
    args = ap.parse_args()

    cues = parse_srt(args.srt)
    segs = json.load(open(args.asr, encoding='utf-8'))
    n, m = len(cues), len(segs)
    sim = [[difflib.SequenceMatcher(None, norm(c['jp']), norm(s['text'])).ratio() for s in segs] for c in cues]

    NEG = -1e9
    dp = [[NEG] * m for _ in range(n)]
    bk = [[-1] * m for _ in range(n)]
    for j in range(m):
        dp[0][j] = sim[0][j]
    for i in range(1, n):
        best, arg = NEG, -1
        for j in range(m):
            if j and dp[i - 1][j - 1] > best:
                best, arg = dp[i - 1][j - 1], j - 1
            if arg >= 0:
                dp[i][j] = best + sim[i][j]
                bk[i][j] = arg
    j = max(range(m), key=lambda x: dp[n - 1][x])
    assign = [0] * n
    for i in range(n - 1, -1, -1):
        assign[i] = j
        j = bk[i][j]

    bad = []
    print(f'{"#":>2} {"SRT起":>7} {"ASR起":>7} {"差":>6} {"SRT收":>7} {"ASR收":>7} {"差":>6} {"r":>4} 歌詞')
    for i, c in enumerate(cues):
        s = segs[assign[i]]
        ds, de = s['start'] - c['start'], s['end'] - c['end']
        flag = ''
        if abs(ds) > args.tol or abs(de) > args.tol:
            flag = '  <<<'
            bad.append((i + 1, ds, de, sim[i][assign[i]], c['jp']))
        print(f'{i+1:2d} {c["start"]:7.2f} {s["start"]:7.2f} {ds:+6.2f} '
              f'{c["end"]:7.2f} {s["end"]:7.2f} {de:+6.2f} {sim[i][assign[i]]:4.2f} {c["jp"][:24]}{flag}')
    print(f'\n落差 >{args.tol}s 的句子：{len(bad)} 句')
    for i, ds, de, r, jp in bad:
        print(f'  {i:2d} 起 {ds:+.2f}s 收 {de:+.2f}s r={r:.2f} {jp[:30]}')


if __name__ == '__main__':
    main()
