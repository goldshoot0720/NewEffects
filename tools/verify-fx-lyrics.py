#!/usr/bin/env python3
"""逐句驗證 FX戦士くるみちゃん 的字幕有沒有對到人聲。

做法：把每一句的時間框單獨切出來，用 ASR 獨立辨識這一小段，再跟這句歌詞比對。
切出來的片段沒有前後文，辨識到的文字就是要證明「這個時間框裡唱的是哪一句」。

用法：
    python3 tools/verify-fx-lyrics.py [timings.json]
    # timings.json 省略時用 .zwork/fx/timings-proposed.json
"""
import difflib
import json
import os
import re
import subprocess
import sys
import unicodedata

import numpy as np
from faster_whisper import WhisperModel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio', 'FX戦士くるみちゃん.mp3')
FFMPEG = '/opt/homebrew/bin/ffmpeg'
MODEL = 'mobiuslabsgmbh/faster-whisper-large-v3-turbo'
SKIP = re.compile(r'[\s、。,.!?！？☆★…「」『』()（）\[\]［］《》\-—~〜♪＆&・“”"\'’]')


def norm_char(c):
    c = unicodedata.normalize('NFKC', c)
    if 'ァ' <= c <= 'ヺ':
        c = chr(ord(c) - 0x60)
    return c


def norm(text):
    return ''.join(norm_char(c) for c in text if not SKIP.match(norm_char(c)))


def clip(start, end, sr=16000):
    raw = subprocess.run([FFMPEG, '-v', 'quiet', '-ss', f'{start:.3f}', '-to', f'{end:.3f}',
                          '-i', AUDIO, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.zwork/fx/timings-proposed.json')
    timings = json.load(open(path, encoding='utf-8'))
    lyrics = [l.replace('\r', '') for l in
              open(os.path.join(ROOT, 'assets/ref/fx/lyrics-ja.txt'), encoding='utf-8').read().split('\n')]
    lyrics = [l for l in lyrics if l.strip()]
    normed = [norm(l) for l in lyrics]

    model = WhisperModel(MODEL, device='cpu', compute_type='int8')
    bad = 0
    print(f'逐句獨立辨識驗證：{os.path.relpath(path, ROOT)}\n')
    for t in timings:
        i = t['i']
        audio = clip(max(0, t['start'] - 0.30), t['end'] + 0.30)
        segs, _ = model.transcribe(audio, language='ja', beam_size=1, word_timestamps=True,
                                   vad_filter=False, condition_on_previous_text=False)
        heard = norm(''.join(s.text for s in segs))
        ratios = [difflib.SequenceMatcher(None, normed[k], heard).ratio() for k in range(len(normed))]
        best = max(range(len(ratios)), key=lambda k: ratios[k])
        score = ratios[i]
        mark = '✅' if best == i and score >= 0.45 else ('⚠️ ' if best == i else '❌')
        if mark != '✅':
            bad += 1
        print(f'{mark} 行{i + 1:>3} [{t["start"]:7.2f} {t["end"]:7.2f}] 相似度 {score * 100:5.1f}%'
              f'  最像第{best + 1}行 ({ratios[best] * 100:.0f}%)')
        print(f'      歌詞: {lyrics[i]}')
        print(f'      聽到: {heard}')
    print(f'\n{len(timings) - bad}/{len(timings)} 句對得上')
    return 1 if bad else 0


sys.exit(main())
