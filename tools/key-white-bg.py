#!/usr/bin/env python3
"""把 imagegen 畫出來的淺色底（純白或兩色淺灰的假棋盤格）用連通填色換成真透明 alpha。
從四個角落取樣底色，只填掉與邊界相連的底色像素，被深色線稿包住的白襯衫、白襪不會被挖掉。
用法：python3 tools/key-white-bg.py <輸入.png> <輸出.png> [容差]"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
tol = int(sys.argv[3]) if len(sys.argv) > 3 else 16

im = Image.open(src).convert('RGB')
rgb = np.asarray(im).astype(np.int16)
h, w = rgb.shape[:2]

# 棋盤格的兩個色調：從左上角與右上一小塊取中位數
def tone(x0, x1, y0, y1):
    patch = rgb[y0:y1, x0:x1].reshape(-1, 3)
    return np.median(patch, axis=0)

tones = [tone(0, 60, 0, 60), tone(w - 60, w, 0, 60), tone(0, 60, h - 60, h), tone(w - 60, w, h - 60, h)]
print('棋盤色', [list(map(int, t)) for t in tones])

cand = np.zeros((h, w), bool)
for t in tones:
    cand |= (np.abs(rgb - t).max(axis=2) <= tol)

# 從邊界往內填，只走「像棋盤格」的像素，避免挖掉角色身上的白色
bg = np.zeros((h, w), bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if cand[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if cand[y, x] and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True
            q.append((ny, nx))

alpha = np.where(bg, 0, 255).astype(np.uint8)
a = Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(0.8))
# 收一點邊，讓 1 像素的淺灰邊不會留下光暈
arr = np.asarray(a).astype(np.float32)
arr = np.clip((arr - 40) / 200 * 255, 0, 255)
out = np.dstack([rgb.astype(np.uint8), arr.astype(np.uint8)])
Image.fromarray(out, 'RGBA').save(dst)
print('透明比例', round(bg.mean(), 3), '->', dst)
