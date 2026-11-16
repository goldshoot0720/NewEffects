#!/usr/bin/env python3
"""轉錄 DAYS! 取得詞級時間戳，供 tools/align-lyrics.py 對齊歌詞。

先以 ffmpeg 轉成 16 kHz 單聲道 WAV，再用 wave 讀進來傳 float32 陣列，
避開 PyAV 版本差異造成的 decode_audio 錯誤。
"""
import json
import subprocess
import sys
import wave

import numpy as np
from faster_whisper import WhisperModel

audio, out = sys.argv[1:3]
wav = '/tmp/days-asr.wav'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', audio, '-ac', '1',
                '-ar', '16000', '-f', 'wav', wav], check=True)
with wave.open(wav, 'rb') as w:
    pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
samples = pcm.astype(np.float32) / 32768.0

model = WhisperModel('medium', device='cpu', compute_type='int8')
segments, info = model.transcribe(samples, language='ja', word_timestamps=True,
                                  beam_size=5, vad_filter=False)
rows = []
for seg in segments:
    words = [{'w': w.word, 's': round(w.start, 3), 'e': round(w.end, 3)}
             for w in (seg.words or [])]
    rows.append({'s': round(seg.start, 3), 'e': round(seg.end, 3),
                 'text': seg.text.strip(), 'words': words})
    print(f"[{seg.start:7.2f} - {seg.end:7.2f}] {seg.text.strip()}", flush=True)
json.dump(rows, open(out, 'w'), ensure_ascii=False, indent=1)
print(f'{len(rows)} segments -> {out}')
