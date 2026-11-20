#!/usr/bin/env python3
# 逆境無頼カイジ OP/ED 用：白底八人立繪切出八張透明 PNG＋一張 1920×1080 群像。
# 八人靠得很近（只有最左邊有完全透明列），因此用固定的列邊界切開。
import json, os
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/ref/cast')
MANIFEST = os.path.join(OUT, 'cast.json')
SRC = os.path.join(ROOT, 'assets/ref/kaiji/lineup.jpg')

# 索引＝PV 卡司順序；主唱是中央的開司
CHARS = [
    ('船井', 0, 245), ('遠藤勇次', 245, 420), ('古畑', 420, 650), ('北見', 650, 875),
    ('伊藤開司', 875, 1105), ('石田', 1105, 1320), ('大槻', 1320, 1548), ('兵藤和尊', 1548, 1920),
]


def main():
    im = Image.open(SRC).convert('RGB')
    a = np.array(im).astype(np.int16)
    # JPEG 的白底邊緣會一路掉到 200 左右（抗鋸齒漸層）；白襯衫被輪廓包住，
    # 從邊界連通才移除，所以門檻可以放到 200 而不會挖掉衣服。
    lum = a.mean(axis=2)
    nw = lum > 200
    seed = np.zeros_like(nw)
    seed[0, :] = seed[-1, :] = True
    seed[:, 0] = seed[:, -1] = True
    bg = ndimage.binary_propagation(seed, mask=nw)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # 相鄰角色手臂之間的空白會被包住，連不到邊界；把「高而窄的淺色封閉區」清掉
    light = (alpha > 200) & (a.mean(axis=2) > 195)
    lab, n = ndimage.label(light)
    H = alpha.shape[0]
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) < 200:
            continue
        if (ys.max() - ys.min()) > H * .3 and (xs.max() - xs.min()) < 70:
            alpha[lab == i] = 0
    # 腳踩在畫面底邊，腳與腳之間的白色被包住清不到；底部 12% 直接把淺色清掉
    Hb = alpha.shape[0]
    bottom = np.zeros_like(alpha, dtype=bool)
    bottom[int(Hb * .88):, :] = True
    alpha[bottom & (a.mean(axis=2) > 195)] = 0
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 0.6)
    alpha = np.clip(np.minimum(alpha.astype(np.float32) + 10, soft * 1.04), 0, 255).astype(np.uint8)
    full = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')
    entries = []
    for i, (name, x0, x1) in enumerate(CHARS):
        part = full.crop((x0, 0, x1, full.height))
        arr = np.array(part)
        ys, xs = np.where(arr[:, :, 3] > 24)
        part = part.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        # 角色之間被手臂包住的白色會貼著裁切邊緣，這裡再清一次
        pa = np.array(part)
        pl = (pa[:, :, 3] > 150) & (pa[:, :, :3].mean(axis=2) > 195)
        plab, pn = ndimage.label(pl)
        for j in range(1, pn + 1):
            yy2, xx2 = np.where(plab == j)
            if len(yy2) < 300:
                continue
            if xx2.min() <= 2 or xx2.max() >= part.width - 3:
                pa[plab == j, 3] = 0
        part = Image.fromarray(pa, 'RGBA')
        file = f'kaiji-{i}.png'
        part.save(os.path.join(OUT, file))
        top = np.array(part)[:, :, 3] > 128
        band = top[:max(1, int(part.height * .14))]
        yy, xx = np.where(band)
        entries.append({'file': file, 'w': part.width, 'h': part.height,
                        'headX': int(round(xx.mean())) if len(xx) else part.width // 2,
                        'headY': int(round(part.height * .10)),
                        'source': [x0, 0], 'sheet': 'kaiji-ref', 'name': name, 'intact': True})
    data = json.load(open(MANIFEST, encoding='utf-8'))
    data['kaiji'] = entries
    json.dump(data, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for e in entries:
        print(f'{e["file"]:14s} {e["w"]}x{e["h"]} head=({e["headX"]},{e["headY"]}) {e["name"]}')

    # 群像：白底直接換成黃昏街道的漸層
    W, H = 1920, 1080
    bgim = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(bgim)
    top = np.array([10, 14, 30], dtype=np.float32)
    mid = np.array([70, 40, 60], dtype=np.float32)
    bot = np.array([210, 130, 70], dtype=np.float32)
    for y in range(H):
        u = y / (H - 1)
        c = top + (mid - top) * (u / .62) if u < .62 else mid + (bot - mid) * ((u - .62) / .38)
        d.line([(0, y), (W, y)], fill=tuple(int(v) for v in c) + (255,))
    # 八人橫向很寬，按寬度適配才不會被裁掉兩側
    w = W
    h = int(full.height * w / full.width)
    sp = full.resize((w, h), Image.LANCZOS)
    bgim.alpha_composite(sp, (0, (H - h) // 2 + 40))
    bgim.save(os.path.join(ROOT, 'assets/ref/kaiji-group.png'))
    print('群像 → assets/ref/kaiji-group.png')


if __name__ == '__main__':
    main()
