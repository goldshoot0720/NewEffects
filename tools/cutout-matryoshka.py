#!/usr/bin/env python3
# マトリョーシカ：黑底九人立繪，切出九張透明 PNG＋一張 1920×1080 群像。
# 黑底去背用「從邊界連通的暗色」判定，衣服的黑色因為被輪廓包住不會被吃掉；
# 九人彼此相連，沿輪廓分開。
import json, os
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
from lineup_cutouts import split_lineup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/ref/cast')
MANIFEST = os.path.join(OUT, 'cast.json')
# 優先用沒有名牌的版本；沒有的話才退回帶名牌的舊圖
SRC = os.path.join(ROOT, 'assets/ref/matryoshka/lineup-clean.jpg')
if not os.path.exists(SRC):
    SRC = os.path.join(ROOT, 'assets/ref/matryoshka/lineup.jpg')
PLATE_TOP = 712          # 名牌從這裡開始，整條切掉

# 索引＝PV 卡司順序；主唱是中央的余賀公磨
CHARS = ['井稲田', '真坂本', '真朱', '余賀公磨', '三國壮一郎', 'Q', '生田羽奈日', 'ジェニファー', '竹田崎重臣']
DIVIDERS = [
    [(200, 205), (320, 218), (680, 231)],
    [(130, 447), (255, 454), (278, 455), (286, 454), (292, 451), (301, 445), (311, 440), (325, 439), (400, 452), (680, 445)],
    [(177, 666), (264, 678), (282, 676), (300, 678), (309, 672), (318, 671), (328, 673), (341, 668), (423, 670), (605, 660), (700, 640)],
    [(375, 847), (680, 846)],
    [(220, 1070), (282, 1081), (320, 1069), (378, 1050), (437, 1038), (540, 1066), (700, 1080)],
    [(176, 1220), (425, 1234), (690, 1210)],
    [(360, 1402)],
    [(265, 1590), (440, 1595), (705, 1616)],
]


def cut_all():
    im = Image.open(SRC).convert('RGB')
    if os.path.basename(SRC) == 'lineup.jpg':
        im = im.crop((0, 0, im.width, PLATE_TOP))
    a = np.array(im).astype(np.int16)
    dark = a.max(axis=2) < 12
    seed = np.zeros_like(dark)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    bg = ndimage.binary_propagation(seed, mask=dark)
    # Discard isolated JPEG speckles on the black backdrop. Keep detached
    # costume details larger than the compression noise.
    labels, _ = ndimage.label(~bg, np.ones((3, 3)))
    visible = (labels != 0) & (np.bincount(labels.ravel())[labels] > 32)
    alpha = np.uint8(visible) * 255
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 0.6)
    alpha = np.clip(np.minimum(alpha.astype(np.float32) + 10, soft * 1.04), 0, 255).astype(np.uint8)
    full = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')
    out = []
    for i, (part, source) in enumerate(split_lineup(full, DIVIDERS)):
        name = CHARS[i]
        file = f'matryoshka-{i}.png'
        part.save(os.path.join(OUT, file))
        top = np.array(part)[:, :, 3] > 128
        band = top[:max(1, int(part.height * .14))]
        yy, xx = np.where(band)
        out.append({'file': file, 'w': part.width, 'h': part.height,
                    'headX': int(round(xx.mean())) if len(xx) else part.width // 2,
                    'headY': int(round(part.height * .10)),
                    'source': source, 'sheet': 'matryoshka-ref', 'name': name, 'intact': True})
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
    # Keep the original framing of the group cover, including the complete shoes.
    bottom = max(e['source'][1] + e['h'] for e in entries)
    build_art(full.crop((0, 0, full.width, bottom)))
    print('群像 → assets/ref/matryoshka-group.png')


if __name__ == '__main__':
    main()
