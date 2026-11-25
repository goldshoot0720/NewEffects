#!/usr/bin/env python3
# 逆境無頼カイジ OP/ED 用：白底八人立繪切出八張透明 PNG＋一張 1920×1080 群像。
# 八人靠得很近（只有最左邊有完全透明列），依各高度的外輪廓分開袖口與鞋尖。
import json, os
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
from lineup_cutouts import split_lineup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/ref/cast')
MANIFEST = os.path.join(OUT, 'cast.json')
SRC = os.path.join(ROOT, 'assets/ref/kaiji/lineup.jpg')

# 索引＝PV 卡司順序；主唱是中央的開司
CHARS = ['船井', '遠藤勇次', '古畑', '北見', '伊藤開司', '石田', '大槻', '兵藤和尊']
# (y, x) guides follow the overlap of each pair, including their shoe tips.
DIVIDERS = [
    [(270, 227), (298, 224), (348, 234), (385, 239), (495, 220), (670, 225), (710, 225)],
    [(200, 438), (350, 416), (470, 416), (655, 422), (710, 416)],
    [(250, 640), (315, 643), (352, 648), (375, 635), (445, 613), (640, 631), (710, 606)],
    [(210, 842), (280, 847), (290, 840), (300, 843), (307, 835), (320, 837), (337, 834), (346, 845), (360, 846), (375, 853),
     (411, 847), (657, 840), (710, 823)],
    [(210, 1096), (275, 1100), (288, 1097), (295, 1103), (303, 1101), (310, 1107), (326, 1103), (340, 1105), (350, 1097), (395, 1106), (710, 1100)],
    [(225, 1314), (290, 1318), (320, 1317), (330, 1318), (337, 1316), (345, 1321), (357, 1320), (366, 1325), (377, 1323), (389, 1330),
     (425, 1340), (650, 1320), (710, 1341)],
    [(260, 1563), (328, 1548), (354, 1552), (380, 1554), (404, 1557),
     (443, 1560), (474, 1560), (633, 1556), (683, 1544), (709, 1562)],
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
    # White spaces between legs/sleeves can be enclosed by the floor shadow.
    # Select complete background regions reaching the floor to preserve white shoes.
    labels, _ = ndimage.label(nw)
    for label, bounds in enumerate(ndimage.find_objects(labels), 1):
        rows, _ = bounds
        if rows.start > im.height * .4 and rows.stop > im.height * .93 and rows.stop - rows.start > 75:
            region = alpha[bounds]
            region[labels[bounds] == label] = 0
    # The neutral floor shadow joins neighbouring shoes. Flood from the
    # cleared background, stopping at the darker outline of each shoe.
    floor = np.arange(im.height)[:, None] > im.height * .94
    shadow = floor & (np.ptp(a, axis=2) < 12) & (lum > 86)
    alpha[ndimage.binary_propagation((alpha == 0) & floor, mask=shadow)] = 0
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 0.6)
    alpha = np.clip(np.minimum(alpha.astype(np.float32) + 10, soft * 1.04), 0, 255).astype(np.uint8)
    full = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')
    entries = []
    for i, (part, source) in enumerate(split_lineup(full, DIVIDERS)):
        name = CHARS[i]
        file = f'kaiji-{i}.png'
        part.save(os.path.join(OUT, file))
        top = np.array(part)[:, :, 3] > 128
        band = top[:max(1, int(part.height * .14))]
        yy, xx = np.where(band)
        entries.append({'file': file, 'w': part.width, 'h': part.height,
                        'headX': int(round(xx.mean())) if len(xx) else part.width // 2,
                        'headY': int(round(part.height * .10)),
                        'source': source, 'sheet': 'kaiji-ref', 'name': name, 'intact': True})
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
