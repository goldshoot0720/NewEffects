#!/usr/bin/env python3
"""Validate deployed artwork and the shared outlines of adjacent cutouts (Pillow)."""
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CAST = Path('assets/ref/cast')
RASTER = {'.png', '.webp', '.jpg', '.jpeg', '.gif', '.avif'}
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
sizes = {}
for name in tracked:
    file = ROOT / name
    if file.suffix.lower() in RASTER:
        with Image.open(file) as image:
            image.load()
            if image.mode == 'RGBA':
                assert image.getchannel('A').getbbox(), f'Invisible image: {name}'
            sizes[name] = image.size
    elif file.suffix == '.svg':
        assert ET.parse(file).getroot().tag == '{http://www.w3.org/2000/svg}svg', name

# Match the repository spelling too, since a case-insensitive checkout can hide a bad URL.
for page in ('pv.js', 'v2.html', 'characters.html', 'archive.css'):
    source = (ROOT / page).read_text()
    for url in re.findall(r"""['"](assets/[^'"\n]+\.(?:png|webp|jpg))['"]""", source):
        assert url in sizes, f'{page}: missing {url}'

cast = json.loads((ROOT / CAST / 'cast.json').read_text())
for members in cast.values():
    for member in members:
        name = (CAST / member['file']).as_posix()
        assert sizes.get(name) == (member['w'], member['h']), f'Incorrect cutout dimensions: {name}'

# These shoe, sleeve and hand pixels belong to only one performer in the original lineups.
contacts = [('kaiji', 2, 434, 690), ('kaiji', 4, 854, 325), ('kaiji', 4, 850, 698),
            ('matryoshka', 4, 1060, 285), ('matryoshka', 3, 675, 679)]
for group, expected, x, y in contacts:
    owners = []
    for index, member in enumerate(cast[group]):
        sx, sy = member['source']
        if 0 <= x - sx < member['w'] and 0 <= y - sy < member['h']:
            with Image.open(ROOT / CAST / member['file']) as image:
                if image.getpixel((x - sx, y - sy))[3] > 100:
                    owners.append(index)
    assert owners == [expected], f'{group} pixel {(x, y)}: expected {expected}, found {owners}'

print(f'Checked {len(sizes)} raster images and {sum(map(len, cast.values()))} cutouts.')
