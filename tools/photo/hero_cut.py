"""Polished product cut-outs for Cabana and Verdant (lit tumbler + small tin + lid).

1. Cut out from the retouched master (isnet), hard alpha with soft edges.
2. Remove flash specks (dust, scratches, fingerprints) on the black tin and lid: small bright features on dark
   surfaces in the lower part of the frame are found with a top-hat and inpainted; the dark metal is then smoothed
   lightly (bilateral) so it reads as clean matte black. The labels (large bright areas) are untouched.
3. The photograph's straight bottom edge is kept; the page sets the candles on a lit surface that fades it out.
Usage: python3 -I hero_cut.py <master.png> <out.png>
"""
import sys
import numpy as np, cv2
from PIL import Image
from rembg import remove, new_session

src, out = sys.argv[1], sys.argv[2]
pil = Image.open(src).convert('RGB')
rgb = np.array(pil)
H, W = rgb.shape[:2]
alpha = np.array(remove(pil, session=new_session('isnet-general-use'), only_mask=True)).astype(np.float32) / 255
alpha = np.clip((alpha - 0.15) / 0.7, 0, 1)

# ---- 2. flash specks on dark metal (lower 45% of the frame, where the tin and lid are) ----
bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
dark = (cv2.GaussianBlur(gray, (0, 0), 6) < 70).astype(np.uint8)
zone = np.zeros_like(dark); zone[int(H * 0.55):, :] = 1
bright = (gray > 165).astype(np.uint8)
nb, lb, sb, _ = cv2.connectedComponentsWithStats(bright, 8)
big = np.zeros_like(bright)
for i in range(1, nb):
    if sb[i, cv2.CC_STAT_AREA] > 1500: big[lb == i] = 1
protect = cv2.dilate(big, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
removed = 0
# two passes: fine dust and scratches, then larger fingerprint smudges
for ksize, maxarea, thr in [(13, 160, 22), (35, 1200, 16)]:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize)))
    spec = ((tophat > thr) & (dark > 0) & (zone > 0)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(spec, 8)
    # lettering sits in rows of marks close together; dust and smudges do not
    boxes = [(st[i, 0] + st[i, 2] / 2, st[i, 1] + st[i, 3] / 2, i) for i in range(1, n) if st[i, cv2.CC_STAT_AREA] <= maxarea]
    mask = np.zeros_like(spec)
    for (cx, cy, i) in boxes:
        if sum(1 for (ox, oy, j) in boxes if j != i and abs(oy - cy) < 7 and abs(ox - cx) < 60) >= 2: continue
        if protect[int(cy), int(cx)]: continue
        mask[lab == i] = 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    bgr = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    removed += int(mask.sum() / 255)
smooth = cv2.bilateralFilter(bgr, 15, 38, 15)
m = (cv2.GaussianBlur((dark & zone & (1 - protect)).astype(np.float32), (0, 0), 3))[..., None] * 0.85
bgr = (bgr * (1 - m) + smooth * m).astype(np.uint8)
rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
print('specks removed:', removed)

a2 = cv2.GaussianBlur(alpha, (0, 0), 0.7)
rgb2 = rgb
img = Image.fromarray(np.dstack([rgb2, (a2 * 255).astype(np.uint8)]), 'RGBA')
img = img.crop(img.getbbox())
img.save(out)
print(out, img.size)
