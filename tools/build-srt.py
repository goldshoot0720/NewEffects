#!/usr/bin/env python3
"""把 align-lyrics.py 的時間軸寫成中日雙語 SRT（第一行日文、第二行繁中）。"""
import json
import sys

times_path, zh_path, out_path = sys.argv[1:4]
data = json.load(open(times_path))
zh = [l.rstrip('\n') for l in open(zh_path) if l.strip()]
assert len(zh) == len(data), f'翻譯 {len(zh)} 行，歌詞 {len(data)} 行'

# 每句的結束時間：下一句開始前收尾，但最多延到最後一個字之後 1.1 秒，
# 免得間奏時字幕停在畫面上太久。
# 已經對過畫面的時間軸（timings-ja.json 標了 final）就直接用，不再提前、不再延長。
for d in data:
    if d.get('final'):
        continue
    d['start'] = max(0.0, d['start'] - 0.18)

for i, d in enumerate(data):
    if d.get('final'):
        continue
    nxt = data[i + 1]['start'] if i + 1 < len(data) else d['end'] + 1.0
    d['end'] = min(nxt - 0.05, d['end'] + 1.1)
    if d['end'] <= d['start'] + 0.4:
        d['end'] = d['start'] + 0.9


def ts(t):
    ms = int(round(t * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


with open(out_path, 'w') as f:
    for i, d in enumerate(data):
        f.write(f'{i + 1}\n{ts(d["start"])} --> {ts(d["end"])}\n{d["jp"]}\n{zh[i]}\n\n')
print(f'{len(data)} 句 → {out_path}')
