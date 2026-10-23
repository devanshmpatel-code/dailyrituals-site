"""Fill the pinholes left in the back rim of the Cabana glow photograph where the flame was painted out (a few transparent
pixels in rows 3..7 that show as dark dashes). Usage: python3 -I tools/photo/picker_rim.py <picker dir>"""
import sys
import numpy as np
import cv2
from PIL import Image
d = sys.argv[1]
p = f'{d}/cabana-glow-900.webp'
im = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)
x0, x1, y0, y1 = 540, 730, 0, 14
reg = im[y0:y1, x0:x1].copy()
a = reg[..., 3]
# expected alpha: closing along the rows (the rim's edge is smooth), then fill colour from the rows below
closed = cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((1, 15), np.uint8))
closed = cv2.morphologyEx(closed, cv2.MORPH_CLOSE, np.ones((5, 1), np.uint8))
hole = (closed - a) > 30
print('holes', int(hole.sum()))
rgb = reg[..., :3]
# premultiplied blur of the colour, ignoring the holes
w = (a / 255.0) * (~hole)
num = cv2.GaussianBlur(rgb * w[..., None], (0, 0), 3)
den = cv2.GaussianBlur(w, (0, 0), 3)[..., None]
fill = num / np.maximum(den, 1e-3)
reg[..., :3] = np.where(hole[..., None], fill, rgb)
reg[..., 3] = np.where(hole, closed, a)
im[y0:y1, x0:x1] = reg
o = Image.fromarray(np.clip(im + 0.5, 0, 255).astype(np.uint8), 'RGBA')
o.save(p, quality=90, method=6)
o.resize((480, round(480 * o.height / o.width)), Image.LANCZOS).save(f'{d}/cabana-glow-480.webp', quality=90, method=6)
