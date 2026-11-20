#!/usr/bin/env python3
# 未来は僕等の手の中：官方九人合圖（純白背景）去背，輸出單一「群像立繪」給卡司用，
# 另拼一張 1920×1080 主視覺。九人互相重疊，無法自動分離，因此整組當一個 intact 精靈。
import json, os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/ref/cast')
MANIFEST = os.path.join(OUT, 'cast.json')
SRC = os.path.join(ROOT, 'assets/ref/mirai/lineup.png')


def cut_group():
    im = Image.open(SRC).convert('RGBA')
    a = np.array(im).astype(np.int16)
    rgb = a[:, :, :3]
    near_white = (rgb[:, :, 0] > 238) & (rgb[:, :, 1] > 238) & (rgb[:, :, 2] > 238)
    seed = np.zeros_like(near_white)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    bg = ndimage.binary_propagation(seed, mask=near_white)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    solid = alpha > 24
    lab, n = ndimage.label(solid)
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        alpha = np.where(lab == keep, alpha, 0).astype(np.uint8)
    # 原圖腳下有一層淺灰陰影，門檻 238 抓不到；畫面下方 12% 內把近白（>222）一併清掉
    hh = a.shape[0]
    floor = np.zeros_like(alpha, dtype=bool)
    floor[int(hh * .88):, :] = True
    light = (rgb[:, :, 0] > 222) & (rgb[:, :, 1] > 222) & (rgb[:, :, 2] > 222)
    alpha = np.where(floor & light, 0, alpha).astype(np.uint8)
    # 兩腿之間與腳下的空白會連到底邊，從底邊再填充一次淺色（門檻放寬到 222）
    seed2 = np.zeros_like(light)
    seed2[-1, :] = True
    bg2 = ndimage.binary_propagation(seed2, mask=light)
    alpha = np.where(bg2, 0, alpha).astype(np.uint8)
    # 腿之間被包住的純白空隙（255）連不到邊界，另外移除
    pure = (alpha > 200) & (rgb[:, :, 0] >= 248) & (rgb[:, :, 1] >= 248) & (rgb[:, :, 2] >= 248)
    lab2, n2 = ndimage.label(pure)
    if n2:
        sz = ndimage.sum(pure, lab2, range(1, n2 + 1))
        for i2 in range(1, n2 + 1):
            if sz[i2 - 1] < 400:
                continue
            ys2, xs2 = np.where(lab2 == i2)
            if ys2.min() <= 1 or xs2.min() <= 1 or ys2.max() >= alpha.shape[0] - 2 or xs2.max() >= alpha.shape[1] - 2:
                continue
            alpha[lab2 == i2] = 0
    # 最底部的地面線是 218–222 的淺灰，門檻抓不到；整行都很亮就清掉
    for y in range(alpha.shape[0] - 1, alpha.shape[0] - 10, -1):
        row = alpha[y]
        idx = row > 100
        if idx.sum() < 10:
            break
        if np.mean(rgb[y][idx].mean(axis=1)) > 205:
            alpha[y] = 0
        else:
            break
    # 最後幾行仍混著地面白線與鞋底：逐像素把亮的部分清掉，只留深色鞋底
    for y in range(alpha.shape[0] - 4, alpha.shape[0]):
        bright = rgb[y].mean(axis=1)
        alpha[y] = np.where(bright > 150, 0, alpha[y]).astype(np.uint8)
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 0.6)
    alpha = np.clip(np.minimum(alpha.astype(np.float32) + 10, soft * 1.04), 0, 255).astype(np.uint8)
    a[:, :, 3] = alpha
    cut = Image.fromarray(a.astype(np.uint8), 'RGBA')
    ys, xs = np.where(alpha > 24)
    pad = 6
    cut = cut.crop((max(0, xs.min() - pad), max(0, ys.min() - pad),
                    min(cut.width, xs.max() + 1 + pad), min(cut.height, ys.max() + 1 + pad)))
    cut.save(os.path.join(OUT, 'mirai-0.png'))
    return cut


def build_art(cut):
    W, H = 1920, 1080
    bg = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(bg)
    top = np.array([16, 18, 34], dtype=np.float32)
    mid = np.array([122, 52, 58], dtype=np.float32)
    bot = np.array([242, 176, 96], dtype=np.float32)
    for y in range(H):
        u = y / (H - 1)
        c = top + (mid - top) * (u / .58) if u < .58 else mid + (bot - mid) * ((u - .58) / .42)
        d.line([(0, y), (W, y)], fill=tuple(int(v) for v in c) + (255,))
    # 夕陽と放射線
    rd = ImageDraw.Draw(bg, 'RGBA')
    for i in range(48):
        ang = i / 48 * 6.2832
        import math
        rd.line([(W * .5, H * .52), (W * .5 + math.cos(ang) * 1600, H * .52 + math.sin(ang) * 1600)],
                fill=(255, 226, 160, 12), width=6)
    rd.ellipse([W * .5 - 240, H * .52 - 240, W * .5 + 240, H * .52 + 240], fill=(255, 214, 140, 46))
    # 先鋪一層放大模糊的群像當底，填滿左右空白
    bw = W
    bh = int(cut.height * bw / cut.width)
    big = cut.resize((bw, bh), Image.LANCZOS)
    top_y = max(0, (bh - H) // 2 - 40)
    big = big.crop((0, top_y, bw, min(bh, top_y + H)))
    big = big.filter(ImageFilter.GaussianBlur(26))
    veil = Image.new('RGBA', (W, H), (10, 12, 26, 150))
    bg.alpha_composite(big, (0, max(0, (H - big.height) // 2)))
    bg.alpha_composite(veil)
    # 群像置中，腳底對齊 1010
    h = 1000
    w = int(cut.width * h / cut.height)
    sp = cut.resize((w, h), Image.LANCZOS)
    bg.alpha_composite(sp, ((W - w) // 2, 1010 - h))
    bg.save(os.path.join(ROOT, 'assets/ref/mirai-group.png'))


def main():
    cut = cut_group()
    data = json.load(open(MANIFEST, encoding='utf-8'))
    # 主唱＝中央的前田太尊，頭部約在原圖 (205,120)；裁切後座標按比例換算
    head_x = int(205 * cut.width / 446)
    head_y = int(120 * cut.height / 667)
    data['mirai'] = [{'file': 'mirai-0.png', 'w': cut.width, 'h': cut.height,
                      'headX': head_x, 'headY': head_y,
                      'source': [0, 0], 'sheet': 'mirai-ref',
                      'name': '前田太尊', 'intact': True}]
    json.dump(data, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    build_art(cut)
    print(f'mirai-0.png {cut.width}x{cut.height} head=({head_x},{head_y})')
    print('主視覺 → assets/ref/mirai-group.png')


if __name__ == '__main__':
    main()
