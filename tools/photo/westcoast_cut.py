"""The Westcoast deodorant cut-out (public/img/studio/cut/westcoast.webp): the open jar resting on a closed one.

The first cut ran background removal over the whole photograph, which lost most of the black label and the left of the
lower jar (they read as background against the dark plant pot), so the jar had holes and a ragged side. This one:
  1. crops to the two jars first, so the model sees only them (isnet-general-use);
  2. drops the faint ghosts it leaves of the wall and pot (alpha under 40), keeps only the one shape that is the jars, and
     fills any hole inside it (the label is part of the jar);
  3. smooths the outline a touch (a 1 px blur of the alpha, then a gentle re-steepening, so the edge is clean but not
     stair-stepped);
  4. pushes the colours of the jar out over its last two pixels, so no wall or pot colour rings the edge.
Usage: U2NET_HOME=/root/.rembg python3 -I tools/photo/westcoast_cut.py <repo>/public/img/studio
"""
import os, sys
import numpy as np
import cv2
from PIL import Image
from rembg import remove, new_session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moon_faces import master  # noqa: E402
from tin_cutouts import push_out  # noqa: E402

OUT = sys.argv[1]
BOX = (420, 370, 710, 870)  # the two jars in the photograph

im = Image.fromarray(cv2.cvtColor(master('westcoast-deodorant'), cv2.COLOR_BGR2RGB)).crop(BOX)
cut = np.asarray(remove(im, session=new_session('isnet-general-use'))).astype(np.float32)
a = cut[..., 3]
a[a < 40] = 0
# the one shape that is the jars
n, lab, stats, _ = cv2.connectedComponentsWithStats((a > 127).astype(np.uint8), 8)
keep = (lab == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
# fill its holes: everything not reachable from the border is inside
flood = keep.copy(); h, w = flood.shape
mask = np.zeros((h + 2, w + 2), np.uint8)
cv2.floodFill(flood, mask, (0, 0), 1)
inside = keep | (1 - flood)
inside = cv2.dilate(inside, np.ones((3, 3), np.uint8))
a = np.where(inside > 0, np.maximum(a, (1 - cv2.dilate(1 - inside, np.ones((3, 3), np.uint8))) * 255), 0)
a = np.where(inside > 0, a, 0)
# a smooth, clean edge
a = cv2.GaussianBlur(a, (0, 0), 1.0)
a = np.clip((a - 128) * 1.6 + 128, 0, 255)
core = cv2.erode((a > 250).astype(np.uint8), np.ones((5, 5), np.uint8))
rgb = push_out(np.asarray(im).astype(np.float32), core)
out = np.dstack([np.clip(rgb, 0, 255), a]).round().astype(np.uint8)
res = Image.fromarray(out, 'RGBA')
res = res.crop(res.getbbox())
res.save(f'{OUT}/cut/westcoast.webp', 'WEBP', quality=88, method=6)
print('westcoast', res.size)
