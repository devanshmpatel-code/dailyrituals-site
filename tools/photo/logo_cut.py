"""The Daily Rituals Co. logo, lifted off its black square into a clean transparent mark.

    python3 -I tools/photo/logo_cut.py public/img/studio/logo.jpg public/img/brand

The logo Claire sent (logo.jpg) is two inks on black: white "Daily Rituals" and cream "Co.", the underline,
"HANDMADE ARTISAN GOODS" and the "MADE IN WHITE ROCK, BC" arc. Because the ground is black, every pixel is simply
ink x coverage, so the coverage (alpha) can be read straight back out of the photograph instead of cut with a mask:

1. each pixel is assigned to one of the two inks. A JPEG keeps colour at half resolution (4:2:0), so the thin cream
   letters lose much of their warmth at their edges and cannot be judged pixel by pixel. Instead each letter (each
   connected shape) is judged as a whole: the cream letters lean red-minus-blue, the white ones not at all. Faint edge
   pixels outside every shape take the ink of the nearest letter;
2. alpha = the pixel's projection on its ink colour (p . ink / ink . ink), so the soft anti-aliased edges keep exactly
   the softness they had in the artwork;
3. a little JPEG noise is clipped at both ends (the black ground's speckle becomes fully clear, the slight ringing
   inside the letters becomes fully solid), then the colour is set to the exact ink everywhere: no grey fringe, no
   black halo on a dark page, white and cream stay exactly white and cream.

The stray white line along the top edge of the file is dropped with the rest of the ground (the crop starts below it).
Writes logo-1200.webp, logo-600.webp and logo.png (full size, for anything that is not a browser).
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

WHITE = np.array([255.0, 255.0, 255.0])
CREAM = np.array([234.0, 208.0, 169.0])  # the median of the cream letters' solid pixels


def cut(src: Path) -> Image.Image:
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float64)
    rgb[:4] = 0  # the stray line along the very top of the file
    # 1. which ink, letter by letter: the median "warmth" (red minus blue, relative to red) of each shape's solid pixels.
    # Solid cream is (234-169)/234 = 0.28 and its thin letters measure 0.12 to 0.18 after the JPEG; white measures 0.
    lum = rgb.mean(2)
    warmth = (rgb[..., 0] - rgb[..., 2]) / np.maximum(rgb[..., 0], 1.0)
    n, lab, _, _ = cv2.connectedComponentsWithStats((lum > 25).astype(np.uint8), connectivity=8)
    cream_shape = np.zeros(lum.shape, bool)
    white_shape = np.zeros(lum.shape, bool)
    for i in range(1, n):
        sel = lab == i
        solid = warmth[sel & (lum > 120)]
        w = float(np.median(solid)) if solid.size else float(np.median(warmth[sel]))
        (cream_shape if w > 0.04 else white_shape)[sel] = True
    # every other pixel takes the ink of the nearest letter
    d_cream = cv2.distanceTransform((~cream_shape).astype(np.uint8), cv2.DIST_L2, 5)
    d_white = cv2.distanceTransform((~white_shape).astype(np.uint8), cv2.DIST_L2, 5)
    cream_ink = d_cream < d_white
    ink = np.where(cream_ink[..., None], CREAM, WHITE)
    # 2. coverage from the projection on the ink colour
    a = (rgb * ink).sum(2) / (ink * ink).sum(2)
    # 3. clip the JPEG's speckle and ringing, keep the anti-aliased ramp in between
    lo, hi = 0.05, 0.93
    a = np.clip((a - lo) / (hi - lo), 0, 1)
    out = np.dstack([ink, a * 255.0]).round().clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    # trim to the artwork, with a small even margin so a glow round it is never cut square
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    pad = 24
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
    return im.crop(box)


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    im = cut(src)
    im.save(out / 'logo.png', optimize=True)
    for w in (1200, 600):
        r = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        # (resizing premultiplies internally in Pillow for RGBA, so the edges stay clean; the colour is one ink anyway)
        r.save(out / f'logo-{w}.webp', quality=92, method=6, exact=True)
        print(out / f'logo-{w}.webp', r.size)


if __name__ == '__main__':
    main()
