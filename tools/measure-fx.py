#!/usr/bin/env python3
"""量 FX戦士くるみちゃん 每一句的起唱／唱完，以及每個字唱到的時間。

做法
----
1. 用 librosa 的 REPET-SIM（nn_filter）把重複的伴奏壓掉，留下前景（主唱與不重複的裝飾）。
2. 前景 250–5000 Hz 的能量包絡上找音節峰（prominence 4 dB、間隔至少 70 ms）。
3. 一句的唱完時間：從下一句起點往回找最後一段還在唱的地方（能量高於該句 75 百分位
   再低 25 dB，且持續 60 ms 以上）。量到的結束若離字幕結尾超過 0.8 秒，視為量錯，
   保留原本的字幕結尾。
4. 每個字配一個音節峰；峰數與字數差超過 1.6 倍就退回「依字寬平分」，
   避免把伴奏的打點當成字。句中停頓（相鄰峰差 > 0.25 秒）會保留，填色會停在那裡。

輸出
----
assets/ref/fx/fill-ja.json   每個字的 [起唱, 唱完]
assets/ref/fx/timings-ja.json 每句的起唱與唱完（final）

用法：python3 tools/measure-fx.py
"""
import json
import os
import re
import subprocess
import unicodedata

import librosa
import numpy as np
from scipy.signal import find_peaks

SR, HOP, NFFT = 22050, 256, 2048
AUDIO = 'FX戦士くるみちゃん.mp3'
FFMPEG = '/opt/homebrew/bin/ffmpeg'
CACHE = '/tmp/fx-envelope.npz'

WEIGHT = {'ぁ': 1.8, 'ぃ': 1.8, 'ぅ': 1.8, 'ぇ': 1.8, 'ぉ': 1.8, 'ゃ': .6, 'ゅ': .6,
          'ょ': .6, 'っ': .5, 'ッ': .5, 'ん': .9, 'ン': .9}


def envelope():
    if os.path.exists(CACHE):
        z = np.load(CACHE)
        return z['E'], z['T']
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', AUDIO, '-ac', '1', '-ar', str(SR),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32)
    S_full, _ = librosa.magphase(librosa.stft(y, n_fft=NFFT, hop_length=HOP))
    S_filter = librosa.decompose.nn_filter(S_full, aggregate=np.median, metric='cosine',
                                           width=int(librosa.time_to_frames(2, sr=SR)))
    S_filter = np.minimum(S_full, S_filter)
    mask = librosa.util.softmask(S_full - S_filter, 10 * S_filter, power=2)
    f = librosa.fft_frequencies(sr=SR, n_fft=NFFT)
    band = (f >= 250) & (f <= 5000)
    e = librosa.power_to_db(((mask * S_full)[band] ** 2).mean(0) + 1e-12)
    e = np.convolve(e, np.ones(3) / 3, 'same')
    t = librosa.frames_to_time(np.arange(len(e)), sr=SR, hop_length=HOP)
    np.savez(CACHE, E=e, T=t)
    return e, t


def sung_chars(text):
    """會唱出來的字：空白、標點與符號（\p{P}\p{S}）不算，跟 v2.html 的 LyricText.clean 一致。"""
    return [c for c in text
            if not c.isspace() and unicodedata.category(c)[0] not in 'PS']


def peaks_between(E, T, a, b):
    i0 = int(np.searchsorted(T, a))
    i1 = int(np.searchsorted(T, b))
    if i1 - i0 < 4:
        return []
    pk, _ = find_peaks(E[i0:i1], prominence=4.0, distance=int(0.07 / (HOP / SR)))
    return [i0 + int(p) for p in pk]


def sung_end(E, T, start, window_end):
    i0 = int(np.searchsorted(T, start + 0.35))
    i1 = int(np.searchsorted(T, window_end))
    if i1 - i0 < 4:
        return None
    seg = E[i0:i1]
    thr = np.percentile(seg, 75) - 25
    on = seg > thr
    # 最後一段連續 60 ms 以上還在高於門檻的地方
    last = None
    run = 0
    for j in range(len(on) - 1, -1, -1):
        if on[j]:
            run += 1
            if run >= max(2, int(0.06 / (HOP / SR))):
                last = i0 + j
                break
        else:
            run = 0
    return None if last is None else float(T[last])


def spread(chars, peak_times, start, end):
    """把字配到音節峰；峰太少就一個峰配多字，峰太多就等距挑峰。"""
    n, m = len(chars), len(peak_times)
    if m == 0 or m > n * 1.6 or m < n * 0.55:
        w = [WEIGHT.get(c, 1.0) for c in chars]
        total = sum(w)
        out, cur, acc = [], start, 0.0
        for x in w:
            acc += x
            nxt = start + (end - start) * acc / total
            out.append([round(cur, 3), round(nxt, 3)])
            cur = nxt
        return out
    if n > m:
        # 每個峰先配一個字，多出來的字塞進最長的那一段，段內再依字重切。
        counts = [1] * m
        for _ in range(n - m):
            k = max(range(m), key=lambda q: ((peak_times[q + 1] if q + 1 < m else end)
                                             - peak_times[q]) / counts[q])
            counts[k] += 1
        out, at = [], 0
        for k in range(m):
            a = peak_times[k]
            b = peak_times[k + 1] if k + 1 < m else end
            w = [WEIGHT.get(c, 1.0) for c in chars[at:at + counts[k]]]
            total, cur = sum(w), a
            for x in w:
                nxt = cur + (b - a) * x / total
                out.append([round(cur, 3), round(nxt, 3)])
                cur = nxt
            at += counts[k]
    else:
        # 峰比字多：把峰依時間順序分成 n 組，每組取平均，避免跳過太多峰造成長空檔。
        slots = [float(np.mean(peak_times[j * m // n:(j + 1) * m // n] or [peak_times[-1]]))
                 for j in range(n)]
        out = []
        for k, s in enumerate(slots):
            e = slots[k + 1] if k + 1 < len(slots) else end
            if e - s < 0.045:
                e = s + 0.045
            out.append([round(min(s, end), 3), round(min(e, end), 3)])
    out[0][0] = round(min(out[0][0], start + 0.03), 3)
    out[-1][1] = round(max(out[-1][1], min(end, out[-1][0] + 0.045)), 3)
    return out


def srt_starts(path):
    """讀 SRT 的每句起點，用來確認 timings 沒有被別的程式改過。"""
    out = []
    for block in open(path, encoding='utf-8').read().strip().split('\n\n'):
        ls = block.split('\n')
        m = re.match(r'(\d+):(\d+):(\d+)[,.](\d+)', ls[1])
        if not m:
            continue
        h, mi, s, ms = (int(x) for x in m.groups())
        out.append(h * 3600 + mi * 60 + s + ms / 1000)
    return out


def main():
    E, T = envelope()
    timings = json.load(open('assets/ref/fx/timings-ja.json'))
    zh = [l.rstrip('\n') for l in open('assets/ref/fx/lyrics-zh.txt') if l.strip()]
    starts = srt_starts('FX戦士くるみちゃん.srt')
    if len(starts) == len(timings):
        drift = max(abs(a - b['start']) for a, b in zip(starts, timings))
        assert drift < 0.05, f'SRT 與 timings 的起點差了 {drift:.2f} 秒，請先確認時間軸沒被改過'
    fill = {'song': 'FX戦士くるみちゃん',
            'note': '每一句量到的起唱與唱完（前景音訊的音節峰）；t 是每個字（空白與標點不算）的起唱與唱完。由 tools/measure-fx.py 產生，円 的長音照實際唱法切到 1:51.55。',
            'lines': []}
    for i, d in enumerate(timings):
        window_end = timings[i + 1]['start'] - 0.03 if i + 1 < len(timings) else 203.70
        measured = sung_end(E, T, d['start'], window_end)
        old_end = d['end']
        if (measured is None or measured < d['start'] + 0.45
                or measured > old_end + 0.20 or old_end - measured > 0.55):
            end = old_end
            note = '保留'
        else:
            end = round(measured + 0.03, 3)
            note = f'{end - old_end:+.2f}'
        end = min(max(end, d['start'] + 0.4), window_end)
        pk = peaks_between(E, T, d['start'] - 0.02, end + 0.05)
        chars = sung_chars(d['jp'])
        times = spread(chars, [float(T[p]) for p in pk], d['start'], end)
        if i == 36 and len(chars) == 10:
            # 「円」是拉長的長音（到 1:51.55 才換氣）；顫音會被當成音節峰，這裡照實際唱法切成一段。
            head = [[109.95, 111.55]]
            tail, cur = [], 111.55
            for _ in range(9):
                nxt = cur + (d['end'] - 111.55) / 9
                tail.append([round(cur, 3), round(nxt, 3)])
                cur = nxt
            times = head + tail
        d['end'] = round(end, 3)
        entry = {'i': i, 'jp': d['jp'], 'start': round(d['start'], 3), 'end': d['end'], 't': times}
        if i < len(zh):
            entry['z'] = spread(sung_chars(zh[i]), [float(T[p]) for p in pk], d['start'], end)
        fill['lines'].append(entry)
        print(f"{i:2d} {d['start']:7.2f}-{d['end']:7.2f} ({note:>6}) 字{len(chars):2d} "
              f"峰{len([p for p in pk if T[p] >= d['start']]):2d}  {d['jp'][:24]}")
    json.dump(fill, open('assets/ref/fx/fill-ja.json', 'w'), ensure_ascii=False, indent=1)
    with open('assets/ref/fx/timings-ja.json', 'w') as f:
        json.dump(timings, f, ensure_ascii=False, indent=1)
    print('寫入 fill-ja.json、timings-ja.json')


if __name__ == '__main__':
    main()
