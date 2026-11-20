#!/usr/bin/env python3
# ローリング☆ガールズ 四人：從純白背景的並排立繪切出單人透明 PNG，
# 輸出 assets/ref/cast/rolling-0..3.png，寫入 cast.json 的 rolling 群組，並拼一張 1920×1080 群像。
import json, os
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/ref/cast')
MANIFEST = os.path.join(OUT, 'cast.json')
# 兩張來源同一構圖：優先用 1677×938 的高解析版
SRC = os.path.join(ROOT, 'assets/ref/rolling/lineup-hi.jpg')
if not os.path.exists(SRC):
    SRC = os.path.join(ROOT, 'assets/ref/rolling/lineup.jpg')

# 索引順序＝PV 卡司順序；望未 是主唱
# 對照官方四人立繪：左起 望未（洋紅髮藍外套）・結季奈（銀髮戴帽）・逢衣（黑髮粉衣）・千綾（金髮綠外套）
CHARS = [
    ('森友望未', 87, 474),
    ('小坂結季奈', 517, 842),
    ('響逢衣', 877, 1197),
    ('御園千綾', 1203, 1585),
]


def cut_one(im, x0, x1, name, index):
    part = im.crop((x0, 0, x1, im.height)).convert('RGBA')
    a = np.array(part).astype(np.int16)
    rgb = a[:, :, :3]
    # 近白＝背景；從邊界連通才移除，避免吃掉裙子的白色
    near_white = (rgb[:, :, 0] > 232) & (rgb[:, :, 1] > 232) & (rgb[:, :, 2] > 232)
    seed = np.zeros_like(near_white)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    bg = ndimage.binary_propagation(seed, mask=near_white)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # 只留最大連通域：切邊時夾到的鄰人碎片、腳邊雜物都會被去掉。
    # 不要先做 closing，否則鄰人的身體會和本人黏成一塊。
    solid = alpha > 24
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        alpha = np.where(lab == keep, alpha, 0).astype(np.uint8)
    # 邊緣羽化一格，避免鋸齒
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 0.7)
    alpha = np.clip(np.minimum(alpha.astype(np.float32) + 12, soft * 1.06), 0, 255).astype(np.uint8)
    a[:, :, 3] = alpha
    cut = Image.fromarray(a.astype(np.uint8), 'RGBA')
    ys, xs = np.where(alpha > 24)
    if len(xs) == 0:
        raise RuntimeError(f'{name}: 沒有前景')
    pad = 8
    bx0, by0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    bx1, by1 = min(cut.width, xs.max() + 1 + pad), min(cut.height, ys.max() + 1 + pad)
    cut = cut.crop((bx0, by0, bx1, by1))
    file = f'rolling-{index}.png'
    cut.save(os.path.join(OUT, file))
    top = np.array(cut)[:, :, 3] > 128
    band = top[:max(1, int(cut.height * .14))]
    yy, xx = np.where(band)
    head_x = int(round(xx.mean())) if len(xx) else cut.width // 2
    head_y = int(round(cut.height * .10))
    return {'file': file, 'w': cut.width, 'h': cut.height,
            'headX': head_x, 'headY': head_y,
            'source': [int(x0 + bx0), int(by0)], 'sheet': 'rolling-ref',
            'name': name, 'intact': True}, cut


def build_group(sprites):
    W, H = 1920, 1080
    bg = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(bg)
    top = np.array([12, 18, 48], dtype=np.float32)
    mid = np.array([58, 96, 150], dtype=np.float32)
    bot = np.array([232, 214, 176], dtype=np.float32)
    for y in range(H):
        u = y / (H - 1)
        c = top + (mid - top) * (u / .60) if u < .60 else mid + (bot - mid) * ((u - .60) / .40)
        d.line([(0, y), (W, y)], fill=tuple(int(v) for v in c) + (255,))
    # 遠景街道與電線
    rd = ImageDraw.Draw(bg, 'RGBA')
    for i in range(9):
        y = 560 + i * 34
        rd.line([(0, y), (W, y - 26)], fill=(255, 255, 255, 14), width=2)
    for x in range(-100, W + 200, 260):
        rd.line([(x, 0), (x + 60, 520)], fill=(255, 255, 255, 10), width=3)
    # 四個人由左至右並排，腳底對齊 980
    total = sum(s.width for s in sprites)
    gap = (W - total) / (len(sprites) + 1)
    x = gap
    for s in sprites:
        h = 880
        w = int(s.width * h / s.height)
        sp = s.resize((w, h), Image.LANCZOS)
        bg.alpha_composite(sp, (int(x), 980 - h))
        x += w + gap
    return bg


def main():
    im = Image.open(SRC)
    sprites, entries = [], []
    for i, (name, x0, x1) in enumerate(CHARS):
        e, cut = cut_one(im, x0, x1, name, i)
        entries.append(e)
        sprites.append(cut)
        print(f'{e["file"]:16s} {e["w"]}x{e["h"]} head=({e["headX"]},{e["headY"]}) {name}')
    data = json.load(open(MANIFEST, encoding='utf-8'))
    data['rolling'] = entries
    json.dump(data, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    group = build_group(sprites)
    group.save(os.path.join(ROOT, 'assets/ref/rolling-group.png'))
    print('群像 → assets/ref/rolling-group.png')


if __name__ == '__main__':
    main()
