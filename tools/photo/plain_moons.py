"""The opening's candle moons as plain candle tops: the wax and the wooden wick only (public/img/studio/moons/hero-<moment>.webp).

Each hero moon starts from its archive face (moons/<slug>.webp, made by moon_faces.py) and has every topping taken away:

  1. the wooden wick (its dark top edge and the face of the wood below it) is found from a box read off the photograph and
     protected;
  2. the wax's own light (its soft fall-off to the rim) is estimated as a smooth field by normalised convolution over the
     pixels that are wax, filled into large holes from coarser scales; anything that is not wax (a colour, or a step
     darker or brighter than the wax round it) is masked, with a margin for the toppings' own shadows; four rounds refine
     both;
  3. the masked area is filled with the smooth wax field plus grain matched to the wax's own and its faint low swirls,
     feathered into the photograph.

Usage: python3 -I tools/photo/plain_moons.py <repo>/public/img/studio
"""
import os, sys
import numpy as np
import cv2
from PIL import Image

OUT = sys.argv[1]
HERO = {'dawn': 'spring-blooms', 'morning': 'sea-salt-sage', 'midday': 'mothers-garden', 'golden': 'apple-cider', 'night': 'lavender-haze'}
# each wick's ends (x) and a row through it, in the 520 px face, read off the photographs
WICK = {'spring-blooms': (194, 302, 263), 'sea-salt-sage': (192, 305, 245), 'mothers-garden': (216, 322, 250), 'apple-cider': (193, 309, 256), 'lavender-haze': (193, 309, 242)}
rng = np.random.default_rng(7)


def nconv(img, w, s):
    """normalised convolution: the blur of img counting only where w > 0, and how much of it there was"""
    num = cv2.GaussianBlur(img * w[..., None], (0, 0), s)
    den = cv2.GaussianBlur(w, (0, 0), s)
    return num / np.maximum(den, 1e-6)[..., None], den


def field(img, w, s0):
    """the wax's smooth light from the clean pixels, filled into large holes from coarser and coarser scales"""
    f, _ = nconv(img, w, s0 * 16)
    for s in (s0 * 8, s0 * 4, s0 * 2, s0):
        g, d = nconv(img, w, s)
        c = np.clip(d * 2.5, 0, 1)[..., None]
        f = f * (1 - c) + g * c
    return f


def wick_box(L, wax, x0, x1, sy):
    """the wick's rows: the dark run across the wick (its top edge and the face of the wood below it)"""
    prof = L[sy - 25:sy + 25, x0 + 5:x1 - 5].mean(1)
    k = int(np.argmin(prof))
    t = b = k
    while t > 0 and prof[t - 1] < wax - 14:
        t -= 1
    while b < len(prof) - 1 and prof[b + 1] < wax - 14:
        b += 1
    return sy - 25 + t, sy - 25 + b


def clean(slug):
    im = np.asarray(Image.open(f'{OUT}/moons/{slug}.webp').convert('RGBA')).astype(np.float32)
    n = im.shape[0]
    rgb, a = im[..., :3] / 255, im[..., 3] / 255
    inside = a > 0.99
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2Lab)
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    x0, x1, sy = WICK[slug]
    wax_l = float(np.median(L[180:340, 140:380]))
    t, b = wick_box(L, wax_l, x0, x1, sy)
    wick = np.zeros((n, n), bool)
    wick[t - 2:b + 3, x0 - 3:x1 + 4] = True
    # round the wick, the wax keeps its own light (the well under the wick, its soft shade): only colour is taken away there
    near = np.zeros((n, n), bool)
    near[t - 14:b + 30, x0 - 12:x1 + 12] = True
    wax = inside & ~wick
    for it in range(5):
        # (the first round measures against the wax's plain colour, so a large topping can never pass for wax)
        W = np.broadcast_to(np.median(lab[inside & ~wick & (L > wax_l - 6)], 0), lab.shape) if it == 0 else field(lab, wax.astype(np.float32), n * 0.02)
        dL = W[..., 0] - L
        dC = np.hypot(A - W[..., 1], B - W[..., 2])
        decor = inside & ~wick & ((((dL > 6) | (-dL > 5) | (dC > 6.5)) & ~near) | (dC > 14))
        decor = cv2.morphologyEx(decor.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
        wax = inside & ~wick & ~cv2.dilate(decor.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
    # what is taken away: the toppings, grown for their shadows and soft edges; never the wick
    grow = cv2.dilate(decor.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))).astype(bool) & ~wick
    clean_w = (inside & ~grow & ~wick).astype(np.float32)
    fld = field(rgb, clean_w, n * 0.012)
    # the wax's grain, measured on the clean wax
    hp = rgb - cv2.GaussianBlur(rgb, (0, 0), 3)
    sd = float(np.sqrt((hp[clean_w > 0] ** 2).mean()))
    g = cv2.GaussianBlur(rng.normal(0, 1, (n, n)).astype(np.float32), (0, 0), 0.9)
    g = g / g.std() * sd
    # and its faint low swirls (poured wax is never perfectly even)
    sw = cv2.GaussianBlur(rng.normal(0, 1, (n, n)).astype(np.float32), (0, 0), 9)
    sw = sw / sw.std() * 0.006
    fill = fld + (g + sw)[..., None] * np.array([1, 0.99, 0.97], np.float32)
    feather = np.clip(cv2.GaussianBlur(grow.astype(np.float32), (0, 0), 2.0) * 1.7, 0, 1)
    feather[wick] = 0
    out = np.clip(rgb * (1 - feather[..., None]) + fill * feather[..., None], 0, 1)
    # one even cream: the photographs' colour casts (a blue edge, a warm blot where a topping stood) go to the wax's own
    # tint, and the blotchy mid-scale marbling of the photographs is softened, keeping the wax's light (its fall-off to the
    # rim) and its fine grain; the wick (its own pixels, softly) keeps its wood
    ol = cv2.cvtColor(out.astype(np.float32), cv2.COLOR_RGB2Lab)
    wood = wick & (L < wax_l - 7)
    wood = cv2.GaussianBlur(cv2.dilate(wood.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1.2)
    keep = 1 - np.clip(wood * 1.5, 0, 1)
    tint = np.median(ol[inside & ~wick & (ol[..., 0] > wax_l - 6)][:, 1:], 0)
    k = (0.82 * keep)[..., None]
    ol[..., 1:] = ol[..., 1:] * (1 - k) + tint * k
    Lw = np.where(inside, ol[..., 0], wax_l).astype(np.float32)
    lo = cv2.GaussianBlur(Lw, (0, 0), n * 0.08)
    fine = Lw - cv2.GaussianBlur(Lw, (0, 0), 2.0)
    mid = Lw - lo - fine
    ol[..., 0] = Lw - mid * 0.5 * keep
    out = np.clip(cv2.cvtColor(ol, cv2.COLOR_Lab2RGB), 0, 1)
    # the wick's top edge, slightly charred (a wooden wick that has been lit once): its upper rows of wood a little darker
    # and browner, fading down the face of the wood
    yy = np.arange(n, dtype=np.float32)[:, None]
    char = np.clip(1 - (yy - (t - 1)) / max(3.0, (b - t) * 0.55), 0, 1) * (yy >= t - 2)
    char = (char * wood)[..., None]
    out = out * (1 - char * 0.42) + np.array([0.16, 0.10, 0.07], np.float32) * char * 0.42
    res = np.dstack([out * 255, im[..., 3]]).round().astype(np.uint8)
    return Image.fromarray(res, 'RGBA'), ((x0 + x1) / 2, (t + b) / 2, x1 - x0, b - t), n, grow


if __name__ == '__main__':
    for key, slug in HERO.items():
        img, (cx, cy, w, h), n, grow = clean(slug)
        img.save(f'{OUT}/moons/hero-{key}.webp', 'WEBP', quality=90, method=6)
        if os.environ.get('MASKS'):
            Image.fromarray((grow * 255).astype(np.uint8)).save(f"{os.environ['MASKS']}/{key}-mask.png")
        # the wick's place, for the sundial shadow (moonarc.ts WICK): centre x, y and half length, as fractions of the radius
        print(f"{key}: [{(cx - n / 2) / (n / 2):.3f}, {(cy - n / 2) / (n / 2):.3f}, {w / n:.3f}]")
