"""Cut out and encode the Tripo Studio renders for the cartoons page.

Usage: python tests/tools/process-art.py [bg|props|generics ...]   (from the repo root; no args = all)
Needs: Pillow (bg); rembg (isnet-general-use model under ~/.rembg/models/isnet-general-use), Pillow, numpy, scipy.
Sources live outside the repo (override with CARTOONS_ART_SRC).
`reels` prints the barn seam and the 13 painted reels (centre, radius) of the master, in px and % of the scene,
for DEFAULT_LAYOUT in cartoons/drivein-core.js.
Outputs:
  cartoons/art/bg-{1280,1920,2560,3840}.webp       barn background (barn-reels-4k.jpeg: reels on fairy lights), several widths
  cartoons/props/<id>.webp                         episode alpha cut-outs, cropped, max 256 px (48 px list thumbnails, coming-soon card)
  cartoons/props/generic-1..12.webp                seat-savers split from generics-sheet.png (row-major)
"""
import os
import sys
from pathlib import Path
os.environ.setdefault('U2NET_HOME', str(Path.home() / '.rembg' / 'models' / 'isnet-general-use'))  # local model; avoids a download
import numpy as np
from PIL import Image

SESSION = None  # rembg is only loaded for the cut-out steps
ROOT = Path(__file__).resolve().parents[2]
C = ROOT / 'cartoons'
SRC = Path(os.environ.get('CARTOONS_ART_SRC', r'C:\Users\loopy\Nikeverse-cartoons\outputs\nikepig-website-cartoons-art-src'))
PROP_MAX, PROP_KB, BG_KB = 256, 40, 600
ALPHA_MIN = 12  # alpha below this is treated as empty when cropping (drops faint shadow haze)
# rembg reads near-white paint (the pilot poster paper, the c5 bedsheet) as see-through. For these, fill the enclosed
# holes of the solid mask. Not applied globally: chairs, coat racks etc. have real see-through gaps.
FILL_HOLES = {'pilot', 'c5'}


def remove(img):
    """rembg alpha on the untouched source colours (rembg blacks out the RGB it thinks is background)."""
    global SESSION
    from rembg import remove as _remove, new_session
    if SESSION is None:
        SESSION = new_session('isnet-general-use')
    rgb = img.convert('RGB')
    out = rgb.copy()
    out.putalpha(_remove(rgb, session=SESSION, only_mask=True))
    return out


def crop_alpha(img, pad=4):
    a = np.array(img.getchannel('A'))
    ys, xs = np.nonzero(a >= ALPHA_MIN)
    l, t, r, b = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    return img.crop((max(l - pad, 0), max(t - pad, 0), min(r + pad, img.width), min(b + pad, img.height)))


def fit(img, max_side):
    s = max_side / max(img.size)
    return img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS) if s < 1 else img


def save_webp(img, out, q, limit_kb=None, alpha=False):
    """Encode at quality q, stepping down by 5 until under limit_kb (floor 50)."""
    while True:
        kw = dict(quality=q, method=6)
        if alpha:
            kw['alpha_quality'] = 90
        img.save(out, 'WEBP', **kw)
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


def props():
    from scipy import ndimage
    for src in sorted((SRC / 'props').glob('*.png')):
        if src.stem in ('generics-sheet', 'reel'):  # the sheet is split by generics(); the reel cut-out is unused
            continue
        cut = remove(Image.open(src))
        if src.stem in FILL_HOLES:
            a = np.array(cut.getchannel('A'))
            cut.putalpha(Image.fromarray(np.maximum(a, ndimage.binary_fill_holes(a >= 128).astype(np.uint8) * 255)))
        cut = crop_alpha(cut)
        save_webp(fit(cut, PROP_MAX), C / 'props' / (src.stem + '.webp'), 85, PROP_KB, alpha=True)


def generics(cols=4, rows=3, max_side=480):
    """Split the 4x3 seat-saver sheet: connected components of the alpha mask, grouped by grid cell (so the two
    boots stay one prop), numbered row-major as generic-1..12."""
    from scipy import ndimage
    cut = remove(Image.open(SRC / 'props' / 'generics-sheet.png'))
    a = np.array(cut.getchannel('A'))
    lab, n = ndimage.label(a >= ALPHA_MIN)
    cells = {}
    min_px = a.size * 0.0005  # ignore specks
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        area = int((lab[sl] == i).sum())
        if area < min_px:
            continue
        cy, cx = ndimage.center_of_mass(lab == i)
        k = int(cy * rows / a.shape[0]) * cols + int(cx * cols / a.shape[1])
        cells.setdefault(k, []).append(i)
    if sorted(cells) != list(range(cols * rows)):
        raise SystemExit(f'generics sheet: expected {cols * rows} cells, got {sorted(cells)}')
    for k in range(cols * rows):
        mask = np.isin(lab, cells[k])
        rgba = np.array(cut)
        rgba[..., 3] = np.where(ndimage.binary_dilation(mask, iterations=2), rgba[..., 3], 0)
        img = crop_alpha(Image.fromarray(rgba, 'RGBA'))
        save_webp(fit(img, max_side), C / 'props' / f'generic-{k + 1}.webp', 85, PROP_KB, alpha=True)


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
    steps = {'bg': background, 'props': props, 'generics': generics, 'reels': reels}
    for name in sys.argv[1:] or ['bg', 'props', 'generics']:
        steps[name]()
