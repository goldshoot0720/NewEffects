#!/usr/bin/env python3
# 月に向かって撃て：把 11 張白底角色卡去背成單張立繪，並拼一張 1920×1080 群像。
# 角色卡左側有名字、四角有裝飾星，只保留 alpha 最大連通塊（人物本體）。
import json
import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIP = os.path.expanduser('~/.workbuddy-ai/clipboard-images')
OUT = os.path.join(ROOT, 'assets/ref/cast')
REF = os.path.join(ROOT, 'assets/ref')
MANIFEST = os.path.join(OUT, 'cast.json')

# 使用者提供的順序（檔名時間戳由左至右）
CHARS = [
    ('clipboard-2026-11-16T18-52-20-745Z-b6f5a995.png', 'Arisu Yambuki'),
    ('clipboard-2026-11-16T18-52-20-746Z-3e280a17.png', 'Rikka Inohana'),
    ('clipboard-2026-11-16T18-52-20-746Z-6573022b.png', 'Nene Himekawa'),
    ('clipboard-2026-11-16T18-52-20-747Z-737b07b3.png', 'Iko Kirino'),
    ('clipboard-2026-11-16T18-52-20-747Z-b3ed6187.png', 'Shinobu Uzuki'),
    ('clipboard-2026-11-16T18-52-20-748Z-211e2cb1.png', 'Lemon Ando'),
    ('clipboard-2026-11-16T18-52-20-748Z-565829f1.png', 'Aiko'),
    ('clipboard-2026-11-16T18-52-20-748Z-8ff86d90.png', 'Ao Momotose'),
    ('clipboard-2026-11-16T18-52-20-749Z-03bcd6ed.png', 'HIZUMI'),
    ('clipboard-2026-11-16T18-52-20-749Z-2b6dd458.png', 'Riina Yambuki'),
    ('clipboard-2026-11-16T18-52-20-749Z-804e3281.png', 'Mito Yambuki'),
]

def cut_one(path, name, index):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)[:, :, 3]
    mask = a > 16
    lab, n = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    if n == 0:
        raise RuntimeError(f'{name}: 沒有前景')
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = int(np.argmax(sizes)) + 1
    body = lab == keep
    ys, xs = np.where(body)
    pad = 8
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = min(im.width, xs.max() + 1 + pad), min(im.height, ys.max() + 1 + pad)
    # 只留下人物本體，名字與裝飾星透明
    out = np.array(im)
    out[~body, 3] = 0
    cut = Image.fromarray(out).crop((x0, y0, x1, y1))
    file = f'tsuki-{index}.png'
    cut.save(os.path.join(OUT, file))
    # 頭頂往下 14% 的不透明像素平均 x 當頭部中心
    h = cut.height
    top = np.array(cut)[:, :, 3] > 128
    band = top[:max(1, int(h * .14))]
    yy, xx = np.where(band)
    head_x = int(round(xx.mean())) if len(xx) else cut.width // 2
    head_y = int(round(h * .10))
    return {
        'file': file, 'w': cut.width, 'h': cut.height,
        'headX': head_x, 'headY': head_y,
        'source': [int(x0), int(y0)], 'sheet': 'tsuki-ref', 'name': name
    }, cut

def build_group(sprites):
    W, H = 1920, 1080
    bg = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(bg)
    top = np.array([8, 12, 40], dtype=np.float32)
    mid = np.array([38, 30, 92], dtype=np.float32)
    bot = np.array([118, 74, 132], dtype=np.float32)
    for y in range(H):
        u = y / (H - 1)
        c = top + (mid - top) * (u / .6) if u < .6 else mid + (bot - mid) * ((u - .6) / .4)
        d.line([(0, y), (W, y)], fill=tuple(int(v) for v in c))
    # 月亮與光暈
    moon = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    md = ImageDraw.Draw(moon)
    md.ellipse([1370, 70, 1730, 430], fill=(255, 244, 210, 235))
    moon = moon.filter(ImageFilter.GaussianBlur(2))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([1280, -20, 1820, 520], fill=(255, 236, 180, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    bg = Image.alpha_composite(bg.convert('RGBA'), glow)
    bg = Image.alpha_composite(bg, moon)
    # 星星
    rng = np.random.default_rng(7)
    sd = ImageDraw.Draw(bg)
    for _ in range(140):
        x, y = int(rng.integers(0, W)), int(rng.integers(0, 620))
        r = float(rng.random() * 1.8 + .4)
        a = int(80 + rng.random() * 150)
        sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, a))
    # 後排 6、前排 5
    slots = [(300, 900, 600), (620, 900, 580), (940, 900, 590), (1260, 900, 580), (1580, 900, 600), (1820, 900, 570),
             (220, 1070, 760), (570, 1070, 740), (960, 1070, 760), (1350, 1070, 740), (1720, 1070, 760)]
    order = list(range(len(sprites)))
    canvas = bg
    for k, idx in enumerate(order):
        sp = sprites[idx]
        x, base, hgt = slots[k % len(slots)]
        scale = hgt / sp.height
        w = int(sp.width * scale)
        sp2 = sp.resize((w, int(sp.height * scale)), Image.LANCZOS)
        shadow = Image.new('RGBA', (w, sp2.height), (0, 0, 0, 0))
        shadow.paste((5, 4, 18, 110), (0, 0), sp2.split()[3])
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(16)), (x - w // 2 + 12, base - sp2.height + 16))
        canvas.alpha_composite(sp2, (x - w // 2, base - sp2.height))
    # 底部壓暗
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sh = ImageDraw.Draw(shade)
    for y in range(H - 300, H):
        a = int(150 * ((y - (H - 300)) / 300) ** 1.4)
        sh.line([(0, y), (W, y)], fill=(6, 5, 20, a))
    canvas.alpha_composite(shade)
    canvas.convert('RGB').save(os.path.join(REF, 'tsuki-group.png'), quality=92)
    print('  -> assets/ref/tsuki-group.png (1920x1080)')

def main():
    manifest = json.load(open(MANIFEST))
    entries, sprites = [], []
    for i, (fn, name) in enumerate(CHARS):
        path = os.path.join(CLIP, fn)
        if not os.path.exists(path):
            raise SystemExit('缺少 ' + path)
        meta, cut = cut_one(path, name, i)
        entries.append(meta)
        sprites.append(cut)
        print(f'  {meta["file"]} {meta["w"]}x{meta["h"]}  {name}')
    manifest['tsuki'] = entries
    json.dump(manifest, open(MANIFEST, 'w'), ensure_ascii=False, indent=1)
    print('cast.json: tsuki ->', len(entries))
    build_group(sprites)

if __name__ == '__main__':
    main()
