"""Builds the company logos for the site from the files Rambod supplied (brand-src/originals).

For each logo:
  * <id>.png         the original artwork on a transparent background (white removed, trimmed). Colours untouched.
  * <id>-dark.png    the same artwork for the dark site: only black / grey (neutral) parts are turned white or light grey.
                     Every green pixel, every shape and every proportion stays exactly as supplied.
Both are written at 1x and 2x display height. Run: python3 brand-src/make_logos.py
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent
SRC, OUT, MASTER = ROOT / "originals", ROOT.parent / "public/brand/companies", ROOT / "masters"
HEIGHTS = {"1x": 60, "2x": 120}

def white_to_alpha(rgb, near=235, keep_highlights=False, ink=None):
    """Transparent background for artwork on white. Background = every near-white area (outside, letter counters,
    orbit gaps), except, when `keep_highlights`, small white highlights enclosed by colour (Al Chem's green spheres).
    `ink`: the solid brand colour of the coloured lettering. Coloured edge pixels are then read as that ink blended with
    white (clean edges on small JPG text) instead of being un-blended pixel by pixel. Only pixels at the background edge are un-blended from white (smooth anti-aliasing);
    everything else keeps its exact colour at full opacity."""
    f = rgb.astype(np.float64)
    nearw = f.min(axis=2) >= near
    lab, n = ndimage.label(nearw)
    chroma = f.max(axis=2) - f.min(axis=2)
    bg = nearw.copy()
    if keep_highlights:
        for i, sl in enumerate(ndimage.find_objects(lab), start=1):
            box = tuple(slice(max(s.start - 4, 0), s.stop + 4) for s in sl)
            m = lab[box] == i
            ring = ndimage.binary_dilation(m, iterations=3) & ~m
            touches_border = sl[0].start == 0 or sl[1].start == 0 or sl[0].stop == lab.shape[0] or sl[1].stop == lab.shape[1]
            if not touches_border and m.sum() < 1000 and chroma[box][ring].mean() > 20:
                bg[box][m] = False
    zone = ndimage.binary_dilation(bg, iterations=2)
    a = np.ones(f.shape[:2])
    out = f.copy()
    ua = ((255 - f) / 255).max(axis=2)          # minimal alpha that reproduces the pixel over white
    with np.errstate(divide="ignore", invalid="ignore"):
        uc = 255 - (255 - f) / ua[..., None]
    uc = np.nan_to_num(uc, nan=0.0)
    a[zone] = ua[zone]
    out[zone] = uc[zone]
    if ink is not None:
        k = np.asarray(ink, np.float64)
        d = 255 - k
        coloured = ((f[..., 1] - np.maximum(f[..., 0], f[..., 2])) > 4)  # greenish edge pixels, even faint JPG ones
        a[coloured] = np.clip(((255 - f[coloured]) @ d) / (d @ d), 0, 1)
        out[coloured] = k
    return np.dstack([np.clip(out, 0, 255), a * 255])

def solid_ink(rgb):
    """Median colour of the solid, strongly coloured pixels (the green wordmark)."""
    f = rgb.astype(np.float64)
    strong = (f.max(axis=2) - f.min(axis=2)) > 120
    strong = ndimage.binary_erosion(strong, iterations=2)
    return np.median(f[strong], axis=0)

def to_dark(rgba, globe_rows=None):
    """Neutral (black/grey) pixels become white, keeping alpha, so they read on a dark page. Green is untouched.
    `globe_rows`: rows of a grey-gradient globe that is lightened instead (grey stays a gradient, light grey to white)."""
    f = rgba.astype(np.float64)
    rgb, a = f[..., :3], f[..., 3]
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    w = np.clip(1 - (chroma - 18) / 30, 0, 1)    # 1 = neutral, 0 = coloured; soft ramp keeps blends smooth
    lum = rgb.mean(axis=2)
    target = np.full(lum.shape, 255.0)
    if globe_rows is not None:
        g = np.zeros(lum.shape, bool); g[globe_rows] = True
        target[g] = 175 + 80 * (lum[g] / 255)
    new = rgb * (1 - w[..., None]) + target[..., None] * w[..., None]
    return np.dstack([np.clip(new, 0, 255), a])

def globe_alpha(rgb, rows):
    """Uniquem's grey globe on white: opacity from darkness (stripes solid, edges smooth), colour kept for lightening."""
    f = rgb.astype(np.float64)
    lum = f.mean(axis=2)
    a = np.clip((253 - lum) / 16, 0, 1)  # gaps are pure white; the stripe sheen (to ~240) stays solid
    a[~ndimage.binary_dilation(a > 0.9, iterations=1)] = 0  # drop stray JPG specks that touch no solid stripe
    return a, rows

def trim(rgba, pad=2):
    ys, xs = np.nonzero(rgba[..., 3] > 6)
    y0, y1, x0, x1 = max(ys.min() - pad, 0), ys.max() + pad + 1, max(xs.min() - pad, 0), xs.max() + pad + 1
    return rgba[y0:y1, x0:x1]

def save(arr, name):
    im = Image.fromarray(np.round(arr).astype(np.uint8), "RGBA")
    MASTER.mkdir(exist_ok=True); im.save(MASTER / f"{name}.png", optimize=True)
    sizes = {}
    for tag, h in HEIGHTS.items():
        w = round(im.width * h / im.height)
        # resize in premultiplied space so transparent edges never pick up a dark or white fringe
        r = im.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
        r.save(OUT / f"{name}{'' if tag == '1x' else '@2x'}.png", optimize=True)
        sizes[tag] = (w, h)
    return sizes

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for cid, fname in [("uniquem", "uniquem.jpg"), ("uniqenergy", "uniqenergy.png"), ("kemko", "kemko.png"), ("alchem", "alchem.png")]:
        im = Image.open(SRC / fname)
        rgb = np.asarray(im.convert("RGB"))
        has_alpha = im.mode == "RGBA" and np.asarray(im)[..., 3].min() < 250
        rgba = np.asarray(im.convert("RGBA")).astype(np.float64) if has_alpha else white_to_alpha(
            rgb, keep_highlights=cid == "alchem", ink=solid_ink(rgb) if cid == "uniquem" else None)
        globe = None
        if cid == "uniquem":
            text_top = int(np.nonzero(((rgb.max(axis=2).astype(int) - rgb.min(axis=2)) > 60).any(axis=1))[0].min())  # first green row = wordmark
            globe = slice(0, text_top - 4)
            ga, _ = globe_alpha(rgb[globe], globe)
            rgba = rgba.copy(); rgba[globe, :, 3] = ga * 255; rgba[globe, :, :3] = rgb[globe]
        rgba = trim(rgba)
        if globe is not None:  # the trim moved rows; recompute the globe band on the trimmed array
            ys = np.nonzero((rgba[..., :3].max(axis=2) - rgba[..., :3].min(axis=2) > 60).any(axis=1))[0]
            globe = slice(0, int(ys.min()) - 4)
        report[cid] = save(rgba, cid)
        save(to_dark(rgba, globe), f"{cid}-dark")
    print(report)

if __name__ == "__main__":
    main()
