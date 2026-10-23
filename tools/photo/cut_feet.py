"""Give the product cut-outs of Cabana and Verdant (public/img/studio/cut/) their feet back.

These are the lit photographs on the home page's shelf, the shop's candle heading, the coaching page and the empty cart.
Like the picker's copies, they were cropped at the bottom through the small tin and the lid leaning on the tumbler, so
both stood on a flat cut. They share the picker photographs' geometry exactly (same crop, same scale), so the same repair
applies: the lid is completed as a disc round its own centre and the tin's wall carried down to a bottom ellipse that
matches its rim (picker_foot.extend; nothing new is invented, every pixel comes from the photograph's own colours).
Run it once, on the cropped cut-outs (run again, it would extend them again). Prints the new sizes for the markup.
Usage: python3 -I tools/photo/cut_feet.py <repo>/public/img/studio/cut
"""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from picker_foot import CANDLES, lid_circle, extend  # noqa: E402

D = sys.argv[1]
for name, cfg in CANDLES.items():
    im = np.asarray(Image.open(f'{D}/{name}-900.webp').convert('RGBA')).astype(np.float32)
    lcx, R = lid_circle(im[..., 3], *cfg['lid'], im.shape[0])
    cfg['lid_fit'] = (lcx, cfg['lid'][1])
    out = Image.fromarray(np.clip(extend(im, cfg, R), 0, 255).astype(np.uint8), 'RGBA')
    out.save(f'{D}/{name}-900.webp', 'WEBP', quality=86, method=6)
    out.resize((480, round(out.height * 480 / out.width)), Image.LANCZOS).save(f'{D}/{name}-480.webp', 'WEBP', quality=84, method=6)
    print(f'{name}: {im.shape[1]} x {im.shape[0]} -> {out.width} x {out.height}')
