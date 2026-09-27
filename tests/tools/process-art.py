"""Encode the barn background for the cartoons page and measure its painted reels.

Usage: python tests/tools/process-art.py [bg|reels ...]   (from the repo root; no args = bg)
Needs: Pillow (bg); Pillow, numpy, scipy (reels).
Sources live outside the repo (override with CARTOONS_ART_SRC).
`reels` prints the barn seam and the 13 painted reels (centre, radius) of the master, in px and % of the scene,
for DEFAULT_LAYOUT in cartoons/drivein-core.js.
Outputs:
  cartoons/art/bg-{1280,1920,2560,3840}.webp       barn background (barn-reels-4k.jpeg: reels on fairy lights), several widths
Episodes have no prop art (user decision 2026-09-27): the list and screen use YouTube thumbnails and art/reel.svg.
"""
import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
C = ROOT / 'cartoons'
SRC = Path(os.environ.get('CARTOONS_ART_SRC', r'C:\Users\loopy\Nikeverse-cartoons\outputs\nikepig-website-cartoons-art-src'))
BG_KB = 600


def save_webp(img, out, q, limit_kb=None):
    """Encode at quality q, stepping down by 5 until under limit_kb (floor 50)."""
    while True:
        img.save(out, 'WEBP', quality=q, method=6)
        kb = out.stat().st_size / 1024
        if not limit_kb or kb <= limit_kb or q <= 50:
            break
        q -= 5
    print(f'{out.relative_to(ROOT)} {img.size[0]}x{img.size[1]} q{q} {kb:.0f} KB')


def background():
    bg = Image.open(SRC / 'barn-reels-4k.jpeg').convert('RGB')
    for w in (1280, 1920, 2560, 3840):
        img = bg.resize((w, round(bg.height * w / bg.width)), Image.LANCZOS)
        save_webp(img, C / f'art/bg-{w}.webp', 82, BG_KB if w <= 1920 else None)


def reels():
    """Reels are warm-grey discs (low saturation, mid-bright) with dark holes in the top band; fill the holes, then
    take each blob's distance-transform peak as centre and radius (robust where a reel touches the roof trim). The
    radius excludes the ~3 px dark outline."""
    from scipy import ndimage
    rgb = np.asarray(Image.open(SRC / 'barn-reels-4k.jpeg').convert('RGB')).astype(float)
    H, W = rgb.shape[:2]
    band = rgb[:450]
    mx, mn = band.max(-1), band.min(-1)
    m = ((mx - mn) / np.maximum(mx, 1) < 0.42) & (mx > 115) & (band[..., 0] >= band[..., 2]) & (band[..., 1] > 0.6 * band[..., 0])
    m = ndimage.binary_opening(ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=5)), iterations=6)
    lab, _ = ndimage.label(m)
    d = ndimage.distance_transform_edt(m)
    out = []
    for i in range(1, lab.max() + 1):
        dd = np.where(lab == i, d, 0)
        r = dd.max()
        if r >= 50:
            ys, xs = np.nonzero(dd >= r - 1)
            out.append((xs.mean(), ys.mean(), r))
    out.sort()
    seam = np.median(np.asarray(Image.open(SRC / 'barn-reels-4k.jpeg').convert('L'))[:, 1150:2950], axis=1)
    dark = 200 + np.nonzero(seam[200:400] < 40)[0]  # the painted seam line is a few px thick; take its middle
    y0 = (dark.min() + dark.max()) / 2
    print(f'seam y {y0:.1f} px = {100 * y0 / H:.3f}%   reels: {len(out)}')
    for x, y, r in out:
        print(f'  x {x:7.1f} y {y:6.1f} r {r:5.1f} px   -> x {100 * x / W:.2f}% y {100 * y / H:.2f}% r {100 * r / W:.3f}% of width')


if __name__ == '__main__':
    steps = {'bg': background, 'reels': reels}
    for name in sys.argv[1:] or ['bg']:
        steps[name]()
