"""The archive's "moons" (public/img/studio/moons/): one candle's wax face, seen from above, as a clean round picture.

The earlier moons were cut along a mask's outline, so several had a flat side where the photograph ended, a sliver of the
black rim on one side only, or a face that was really an ellipse squeezed into a square. This remakes each one properly:

  1. the face's edge (where the wax meets the black rim) is fitted as an ellipse (tinfind.refine, from a seed read off
     the photograph: the centre and radius of the face to use);
  2. the ellipse is warped to a circle (the camera was never exactly overhead), and only what lies inside the face is kept,
     a hair inside its edge, so no rim, table or neighbouring tin can show;
  3. the edge is a smooth anti-aliased circle (computed analytically at the output size, a one-pixel ramp), and the colours
     right at the edge are taken from just inside it (so no dark fringe of rim comes along).

Every face chosen here lies whole inside its photograph: nothing is invented, the circle is the photograph's own pixels.
Sources: the graded masters (/tmp/retouch/master/<name>.png, made by grade.py from public/img/studio/<name>.jpg); when a
master is missing it is graded on the fly. Usage: python3 -I tools/photo/moon_faces.py <repo>/public/img/studio [slug ...]
"""
import os, sys, subprocess, tempfile
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tinfind import refine  # noqa: E402

OUT = sys.argv[1]
ONLY = set(sys.argv[2:])
SIZE = 520
# how far in from the face's edge the circle is cut (the last few pixels of wax carry the rim's shadow and its fringe)
INSET = 0.972

# slug: (source photograph, the face to use: its centre x, y and radius in the photograph, roughly[, its own inset where
# the tin's inner wall or the rim's shadow reaches further in])
FACES = {
    'apple-cider': ('apple-cider', (500, 869, 208)),
    'black-crescent': ('black-crescent', (660, 540, 150)),
    'candy-cane-lane': ('candy-cane-lane', (573, 526, 180)),
    'christmas-eve': ('christmas-eve', (673, 570, 300)),
    'easter-bread': ('easter-bread', (419, 570, 189)),
    'hello-cupcake': ('hello-cupcake', (590, 513, 164)),
    'irish-coffee': ('irish-coffee', (577, 704, 209)),
    'jarrah': ('jarrah-top', (561, 746, 211)),
    'lavender-haze': ('lavender-haze', (708, 923, 201)),
    'midnight-forest': ('midnight-forest-moons', (556, 652, 197)),
    'mothers-garden': ('mothers-garden', (600, 710, 208)),
    'mulled-wine': ('mulled-wine', (382, 482, 206), 0.935),
    'sea-salt-sage': ('sea-salt-sage', (593, 654, 213)),
    'spring-blooms': ('spring-blooms', (579, 671, 208)),
    'sweet-romance': ('sweet-romance', (888, 693, 251)),
    'tuscan-sandalwood': ('tuscan-sandalwood', (237, 307, 215), 0.93),
}


def master(name):
    p = f'/tmp/retouch/master/{name}.png'
    if os.path.exists(p):
        return cv2.imread(p)
    tmp = os.path.join(tempfile.mkdtemp(), f'{name}.png')
    subprocess.run([sys.executable, '-I', f'{HERE}/grade.py', f'{OUT}/{name}.jpg', tmp], check=True, capture_output=True)
    return cv2.imread(tmp)


def face(bgr, seed):
    V = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[..., 2].astype(np.float32)
    got = refine(V, *seed)
    if not got:
        raise SystemExit(f'no face at {seed}')
    (cx, cy), (w, h), ang = got[0]
    return cx, cy, w / 2, h / 2, ang, got[1]


def cut(bgr, f, size=SIZE, ss=2, inset=INSET):
    """the face, warped to a circle filling a size x size picture (sampled at ss times the size, then reduced)"""
    cx, cy, a, b, ang, _ = f
    n = size * ss
    R = n / 2
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) + 0.5
    # the unit circle, turned onto the ellipse's axes, stretched to them, and turned back (so the picture keeps its own
    # orientation: only the camera's slight squash is undone)
    t = np.deg2rad(ang)
    qx, qy = (xx - R) / R, (yy - R) / R
    u = (qx * np.cos(t) + qy * np.sin(t)) * a * inset
    v = (-qx * np.sin(t) + qy * np.cos(t)) * b * inset
    sx = (cx + u * np.cos(t) - v * np.sin(t)).astype(np.float32)
    sy = (cy + u * np.sin(t) + v * np.cos(t)).astype(np.float32)
    rgb = cv2.remap(bgr, sx, sy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    rho = np.hypot(xx - R, yy - R) / R
    # the last 1.5 % of the radius takes its colour from just inside, so the edge carries no fringe
    k = np.minimum(1, 0.985 / np.maximum(rho, 1e-6))
    rgb = cv2.remap(rgb, (R + (xx - R) * k - 0.5).astype(np.float32), (R + (yy - R) * k - 0.5).astype(np.float32), cv2.INTER_LINEAR)
    rgb = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_AREA)
    # the alpha: an exact circle, anti-aliased over one output pixel
    y1, x1 = np.mgrid[0:size, 0:size].astype(np.float32) + 0.5
    d = np.hypot(x1 - size / 2, y1 - size / 2) - (size / 2 - 0.75)
    alpha = np.clip(0.5 - d, 0, 1)
    rgba = np.dstack([cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB), (alpha * 255).round().astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')


if __name__ == '__main__':
    os.makedirs(f'{OUT}/moons', exist_ok=True)
    for slug, (src, seed, *rest) in FACES.items():
        if ONLY and slug not in ONLY:
            continue
        bgr = master(src)
        f = face(bgr, seed)
        im = cut(bgr, f, inset=rest[0] if rest else INSET)
        im.save(f'{OUT}/moons/{slug}.webp', 'WEBP', quality=88, method=6)
        print(f'{slug}: face at ({f[0]:.0f}, {f[1]:.0f}), axes {f[2]:.0f} x {f[3]:.0f}, fit {f[5]:.2f}')
