"""Make the unlit candle photographs from the lit ones with the flames removed (picker/<n>-glow-900.webp).

What a flame does to the photograph, and what this takes away again:
  - the wax and the inside of the white glass glow warm, brightest close to the wick: unlit, they fall to the cool, dim
    light of the night, darker towards the wick (where the flame was the main light) and darkest in the well of the tumbler;
  - the white glass rim and walls carry warm light: unlit they are a cool, soft white-grey, keeping their highlights;
  - the charred wooden wick glows orange at its foot: unlit it is dark wood;
  - a few warm reflections of the flames sit on the glossy black label: they are cooled, but the label and its lettering
    (white) are otherwise left exactly as they are.
Usage: python3 -I tools/photo/picker_unlit.py <picker dir> <outdir>
"""
import sys
import numpy as np
import cv2
from PIL import Image

src, out = sys.argv[1], sys.argv[2]

# geometry at 900 wide (measured on the photographs): wicks, the lid in front (left alone), the tin's wax face
CANDLES = {
    'cabana': dict(wicks=[(620, 97, 330), (204, 667, 150)], lid=((617, 694), 193), tin=((203, 647), (178, 50)),
                   tumbler=(345, 0, 900, 640), gain=1.17),
    'verdant': dict(wicks=[(662, 96, 300), (185, 573, 140)], lid=((531, 630), 178), tin=((184, 556), (168, 44)),
                    tumbler=(392, 20, 900, 640), gain=1.0),
}

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def run(name, cfg):
    im = np.asarray(Image.open(f'{src}/{name}-glow-900.webp').convert('RGBA')).astype(np.float32) / 255
    h, w = im.shape[:2]
    rgb, a = im[..., :3], im[..., 3]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    L = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)

    (lx, ly), lr = cfg['lid']
    lid = ((xx - lx) ** 2 + (yy - ly) ** 2 <= lr ** 2).astype(np.float32)
    lid = cv2.GaussianBlur(lid, (0, 0), 1.5)
    # the label: the large dark band on the tumbler, with the lettering inside it (holes filled)
    x0, y0, x1, y1 = cfg['tumbler']
    box = np.zeros((h, w), np.uint8); box[y0:y1, x0:x1] = 1
    dark = ((L < 0.2) & (a > 0.5) & (box > 0) & (lid < 0.01)).astype(np.uint8)
    dark = cv2.erode(dark, np.ones((3, 3), np.uint8))
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(dark)
    big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    label = (lab == big).astype(np.uint8)
    label = cv2.morphologyEx(label, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    # fill the holes (the lettering)
    ff = label.copy(); m = np.zeros((h + 2, w + 2), np.uint8); cv2.floodFill(ff, m, (0, 0), 1)
    label = label | (1 - ff)
    # keep the lettering column-wise between the band's top and bottom
    for x in range(w):
        col = np.where(label[:, x] > 0)[0]
        if len(col): label[col.min():col.max() + 1, x] = 1
    label = cv2.erode(label, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    labelS = cv2.GaussianBlur(label.astype(np.float32), (0, 0), 2.0)


    # how much of each pixel's light came from the flames: strongest close to a wick
    near = np.zeros((h, w), np.float32)
    for (wx, wy, s) in cfg['wicks']:
        near = np.maximum(near, np.exp(-(((xx - wx) / s) ** 2 + ((yy - wy) / (s * 0.75)) ** 2)))

    # ---- the unlit grade (glass, wax, rims) ----
    # luminance: the flame's light removed, the rest compressed into a dim night range, highlights kept
    Lu = L * cfg['gain'] * (0.82 - 0.34 * near)
    Lu = Lu + 0.18 * smooth(0.82, 1.0, L) * L * (1 - near)  # the specular lines on glass catch the ambient light
    Lu = np.clip(Lu, 0, 1) ** 1.06
    # colour: cool white-grey, a trace of the original hue
    cool = np.array([0.93, 0.94, 1.0], np.float32)
    chroma = rgb / np.maximum(L[..., None], 1e-4)
    chroma = 1 + (chroma - 1) * 0.15
    newrgb = Lu[..., None] * cool * chroma
    # the charred wick in the tin (the tumbler's is hidden by its rim): no ember (warm, saturated, mid-dark, at the wick)
    wnear = np.zeros((h, w), np.float32)
    for (wx, wy, s) in cfg['wicks'][1:]:
        wnear = np.maximum(wnear, np.exp(-(((xx - wx) / (s * 0.22)) ** 2 + ((yy - wy) / (s * 0.12)) ** 2)))
    ember = smooth(0.35, 0.7, sat) * (rgb[..., 0] > rgb[..., 2] * 1.4) * smooth(0.12, 0.3, L) * (1 - smooth(0.5, 0.7, L)) * smooth(0.2, 0.6, wnear)
    wood = np.array([0.16, 0.13, 0.12], np.float32) * (0.6 + 0.8 * L[..., None])
    newrgb = newrgb * (1 - ember[..., None] * 0.85) + wood * (ember[..., None] * 0.85)

    # where to apply: everything except the label and the lid; dark neutral parts barely change anyway
    keep = np.clip(labelS + lid, 0, 1)
    # on the label: only cool the warm reflections on the black (not the white lettering)
    warmrefl = smooth(0.25, 0.5, sat) * smooth(1.15, 1.4, rgb[..., 0] / np.maximum(rgb[..., 2], 1e-3)) * (L < 0.75) * labelS * (1 - lid)
    lrgb = rgb.copy()
    gray = (L * 0.8)[..., None] * np.array([0.92, 0.94, 1.0], np.float32)
    lrgb = lrgb * (1 - warmrefl[..., None] * 0.85) + gray * (warmrefl[..., None] * 0.85)
    # dark tin bodies: graded too, but they hardly move (they are near black)
    res = newrgb * (1 - keep[..., None]) + lrgb * keep[..., None]
    outim = np.dstack([np.clip(res, 0, 1), a])
    o = Image.fromarray((outim * 255 + 0.5).astype(np.uint8), 'RGBA')
    o.save(f'{out}/{name}-unlit-900.webp', quality=88, method=6)
    o.resize((480, round(480 * h / w)), Image.LANCZOS).save(f'{out}/{name}-unlit-480.webp', quality=88, method=6)
    Image.fromarray((label * 255).astype(np.uint8)).save(f'{out}/{name}-labelmask.png')
    return o

for n, c in CANDLES.items():
    run(n, c)
print('ok')
