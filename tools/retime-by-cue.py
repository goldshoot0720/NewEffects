#!/usr/bin/env python3
"""逐句開視窗、帶歌詞提示跑 whisper-cli 取 token 時間，算出每句真正的起唱與收尾。

每句：視窗 = 原時間前後 PAD 秒 → whisper-cli（ja, DTW large.v3.turbo, prompt=該句歌詞）
→ 取回 token 的文字與起訖 → 與該句歌詞做 Levenshtein 對齊 → 起唱取第一個對上的字的詞頭、
收尾取最後一個對上的字的詞尾。對不上的字不影響判定，只影響信心值。

用法：
    python3 tools/retime-by-cue.py <srt> <audio> [--out json] [--pad 2.5]
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata

FFMPEG = '/opt/homebrew/bin/ffmpeg'
WCLI = '/opt/homebrew/bin/whisper-cli'
AUDIO = None
MODEL = os.path.expanduser('~/.cache/whisper-models/ggml-large-v3-turbo-q8_0.bin')
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
            'jp': ls[2], 'zh': ls[3] if len(ls) > 3 else '',
        })
    return cues


def align(lyric, asr):
    """回傳對上的 (歌詞索引, ASR 索引)。"""
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
            i -= 1; j -= 1
        elif step == 1:
            i -= 1
        else:
            j -= 1
    pairs.reverse()
    return pairs


def probe(a, b, prompt):
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'w.wav')
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-ss', f'{a}', '-t', f'{b - a}',
                        '-i', AUDIO, '-ac', '1', '-ar', '16000', wav], check=True)
        out = os.path.join(d, 'o')
        subprocess.run([WCLI, '-m', MODEL, '-f', wav, '-l', 'ja', '-ojf', '-np',
                        '-dtw', 'large.v3.turbo', '--prompt', prompt, '-of', out],
                       check=True, capture_output=True)
        j = json.load(open(out + '.json', encoding='utf-8'))
    segs = []
    for s in j.get('transcription', []):
        toks = []
        for t in s.get('tokens', []):
            txt = (t.get('text') or '').strip()
            if not txt:
                continue
            o = t.get('offsets') or {}
            toks.append({'w': txt, 's': a + o.get('from', 0) / 1000, 'e': a + o.get('to', 0) / 1000})
        if toks:
            segs.append({'text': (s.get('text') or '').strip(), 'tok': toks})
    return segs


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('srt')
    ap.add_argument('audio')
    ap.add_argument('--out', default='/tmp/retime-by-cue.json')
    ap.add_argument('--pad', type=float, default=2.5)
    ap.add_argument('--only', default='')
    args = ap.parse_args()
    AUDIO = args.audio
    cues = parse_srt(args.srt)
    only = set(int(x) for x in args.only.split(',') if x.strip())
    results = []
    for i, c in enumerate(cues):
        if only and (i + 1) not in only:
            continue
        a = max(0.0, c['start'] - args.pad)
        b = c['end'] + args.pad
        try:
            segs = probe(a, b, c['jp'])
        except Exception as e:
            print(f'{i+1:2d} 失敗 {e}', flush=True)
            continue
        lcs = norm_chars(c['jp'])
        best = None
        for s in segs:
            acs = []
            spans = []
            for t in s['tok']:
                cs = norm_chars(t['w'])
                for k, ch in enumerate(cs):
                    acs.append(ch)
                    spans.append((t['s'] + (t['e'] - t['s']) * k / max(1, len(cs)),
                                  t['s'] + (t['e'] - t['s']) * (k + 1) / max(1, len(cs))))
            pairs = align(lcs, acs) if acs else []
            hit = [(lj, spans[ai]) for lj, ai in pairs if acs[ai] == lcs[lj]]
            r = difflib.SequenceMatcher(None, ''.join(lcs), ''.join(acs)).ratio()
            if best is None or len(hit) > len(best[1]):
                best = (s, hit, r)
        if best is None:
            results.append({'i': i + 1, 'jp': c['jp'], 'start': c['start'], 'end': c['end'], 'conf': 0.0})
            continue
        s, hit, r = best
        if hit:
            new_s = min(h[1][0] for h in hit)
            new_e = max(h[1][1] for h in hit)
        else:
            new_s, new_e = c['start'], c['end']
        conf = len(hit) / max(1, len(lcs))
        results.append({'i': i + 1, 'jp': c['jp'], 'zh': c['zh'], 'old_start': c['start'], 'old_end': c['end'],
                        'start': round(new_s, 3), 'end': round(new_e, 3), 'conf': round(conf, 3),
                        'asr': s['text']})
        print(f"{i+1:2d} {c['start']:7.2f}-{c['end']:7.2f} -> {new_s:7.2f}-{new_e:7.2f} "
              f"conf={conf:.2f} r={r:.2f}  {c['jp'][:26]}", flush=True)
    json.dump(results, open(args.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'→ {args.out}')
