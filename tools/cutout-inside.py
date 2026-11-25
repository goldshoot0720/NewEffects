#!/usr/bin/env python3
"""Build the four INSIDE IDENTITY cast PNGs from the transparent reference sheet."""
import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CAST = ROOT / 'assets/ref/cast'
SHEET = ROOT / 'assets/ref/inside-identity/lineup.png'
NAMES = ['白河しらせ', 'ももしき', '綿宮あひる', 'すいみゃ']
PADDING = 8


def cut(sheet, index, name):
    left = sheet.width * index // len(NAMES)
    right = sheet.width * (index + 1) // len(NAMES)
    cell = sheet.crop((left, 0, right, sheet.height))
    # Remove almost transparent generation noise while keeping antialiased edges.
    alpha = cell.getchannel('A').point(lambda value: value if value > 8 else 0)
    bounds = alpha.getbbox()
    if not bounds or bounds[0] == 0 or bounds[2] == cell.width:
        raise ValueError(f'{name}: missing transparent gutter')
    cell.putalpha(alpha)
    sprite = ImageOps.expand(cell.crop(bounds), border=PADDING, fill=(0, 0, 0, 0))
    filename = f'inside-{index}.png'
    sprite.save(CAST / filename)
    head = sprite.getchannel('A').crop((0, 0, sprite.width, round(sprite.height * .14)))
    head_left, _, head_right, _ = head.point(lambda value: 255 if value > 128 else 0).getbbox()
    return {
        'file': filename, 'w': sprite.width, 'h': sprite.height,
        'headX': (head_left + head_right) // 2, 'headY': round(sprite.height * .10),
        'source': [left + bounds[0] - PADDING, bounds[1] - PADDING],
        'sheet': 'inside-ref', 'name': name, 'intact': True,
    }


def main():
    manifest = CAST / 'cast.json'
    data = json.loads(manifest.read_text(encoding='utf-8'))
    with Image.open(SHEET) as sheet:
        if sheet.mode != 'RGBA':
            raise ValueError(f'{SHEET.name} requires an alpha channel')
        data['inside'] = [cut(sheet, i, name) for i, name in enumerate(NAMES)]
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
