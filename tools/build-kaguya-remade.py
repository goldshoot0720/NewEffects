#!/usr/bin/env python3
"""把 imagegen 重製的《超かぐや姫！》三張立繪做成可用的切圖與群像。

原本的 cast/kaguya-*.png 是從歌詞影片定格直接切出來的，畫面邊緣把腳（かぐや、ツキ）
和手臂（彩葉）裁掉了，人物在 PV 裡沒有手沒有腳。這支工具改用 imagegen 依原圖重畫的
全身立繪（assets/ref/kaguya-remade/generated-N.png，底色是燒進圖裡的棋盤格，另外用
tools/matte-vision.py 產生 transparent-N.png 的 alpha），輸出：

  - assets/ref/cast/kaguya-0..2.png（裁透明邊、加 8px 邊距）
  - cast.json 的 kaguya 群組（w/h/headX/headY）
  - 1920×1080 群像 assets/ref/kaguya-group.png

用法：python3 tools/build-kaguya-remade.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'assets', 'ref')
SRC = os.path.join(REF, 'kaguya-remade')
OUT = os.path.join(REF, 'cast')
MANIFEST = os.path.join(OUT, 'cast.json')
GROUP = 'kaguya'

# 索引順序＝PV 卡司順序；かぐや 是主唱
CHARS = [
    ('transparent-0.png', 'かぐや', 'kaguya-casual.jpg'),
    ('transparent-1.png', '彩葉', 'kaguya-beach.jpg'),
    ('transparent-2.png', 'ツキ', 'kaguya-fox.jpg'),
]


def cut_one(path, name, index):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    alpha = a[:, :, 3].astype(np.float32) / 255.0
    # 遮罩邊緣留一點漸層，稍微拉高對比去掉棋盤格殘色
    alpha = np.clip((alpha - 0.06) / 0.94, 0, 1) ** 0.9
    a[:, :, 3] = (alpha * 255).astype(np.uint8)
    ys, xs = np.where(a[:, :, 3] > 16)
    if len(xs) < 3000:
        raise RuntimeError(f'{name}: 前景太小')
    pad = 8
    x0, y0 = max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad)
    x1, y1 = min(im.width, int(xs.max()) + 1 + pad), min(im.height, int(ys.max()) + 1 + pad)
    cut = Image.fromarray(a).crop((x0, y0, x1, y1))
    file = f'kaguya-{index}.png'
    cut.save(os.path.join(OUT, file))
    arr = np.array(cut)
    top = arr[:max(1, int(cut.height * .12))]
    ty, tx = np.where(top[:, :, 3] > 128)
    head_x = int(tx.mean()) if len(tx) else cut.width // 2
    head_y = int(cut.height * .09)
    return {
        'file': file, 'w': cut.width, 'h': cut.height,
        'headX': head_x, 'headY': head_y,
        'source': [int(x0), int(y0)], 'sheet': 'kaguya-remade', 'name': name,
        # 三張都是已經擺好姿勢的立繪（舉手、跑步、彈鍵盤），拆手腳會撕裂，整張畫
        'intact': True
    }, cut


def build_group(sprites):
    W, H = 1920, 1080
    bg = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(bg)
    top = np.array([18, 14, 52], dtype=np.float32)
    mid = np.array([104, 38, 108], dtype=np.float32)
    bot = np.array([255, 172, 96], dtype=np.float32)
    for y in range(H):
        u = y / (H - 1)
        c = top + (mid - top) * (u / .62) if u < .62 else mid + (bot - mid) * ((u - .62) / .38)
        d.line([(0, y), (W, y)], fill=tuple(int(v) for v in c))
    moon = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    md = ImageDraw.Draw(moon)
    md.ellipse([250, 110, 550, 410], fill=(255, 244, 214, 205))
    moon = moon.filter(ImageFilter.GaussianBlur(5))
    bg = Image.alpha_composite(bg.convert('RGBA'), moon)
    glow = Image.new('RGB', (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(300, 250, 200, (255, 186, 100)), (760, 170, 150, (255, 140, 120)),
                           (1120, 300, 170, (255, 210, 140)), (1700, 420, 190, (255, 130, 150)),
                           (520, 760, 260, (255, 150, 90))]:
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(110))
    bg = Image.blend(bg.convert('RGB'), glow, .3).convert('RGBA')

    # 彩葉 左、ツキ 右、かぐや 站前排中央
    order = [1, 2, 0]
    slots = [(420, 1000, 640), (1520, 1000, 620), (960, 1045, 850)]
    canvas = bg
    faces = {}
    for k, idx in enumerate(order):
        sp = sprites[idx]
        x, base, hgt = slots[k]
        scale = hgt / sp.height
        w = int(sp.width * scale)
        sp2 = sp.resize((w, int(sp.height * scale)), Image.LANCZOS)
        shadow = Image.new('RGBA', (w, sp2.height), (0, 0, 0, 0))
        shadow.paste((20, 8, 30, 90), (0, 0), sp2.split()[3])
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)),
                               (x - w // 2 + 14, base - sp2.height + 18))
        canvas.alpha_composite(sp2, (x - w // 2, base - sp2.height))
        faces[idx] = [x - w // 2 + int(sp.width * scale * .5), base - hgt + int(hgt * .12)]
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(H - 320, H):
        a = int(150 * ((y - (H - 320)) / 320) ** 1.4)
        sd.line([(0, y), (W, y)], fill=(12, 6, 26, a))
    canvas.alpha_composite(shade)
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    vig = np.clip((r - .55) / .75, 0, 1) ** 1.6 * 150
    arr = np.array(canvas.convert('RGB'), dtype=np.float32)
    arr *= (1 - vig[..., None] / 255)
    Image.fromarray(arr.clip(0, 255).astype(np.uint8)).save(
        os.path.join(REF, 'kaguya-group.png'), quality=92)
    print('  -> assets/ref/kaguya-group.png (1920x1080)')
    print('  faces: [' + ', '.join(f'[{faces[i][0]}, {faces[i][1]}]' for i in range(len(sprites))) + ']')


def main():
    manifest = json.load(open(MANIFEST))
    old = {e['file']: e for e in manifest.get(GROUP, [])}
    entries, sprites = [], []
    for i, (fn, name, src) in enumerate(CHARS):
        path = os.path.join(SRC, fn)
        if not os.path.exists(path):
            raise SystemExit('缺少 ' + path)
        meta, cut = cut_one(path, name, i)
        # 保留舊切圖的來源座標（pv.js 的編號與光暈對照用）
        prev = old.get(meta['file'])
        if prev and 'source' in prev:
            meta['source'] = prev['source']
        entries.append(meta)
        sprites.append(cut)
        print(f'  {meta["file"]} {meta["w"]}x{meta["h"]}  {name}')
    manifest[GROUP] = entries
    json.dump(manifest, open(MANIFEST, 'w'), ensure_ascii=False, indent=1)
    print('cast.json: kaguya ->', len(entries))
    build_group(sprites)


if __name__ == '__main__':
    main()
