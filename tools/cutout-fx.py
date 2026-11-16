#!/usr/bin/env python3
# FX戦士くるみちゃん：四張官方透明立繪（1038×1300）裁掉透明邊、加邊距，
# 輸出 cast/fx-0..3.png、寫入 cast.json 的 fx 群組，並拼一張 1920×1080 群像。
# 群像背景做成 FX 交易畫面：深夜藍漸層、K 線、均線與報價格線。
import json
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/ref/cast')
REF = os.path.join(ROOT, 'assets/ref')
MANIFEST = os.path.join(OUT, 'cast.json')
SRC = os.path.join(REF, 'fx')

# 索引順序＝PV 卡司順序；くるみ 是主唱
CHARS = [
    ('kurumi.png', '福賀くるみ'),
    ('mochiko.png', '小金萌智子'),
    ('mebuki.png', '山師芽吹'),
    ('yasuko.png', '高根やす子'),
]


def cut_one(path, name, index):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 16)
    if len(xs) == 0:
        raise RuntimeError(f'{name}: 沒有前景')
    pad = 8
    x0, y0 = max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad)
    x1, y1 = min(im.width, int(xs.max()) + 1 + pad), min(im.height, int(ys.max()) + 1 + pad)
    cut = im.crop((x0, y0, x1, y1))
    file = f'fx-{index}.png'
    cut.save(os.path.join(OUT, file))
    # 頭頂往下 14% 的不透明像素平均 x 當頭部中心
    top = np.array(cut)[:, :, 3] > 128
    band = top[:max(1, int(cut.height * .14))]
    yy, xx = np.where(band)
    head_x = int(round(xx.mean())) if len(xx) else cut.width // 2
    head_y = int(round(cut.height * .10))
    return {
        'file': file, 'w': cut.width, 'h': cut.height,
        'headX': head_x, 'headY': head_y,
        'source': [int(x0), int(y0)], 'sheet': 'fx-ref', 'name': name
    }, cut


def build_group(sprites):
    W, H = 1920, 1080
    bg = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(bg)
    top = np.array([5, 8, 30], dtype=np.float32)
    mid = np.array([26, 16, 66], dtype=np.float32)
    bot = np.array([92, 22, 96], dtype=np.float32)
    for y in range(H):
        u = y / (H - 1)
        c = top + (mid - top) * (u / .62) if u < .62 else mid + (bot - mid) * ((u - .62) / .38)
        d.line([(0, y), (W, y)], fill=tuple(int(v) for v in c) + (255,))

    # 報價格線
    grid = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 120):
        gd.line([(x, 0), (x, H)], fill=(140, 170, 255, 18))
    for y in range(0, H, 90):
        gd.line([(0, y), (W, y)], fill=(140, 170, 255, 14))
    bg = Image.alpha_composite(bg, grid)

    # K 線：一路走高的多頭，尾段插一根長黑（畫面上方）
    rng = np.random.default_rng(11)
    kd = ImageDraw.Draw(bg, 'RGBA')
    x, price = 30, 960.0
    while x < W - 20:
        o = price
        move = rng.normal(-7.0, 30)          # 一路走高的多頭，尾段才急殺
        c = o + move
        hi = min(o, c) - abs(rng.normal(0, 18))
        lo = max(o, c) + abs(rng.normal(0, 18))
        up = c < o
        col = (255, 92, 122, 70) if up else (86, 226, 178, 70)
        kd.line([(x + 9, hi), (x + 9, lo)], fill=col, width=3)
        kd.rectangle([x, min(o, c), x + 18, max(o, c)], fill=col)
        price = max(170, min(980, c))
        x += 46
    # 均線
    kd.line([(0, 620), (420, 560), (840, 470), (1260, 360), (1700, 250), (1920, 210)],
            fill=(255, 214, 108, 120), width=4)
    kd.line([(0, 720), (480, 700), (960, 640), (1440, 560), (1920, 470)],
            fill=(140, 216, 255, 70), width=3)

    # 中央柔光
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gl = ImageDraw.Draw(glow)
    gl.ellipse([480, 120, 1440, 900], fill=(255, 210, 160, 60))
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    bg = Image.alpha_composite(bg, glow)

    # 四人：くるみ 站中間偏前
    slots = [(300, 1010, 690), (760, 1050, 800), (1190, 1010, 690), (1620, 1000, 660)]
    canvas = bg
    for k, sp in enumerate(sprites):
        x, base, hgt = slots[k]
        scale = hgt / sp.height
        w = int(sp.width * scale)
        sp2 = sp.resize((w, int(sp.height * scale)), Image.LANCZOS)
        shadow = Image.new('RGBA', (w, sp2.height), (0, 0, 0, 0))
        shadow.paste((4, 3, 16, 120), (0, 0), sp2.split()[3])
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)),
                              (x - w // 2 + 10, base - sp2.height + 18))
        canvas.alpha_composite(sp2, (x - w // 2, base - sp2.height))

    # 底部壓暗
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sh = ImageDraw.Draw(shade)
    for y in range(H - 320, H):
        a = int(160 * ((y - (H - 320)) / 320) ** 1.4)
        sh.line([(0, y), (W, y)], fill=(4, 3, 16, a))
    canvas.alpha_composite(shade)
    canvas.convert('RGB').save(os.path.join(REF, 'fx-group.png'), quality=92)
    print('  -> assets/ref/fx-group.png (1920x1080)')

    # 臉部座標：切圖 headX/headY 換算回群像座標，再往下移到臉
    faces = []
    for k, sp in enumerate(sprites):
        x, base, hgt = slots[k]
        scale = hgt / sp.height
        w = int(sp.width * scale)
        meta = ENTRIES[k]
        faces.append([int(round(x - w // 2 + meta['headX'] * scale)),
                      int(round(base - hgt + meta['headY'] * scale + hgt * .05))])
    print('  faces: [' + ', '.join(f'[{a}, {b}]' for a, b in faces) + ']')


ENTRIES = []


def main():
    manifest = json.load(open(MANIFEST))
    sprites = []
    for i, (fn, name) in enumerate(CHARS):
        path = os.path.join(SRC, fn)
        if not os.path.exists(path):
            raise SystemExit('缺少 ' + path)
        meta, cut = cut_one(path, name, i)
        ENTRIES.append(meta)
        sprites.append(cut)
        print(f'  {meta["file"]} {meta["w"]}x{meta["h"]}  {name}')
    manifest['fx'] = ENTRIES
    json.dump(manifest, open(MANIFEST, 'w'), ensure_ascii=False, indent=1)
    print('cast.json: fx ->', len(ENTRIES))
    build_group(sprites)


if __name__ == '__main__':
    main()
