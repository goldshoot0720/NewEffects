#!/usr/bin/env python3
# マトリョーシカ：黑底的九人官方立繪（帶名牌），切出九張透明 PNG＋一張 1920×1080 群像。
# 黑底去背用「從邊界連通的暗色」判定，衣服的黑色因為被輪廓包住不會被吃掉；
# 名牌在裁切時整條切掉。九人彼此相連，用列邊界切開。
import json, os
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/ref/cast')
MANIFEST = os.path.join(OUT, 'cast.json')
SRC = os.path.join(ROOT, 'assets/ref/matryoshka/lineup.jpg')
PLATE_TOP = 712          # 名牌從這裡開始，整條切掉

# 索引＝PV 卡司順序；主唱是中央的余賀公磨
CHARS = [
    ('井稲田', 29, 208), ('真坂本', 208, 418), ('真朱', 418, 622),
    ('余賀公磨', 622, 843), ('三國壮一郎', 852, 1032), ('Q', 1032, 1226),
    ('生田羽奈日', 1238, 1392), ('ジェニファー', 1412, 1602), ('竹田崎重臣', 1602, 1806),
]


def cut_all():
    im = Image.open(SRC).convert('RGB').crop((0, 0, 1822, PLATE_TOP))
    a = np.array(im).astype(np.int16)
    lum = a.mean(axis=2)
    dark = lum < 26
    seed = np.zeros_like(dark)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    bg = ndimage.binary_propagation(seed, mask=dark)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 0.6)
    alpha = np.clip(np.minimum(alpha.astype(np.float32) + 10, soft * 1.04), 0, 255).astype(np.uint8)
    full = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')
    out = []
    for i, (name, x0, x1) in enumerate(CHARS):
        part = full.crop((x0, 0, x1, full.height))
        arr = np.array(part)
        ys, xs = np.where(arr[:, :, 3] > 24)
        part = part.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        file = f'matryoshka-{i}.png'
        part.save(os.path.join(OUT, file))
        top = np.array(part)[:, :, 3] > 128
        band = top[:max(1, int(part.height * .14))]
        yy, xx = np.where(band)
        out.append({'file': file, 'w': part.width, 'h': part.height,
                    'headX': int(round(xx.mean())) if len(xx) else part.width // 2,
                    'headY': int(round(part.height * .10)),
                    'source': [x0, 0], 'sheet': 'matryoshka-ref', 'name': name, 'intact': True})
    return full, out


def build_art(full):
    W, H = 1920, 1080
    bg = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(bg)
    top = np.array([6, 8, 18], dtype=np.float32)
    mid = np.array([38, 20, 58], dtype=np.float32)
    bot = np.array([92, 24, 42], dtype=np.float32)
    for y in range(H):
        u = y / (H - 1)
        c = top + (mid - top) * (u / .6) if u < .6 else mid + (bot - mid) * ((u - .6) / .4)
        d.line([(0, y), (W, y)], fill=tuple(int(v) for v in c) + (255,))
    w = W
    h = int(full.height * w / full.width)
    sp = full.resize((w, h), Image.LANCZOS)
    bg.alpha_composite(sp, (0, (H - h) // 2 + 30))
    bg.save(os.path.join(ROOT, 'assets/ref/matryoshka-group.png'))


def main():
    full, entries = cut_all()
    data = json.load(open(MANIFEST, encoding='utf-8'))
    data['matryoshka'] = entries
    json.dump(data, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for e in entries:
        print(f'{e["file"]:20s} {e["w"]}x{e["h"]} head=({e["headX"]},{e["headY"]}) {e["name"]}')
    build_art(full)
    print('群像 → assets/ref/matryoshka-group.png')


if __name__ == '__main__':
    main()
