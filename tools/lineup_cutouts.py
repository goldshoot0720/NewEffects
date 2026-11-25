"""Separate neighbouring figures along the background or the ink between them."""
import numpy as np
from PIL import Image


def divider(pixels, guide):
    height, width = pixels.shape[:2]
    rows, columns = zip(*guide)
    center = np.interp(np.arange(height), rows, columns)
    left = max(0, int(min(columns)) - 28)
    right = min(width, int(max(columns)) + 29)
    x = np.arange(left, right)
    band = pixels[:, left:right]
    # Prefer empty space, then the dark outline where two sleeves touch.
    ink = band[:, :, :3].mean(axis=2)
    cost = (band[:, :, 3] / 255) * (30 + ink * .4) + abs(x - center[:, None]) * .4
    # At a measured contact point the closest dark stroke can belong to
    # clothing inside the next figure. Keep the path on the annotated seam.
    for row, col in guide:
        if row < height:
            cost[row] += (x - col) ** 2 * 8
    prev = cost[0]
    steps = np.arange(-3, 4)
    trace = np.zeros(cost.shape, dtype=np.int8)
    for y in range(1, height):
        padded = np.pad(prev, 3, constant_values=np.inf)
        candidates = np.stack([padded[3+s:3+s+len(x)] + abs(s)*.6 for s in steps])
        best = np.argmin(candidates, axis=0)
        trace[y] = steps[best]
        prev = candidates[best, np.arange(len(x))] + cost[y]
    path = np.empty(height, dtype=int)
    pos = int(np.argmin(prev))
    for y in reversed(range(height)):
        path[y] = left + pos
        pos += int(trace[y, pos])
    return path


def split_lineup(full, guides):
    pixels = np.asarray(full)
    height, width = pixels.shape[:2]
    edges = [np.zeros(height, dtype=int), *(divider(pixels, guide) for guide in guides),
             np.full(height, width)]
    for left, right in zip(edges, edges[1:]):
        x0, x1 = int(left.min()), int(right.max())
        part = pixels[:, x0:x1].copy()
        x = np.arange(x0, x1)
        part[:, :, 3] *= (x >= left[:, None]) & (x < right[:, None])
        ys, xs = np.where(part[:, :, 3] > 24)
        top, bottom = int(ys.min()), int(ys.max()) + 1
        start, end = int(xs.min()), int(xs.max()) + 1
        yield Image.fromarray(part[top:bottom, start:end]), [x0 + start, top]
