#!/usr/bin/env python3
# INSIDE IDENTITY 封面四人：紅底、人物分開站，用 macOS Vision 的前景遮罩（tools/vision-cutout.swift）
# 逐人切出透明 PNG，輸出 assets/ref/cast/inside-0..3.png 並寫入 cast.json 的 inside 群組。
# 用法：python3 tools/cutout-inside.py
import json, os, subprocess, sys
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/ref/cast')
MANIFEST = os.path.join(OUT, 'cast.json')
SRC = os.path.join(ROOT, 'assets/ref/inside-identity/cover.jpg')
SWIFT = os.path.join(ROOT, 'tools/vision-cutout.swift')
BIN = '/tmp/vision-cutout'

# 四人由左至右。第三、第四人在 864–866 之間分開：粉色裙擺到 864，金髮的手從 866 開始。
# 名字照封面署名的順序由左至右對應；若本人順序不同，改這裡再重跑。
CHARS = [
    ('白河しらせ', 140, 410),
    ('ももしき', 400, 660),
    ('綿宮あひる', 640, 864),
    ('すいみゃ', 866, 1160),
]


def clean_caption(a, white_min=185):
    """封面底部的白色標題「INSIDE MY FEELING」壓在鞋子和地板上，切圖後會留在腳邊。
    只處理細筆畫的白色連通域（襪子是大面積，不會被動到）：
    周圍是透明（地板）就把 alpha 設 0；壓在鞋上的字則用最近的像素補色。"""
    alpha = a[:, :, 3].astype(np.int16)
    rgb = a[:, :, :3]
    mx, mn = rgb.max(axis=2).astype(np.int16), rgb.min(axis=2).astype(np.int16)
    white = (mn > white_min) & ((mx - mn) < 40)
    white[:620] = False
    lab, n = ndimage.label(white)
    if not n:
        return a
    sizes = ndimage.sum(white, lab, range(1, n + 1))
    text = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s < 2200])
    if not text.any():
        return a
    # 把字幕（連同外圍的深色描邊）整片用「最近的非字幕像素」補掉：
    # 紅地板上的字直接去掉 alpha；鞋面上的字則被補成鞋子的顏色。
    mask = ndimage.binary_dilation(text, iterations=3)
    idx = ndimage.distance_transform_edt(mask, return_distances=False, return_indices=True)
    nearest = rgb[idx[0], idx[1]]
    r, g, b = nearest[:, :, 0].astype(np.int16), nearest[:, :, 1].astype(np.int16), nearest[:, :, 2].astype(np.int16)
    floor = mask & (r > g + 40) & (r > b + 20)
    alpha[floor] = 0
    fill = mask & ~floor
    rgb[fill] = nearest[fill]
    a[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return a


def ensure_binary():
    if os.path.exists(BIN) and os.path.getmtime(BIN) >= os.path.getmtime(SWIFT):
        return
    subprocess.run(['swiftc', '-O', SWIFT, '-o', BIN], check=True)


def cut_one(im, x0, x1, name, index):
    band = im.crop((x0, 0, x1, im.height))
    tmp_in = f'/tmp/inside-band-{index}.jpg'
    tmp_out = f'/tmp/inside-band-{index}'
    band.save(tmp_in, quality=96)
    subprocess.run([BIN, tmp_in, tmp_out], check=True, stdout=subprocess.DEVNULL)
    part = Image.open(tmp_out + '.png').convert('RGBA')
    a = clean_caption(np.array(part), 150 if index == 2 else 185)
    alpha = a[:, :, 3]
    # 只留最大連通域：切邊時夾到的鄰人指尖、背景殘片都會被去掉
    solid = alpha > 24
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        alpha = np.where(lab == keep, alpha, 0).astype(np.uint8)
    # 邊緣羽化一格，避免鋸齒
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 0.7)
    a[:, :, 3] = np.clip(np.minimum(alpha.astype(np.float32) + 12, soft * 1.06), 0, 255).astype(np.uint8)
    cut = Image.fromarray(a, 'RGBA')
    ys, xs = np.where(a[:, :, 3] > 24)
    if len(xs) == 0:
        raise RuntimeError(f'{name}: 沒有前景')
    pad = 8
    bx0, by0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    bx1, by1 = min(cut.width, xs.max() + 1 + pad), min(cut.height, ys.max() + 1 + pad)
    cut = cut.crop((bx0, by0, bx1, by1))
    file = f'inside-{index}.png'
    cut.save(os.path.join(OUT, file))
    top = np.array(cut)[:, :, 3] > 128
    band_top = top[:max(1, int(cut.height * .14))]
    yy, xx = np.where(band_top)
    head_x = int(round(xx.mean())) if len(xx) else cut.width // 2
    head_y = int(round(cut.height * .10))
    return {'file': file, 'w': cut.width, 'h': cut.height,
            'headX': head_x, 'headY': head_y,
            'source': [int(x0 + bx0), int(by0)], 'sheet': 'inside-ref',
            'name': name, 'intact': True}, cut


def main():
    ensure_binary()
    im = Image.open(SRC).convert('RGB')
    entries = []
    for i, (name, x0, x1) in enumerate(CHARS):
        e, _ = cut_one(im, x0, x1, name, i)
        entries.append(e)
        print(f'{e["file"]:14s} {e["w"]}x{e["h"]} head=({e["headX"]},{e["headY"]}) source={e["source"]} {name}')
    data = json.load(open(MANIFEST, encoding='utf-8'))
    data['inside'] = entries
    json.dump(data, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('cast.json → inside 群組已更新')


if __name__ == '__main__':
    main()
