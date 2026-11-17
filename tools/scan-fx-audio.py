#!/usr/bin/env python3
"""滑動掃描：把某個時間區間切成小視窗逐一獨立辨識，畫出「這段時間裡唱的是什麼」。

用法：
    python3 tools/scan-fx-audio.py <起> <訖> [--win 2.5] [--step 1.0]
"""
import argparse
import os
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'FX戦士くるみちゃん.mp3')
FFMPEG = '/opt/homebrew/bin/ffmpeg'
MODEL = 'mobiuslabsgmbh/faster-whisper-large-v3-turbo'


def clip(start, end, sr=16000):
    raw = subprocess.run([FFMPEG, '-v', 'quiet', '-ss', f'{start:.3f}', '-to', f'{end:.3f}',
                          '-i', AUDIO, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('start', type=float)
    ap.add_argument('end', type=float)
    ap.add_argument('--win', type=float, default=2.5)
    ap.add_argument('--step', type=float, default=1.0)
    a = ap.parse_args()

    model = WhisperModel(MODEL, device='cpu', compute_type='int8')
    t = a.start
    while t < a.end:
        e = min(a.end, t + a.win)
        segs, _ = model.transcribe(clip(t, e), language='ja', beam_size=1,
                                   vad_filter=False, condition_on_previous_text=False)
        txt = ''.join(s.text for s in segs).strip()
        print(f'[{t:7.2f} {e:7.2f}] {txt}')
        sys.stdout.flush()
        t += a.step


main()
