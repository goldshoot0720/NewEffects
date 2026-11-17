#!/usr/bin/env python3
"""用 ASR 的逐字時間把 SRT 每一句重對一次。

作法：每一句各自開一個小視窗（原時間前後各 WIN 秒），把這句歌詞的字與視窗內
ASR 的字做一次 Levenshtein 對齊，起唱取第一個對上的字的詞頭、收尾取最後一個
對上的字的詞尾。逐句開視窗可以避免整首轉錄的漂移累積到後面的句子。

用法：
    python3 tools/retime-from-asr.py <srt> <asr.json> [--out 新檔] [--win 1.5] [--dry]

ASR JSON 格式：[{start, end, text, words:[{w, s, e}]}]（faster-whisper 的 word_timestamps）
"""
import argparse
import difflib
import json
import re
import unicodedata

SKIP = re.compile(r'[\s、。,.!?！？・「」『』()（）\[\]［］《》\-—~〜♪…＆&“”"\'’]')


def norm_char(c):
    c = unicodedata.normalize('NFKC', c)
    if 'ァ' <= c <= 'ヺ':
        c = chr(ord(c) - 0x60)
    return c


def norm_chars(text):
    out = []
    for c in text:
        c = norm_char(c)
        if SKIP.match(c):
            continue
        out.append(c)
    return out


def parse_srt(path):
    cues = []
    for b in open(path, encoding='utf-8').read().strip().split('\n\n'):
        ls = [x for x in b.split('\n') if x.strip()]
        if len(ls) < 2 or '-->' not in ls[1]:
            continue
        m = re.match(r'(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)', ls[1])
        t = [int(x) for x in m.groups()]
        cues.append({
            'start': t[0] * 3600 + t[1] * 60 + t[2] + t[3] / 1000,
            'end': t[4] * 3600 + t[5] * 60 + t[6] + t[7] / 1000,
            'jp': ls[2],
            'zh': ls[3] if len(ls) > 3 else '',
        })
    return cues


def align(lyric, asr):
    """Levenshtein 對齊，回傳對上的 (歌詞索引, ASR 索引)。"""
    n, m = len(asr), len(lyric)
    prev = list(range(m + 1))
    back = []
    for i in range(1, n + 1):
        cur = [i] + [0] * m
        row = bytearray(m + 1)
        a = asr[i - 1]
        for j in range(1, m + 1):
            cost = 0 if a == lyric[j - 1] else 1
            best, step = prev[j - 1] + cost, 0
            if prev[j] + 1 < best:
                best, step = prev[j] + 1, 1
            if cur[j - 1] + 1 < best:
                best, step = cur[j - 1] + 1, 2
            cur[j] = best
            row[j] = step
        back.append(row)
        prev = cur
    i, j = n, m
    pairs = []
    while i > 0 and j > 0:
        step = back[i - 1][j]
        if step == 0:
            if asr[i - 1] == lyric[j - 1]:
                pairs.append((j - 1, i - 1))
            i -= 1
            j -= 1
        elif step == 1:
            i -= 1
        else:
            j -= 1
    pairs.reverse()
    return pairs


def fmt(t):
    ms = int(round(max(0.0, t) * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('srt')
    ap.add_argument('asr')
    ap.add_argument('--out')
    ap.add_argument('--win', type=float, default=1.5)
    ap.add_argument('--lead', type=float, default=0.0, help='起唱提前秒數')
    ap.add_argument('--tail', type=float, default=0.12, help='收尾延後秒數')
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    cues = parse_srt(args.srt)
    segs = json.load(open(args.asr, encoding='utf-8'))
    asr_char, asr_ws, asr_we = [], [], []
    for s in segs:
        for w in s.get('words') or []:
            cs = norm_chars(w['w'])
            span = max(1e-3, w['e'] - w['s'])
            for k, c in enumerate(cs):
                asr_char.append(c)
                asr_ws.append(w['s'] + span * k / len(cs))
                asr_we.append(w['s'] + span * (k + 1) / len(cs))

    print(f'{len(cues)} 句，ASR {len(asr_char)} 字')
    print(f'{"#":>2} {"舊起":>7} {"新起":>7} {"差":>6} {"舊收":>7} {"新收":>7} {"差":>6} {"字數":>4} 歌詞')
    out, prev_end = [], 0.0
    low = []
    for i, cue in enumerate(cues):
        a, b = cue['start'] - args.win, cue['end'] + args.win
        idx = [k for k in range(len(asr_char)) if a <= asr_ws[k] <= b]
        lcs = norm_chars(cue['jp'])
        got = []
        if idx and lcs:
            acs = [asr_char[k] for k in idx]
            for lj, ai in align(lcs, acs):
                if acs[ai] == lcs[lj]:
                    got.append(idx[ai])
        conf = len(got) / max(1, len(lcs)) if lcs else 0.0
        if got:
            new_s, new_e = asr_ws[min(got)], asr_we[max(got)]
        else:
            new_s, new_e = cue['start'], cue['end']
        new_s = max(new_s - args.lead, prev_end + 0.03 if i else 0.0)
        new_e = max(new_e + args.tail, new_s + 0.55)
        prev_end = new_e
        if conf < 0.6:
            low.append(i + 1)
        flag = '  <<<' if (abs(new_s - cue['start']) > .4 or abs(new_e - cue['end']) > .6 or conf < .6) else ''
        print(f'{i+1:2d} {cue["start"]:7.2f} {new_s:7.2f} {new_s-cue["start"]:+6.2f} '
              f'{cue["end"]:7.2f} {new_e:7.2f} {new_e-cue["end"]:+6.2f} {conf*100:3.0f}% {cue["jp"][:26]}{flag}')
        out.append((new_s, new_e, cue['jp'], cue['zh']))

    print(f'\n信心 <60% 的句子：{low if low else "無"}')
    if args.dry:
        return
    path = args.out or args.srt
    with open(path, 'w', encoding='utf-8') as f:
        for i, (s, e, jp, zh) in enumerate(out, 1):
            f.write(f'{i}\n{fmt(s)} --> {fmt(e)}\n{jp}\n{zh}\n\n')
    print(f'寫入 {path}')


if __name__ == '__main__':
    main()
