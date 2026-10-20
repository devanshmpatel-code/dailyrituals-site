"""The Journal's article pictures (public/img/studio/journal/<slug>.webp): ONE whole tin each, seen from above.

The owner asked (October 2026) for each article to show one candle rather than a group of tins, a different candle for
each. Each is one tin out of a bench photograph already cut by tin_cutouts.py, cut the same way (its rim's ellipse, drawn
analytically), with the rim width measured over the whole group (measured on one tin alone it takes in the neighbours'
wax). Written at the cut-out's own size (never enlarged; about 440 to 500 px).

The wax then gets one colour correction (warm_wax): in the photographs the white wax picks up a cool, bluish cast towards
the tin's lower edge (the daylight from the window, reflected off the rim), which reads as a cyan stain on a light page.
Each candle's own wax colour is read from the middle of its face, and wherever the wax is cooler than that, its colour is
pulled to it, keeping the pixel's lightness (so the soft shading of the wax stays). Only pale, nearly neutral pixels count
as wax: the toppings (wood chips, flowers, stones), the black tin, the rim and the wick are left exactly as they were.

Usage: python3 -I tools/photo/journal_singles.py <repo>/public/img/studio
"""
import os, sys
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tin_cutouts as T  # noqa: E402
from moon_faces import master  # noqa: E402

# article slug: (group in tin_cutouts.CUTS, index of the one tin kept). Each tin lies whole inside its photograph.
ONE = {
    'wooden-wick': ('jarrah-top', 1),          # wood chips beside the flat wooden wick
    'first-burn': ('mothers-garden', 2),       # one dried flower, a wide face of wax
    'candle-safety': ('black-crescent', 4),    # a curve of small black stones along the rim
    'wax-guide': ('tuscan-sandalwood', 1),     # pale crystals along one side, most of the wax bare
    'candle-and-roller': ('spring-blooms', 2), # dried flowers and buds
}


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def warm_wax(im: Image.Image) -> Image.Image:
    """Neutralise the cool cast on the wax: pull the colour (a*, b*) of every pale, near-neutral pixel that is cooler than
    the wax in the middle of the face to that warm ivory, keeping its lightness. Returns a new RGBA image."""
    rgba = np.asarray(im.convert('RGBA')).astype(np.float32)
    rgb, alpha = rgba[..., :3] / 255.0, rgba[..., 3]
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)  # L 0..100, a/b about -127..127
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    h, w = L.shape
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xs - w / 2) / (w / 2), (ys - h / 2) / (h / 2))
    chroma = np.hypot(A, B)
    # the reference: pale, low-chroma wax in the middle third of the face (the toppings and the wick left out)
    ref = (alpha > 250) & (r < 0.45) & (L > 85) & (chroma < 30)
    ta, tb = float(np.median(A[ref])), float(np.median(B[ref]))
    # the toppings, kept as they are: anything strongly coloured (petals, chips, the butterfly-pea flowers) or dark (stones,
    # the wick) inside the face, with a few pixels round each. (The rim, dark too, is the outer tenth of the cut-out; it is
    # too dark to count as wax anyway, and leaving it out of this mask lets the wax right up against it be corrected.)
    top = ((chroma > 28) | (L < 50)) & (r < 0.86) & (alpha > 250)
    top = cv2.dilate(top.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))).astype(np.float32)
    # how surely a pixel is wax: light (well above the rim, the wick and the toppings), not strongly coloured, inside the
    # cut-out, not a topping, and cooler than the reference (a warmer pixel is left alone). The cast runs from a faint
    # grey-blue to a clear cyan (b* down to about -24) next to the rim, so the colour limit is wide on the cool side.
    m = smooth(L, 55, 70) * (1 - smooth(chroma, 28, 36)) * smooth(alpha, 200, 255) * smooth(tb - B, 0, 2) * (1 - top)
    m = cv2.GaussianBlur(m, (0, 0), 1.0)  # no hard seams
    lab2 = lab.copy()
    lab2[..., 1] = A + (ta - A) * m
    lab2[..., 2] = B + (tb - B) * m
    out = np.clip(cv2.cvtColor(lab2, cv2.COLOR_LAB2RGB), 0, 1) * 255
    res = np.dstack([out, alpha]).round().astype(np.uint8)
    print(f'  wax reference a* {ta:.1f} b* {tb:.1f}; {int((m > 0.5).sum())} px warmed')
    return Image.fromarray(res, 'RGBA')


if __name__ == '__main__':
    studio = sys.argv[1]
    os.makedirs(f'{studio}/journal', exist_ok=True)
    for slug, (grp, k) in ONE.items():
        cfg = dict(T.CUTS[grp])
        if not cfg.get('rim'):
            bgr = master(cfg['src'])
            V = cv2.GaussianBlur(cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[..., 2], (3, 3), 0).astype(np.float32)
            es = [T.fit(V, s, cfg.get('outer', False)) for s in cfg['tins']]
            cfg['rim'] = T.rim_width(cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32), es)
        cfg['tins'] = [cfg['tins'][k]]
        name = f'journal-tmp-{slug}'
        im = T.cutout(name, cfg, studio, None)  # (narrower than 900 px, so this is the size written)
        for wd in T.WIDTHS:
            os.remove(f'{studio}/tins/{name}-{wd}.webp')
        assert im.width <= 900
        print(slug)
        warm_wax(im).save(f'{studio}/journal/{slug}.webp', 'WEBP', quality=86, method=6)
