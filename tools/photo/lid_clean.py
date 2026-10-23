"""Clean matte finish on a tin lid: the lid's disc (found with HoughCircles) is replaced inside its rim by a smooth
version of itself (normalised blur of lid pixels only, soft top light, fine grain), except the printed scent sticker,
which is located from its white lettering and kept untouched. Usage: python3 -I lid_clean.py <in.png> <out.png> x y r"""
import sys
import numpy as np, cv2
from PIL import Image
src, out, x, y, r = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:6])
im = np.array(Image.open(src)); rgb = im[..., :3].astype(np.float32); H, W = im.shape[:2]
gray = cv2.cvtColor(im[..., :3], cv2.COLOR_RGB2GRAY)
yy, xx = np.mgrid[0:H, 0:W]; d = np.hypot(xx - x, yy - y); disk = d < r * 0.9
letters = ((gray > 170) & (d < r * 0.8)).astype(np.uint8)
n, lab, s, _ = cv2.connectedComponentsWithStats(letters, 8)
pts = [(s[i, 0], s[i, 1], s[i, 0] + s[i, 2], s[i, 1] + s[i, 3]) for i in range(1, n) if 15 < s[i, 4] < 3000]
stk = np.zeros((H, W), np.uint8)
if pts:
    x0 = min(p[0] for p in pts); y0 = min(p[1] for p in pts); x1 = max(p[2] for p in pts); y1 = max(p[3] for p in pts)
    th = y1 - y0; pad_x, pad_y = int(th * 1.1), int(th * 1.0)
    cv2.rectangle(stk, (x0 - pad_x, y0 - pad_y), (x1 + pad_x, y1 + pad_y), 1, -1)
    print('sticker text box', x0, y0, x1, y1)
else:
    print('no lettering found; leaving lid untouched'); Image.fromarray(im, 'RGBA').save(out); sys.exit()
m = (disk & (stk == 0)).astype(np.float32); sig = r * 0.12
soft = cv2.GaussianBlur(rgb * m[..., None], (0, 0), sig) / np.maximum(cv2.GaussianBlur(m, (0, 0), sig)[..., None], 1e-3)
soft *= (1.0 + 0.06 * np.clip((y - yy) / r, -1, 1))[..., None]
soft += np.random.default_rng(3).normal(0, 1.6, soft.shape)
feather = np.clip((r * 0.9 - d) / (r * 0.06), 0, 1) * (1 - cv2.GaussianBlur(stk.astype(np.float32), (0, 0), 2))
feather = cv2.GaussianBlur(feather.astype(np.float32), (0, 0), 1.5)[..., None]
im[..., :3] = np.clip(rgb * (1 - feather) + soft * feather, 0, 255).astype(np.uint8)
Image.fromarray(im, 'RGBA').save(out)
