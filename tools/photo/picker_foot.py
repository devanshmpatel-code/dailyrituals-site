"""Give the picker's candle photographs their feet back.

Claire's photographs of Cabana and Verdant are cropped at the bottom through the small tin and the lid leaning against the
tumbler, so on the picker's floor they looked cut off flat. This extends each photograph downwards and completes the two
objects the frame cut, from what the photograph itself shows of them (no new detail is invented):
  - the lid is a disc: its outer edge is fitted from the cut-out's edge, and each missing pixel takes the colour the lid has
    at the same distance from its centre on either side of the gap, blended round the circle (the silver rim and the dark
    face carry on round the bottom as they are on the sides), a little darker towards the floor;
  - the tin is a cylinder: its wall carries straight down, column by column (its vertical highlights stay), to a bottom edge
    that is the same ellipse as its rim (the perspective of the photograph), darkening a little where it meets the floor.
Both versions of a candle (unlit and glow) get the same outline, each with its own colours. The 480 px copies are remade
from the 900 px ones. Prints the new heights, for picker.ts (h, and the wicks' y, which are fractions of the height).
Run it once, on the cropped photographs (made by picker_unlit.py and picker_rim.py): run again, it would extend them again.
Usage: python3 -I tools/photo/picker_foot.py <picker dir>
"""
import sys
import numpy as np
from PIL import Image

D = sys.argv[1]

# per candle: the lid's centre (x, y) as found by HoughCircles on the inner rim, the tin's rim ellipse (centre x, centre y,
# semi-axes a, b) measured on the cut-out's edge, and the tin's height as a fraction of its diameter (a 2 oz tin)
CANDLES = {
    'cabana': dict(lid=(610, 694), tin=(205, 643, 194, 53)),
    'verdant': dict(lid=(515, 641), tin=(184, 556, 174, 41)),
}
TIN_H = 0.49


def lid_circle(A, cx, cy, H):
    """the lid's outer edge in the last rows, where it stands clear against the transparent background (higher up the tumbler's
    base joins it): its centre x is the middle of its two edges where both are clear (Cabana; the Hough centre is the inner
    rim's), and its radius the median distance from the centre to the right-hand edge"""
    rows = []
    for y in range(H - 30, H):
        row = A[y] > 128
        if not row[int(cx)]:
            continue
        r = l = int(cx)
        while r + 1 < A.shape[1] and row[r + 1]:
            r += 1
        while l > 0 and row[l - 1]:
            l -= 1
        rows.append((y, l, r))
    mids = [(l + r + 1) / 2 for y, l, r in rows if cx - l < 260]  # both edges clear (not joined to the tin)
    if len(mids) > 10:
        cx = float(np.median(mids))
    R = float(np.median([np.hypot(r + 0.5 - cx, y - cy) for y, l, r in rows if r - cx > 60]))
    return cx, R


def extend(im, cfg, R):
    """im: RGBA float array. Returns the extended photograph."""
    H, W = im.shape[:2]
    lcx, lcy = cfg['lid_fit']
    tcx, tcy, ta, tb = cfg['tin']
    tin_bottom = tcy + TIN_H * 2 * ta * np.sqrt(1 - (tb / ta) ** 2)  # the bottom ellipse's centre
    NH = int(np.ceil(max(lcy + R, tin_bottom + tb))) + 8
    out = np.zeros((NH, W, 4), np.float32)
    out[:H] = im
    ys, xs = np.mgrid[H:NH, 0:W].astype(np.float32)

    # the tin: its wall, column by column, from the band just above the cut, down to the bottom ellipse
    band = im[H - 14:H - 4]
    col = (band[..., :3] * band[..., 3:4]).sum(0) / np.maximum(1e-3, band[..., 3:4].sum(0))
    cova = band[..., 3].mean(0)
    u = np.clip((xs - tcx) / ta, -1, 1)
    ybot = tin_bottom + tb * np.sqrt(1 - u ** 2)
    inside_x = np.clip(ta - np.abs(xs - tcx) + 0.5, 0, 1) * (cova[None, :] / 255)
    a_tin = inside_x * np.clip(ybot - ys + 0.5, 0, 1)
    depth = np.clip((ys - H) / np.maximum(1, ybot - H), 0, 1)
    shade = (1 - 0.35 * depth ** 2) * (1 - 0.4 * np.clip(1 - (ybot - ys) / 4, 0, 1))  # the floor's shadow, the rolled edge
    tin = col[None, :, :] * shade[..., None]

    # the lid: for each missing pixel, the lid's colour at the same radius on either side of the gap, blended round it
    gy = H - 5  # sample just above the cut (the very last rows can carry the crop's edge)
    rho = np.hypot(xs - lcx, ys - lcy)
    th = np.arctan2(ys - lcy, xs - lcx)
    s = np.clip((gy - lcy) / np.maximum(rho, 1), -1, 1)
    t1, t2 = np.arcsin(s), np.pi - np.arcsin(s)  # the right and left ends of the gap at this radius
    rr = np.minimum(rho, R - 1.5)

    def sample(t):
        x = np.clip(lcx + rr * np.cos(t), 0, W - 1)
        y = np.clip(lcy + rr * np.sin(t), 0, H - 1)
        x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
        x1, y1 = np.minimum(x0 + 1, W - 1), np.minimum(y0 + 1, H - 1)
        fx, fy = (x - x0)[..., None], (y - y0)[..., None]
        p = lambda yy, xx: im[yy, xx]
        return (p(y0, x0) * (1 - fx) + p(y0, x1) * fx) * (1 - fy) + (p(y1, x0) * (1 - fx) + p(y1, x1) * fx) * fy

    c1, c2 = sample(t1), sample(t2)
    f = np.clip((th - t1) / np.maximum(t2 - t1, 1e-3), 0, 1)[..., None]
    lid = c1 * (1 - f) + c2 * f
    lid_rgb = lid[..., :3] * (1 - 0.3 * np.clip((ys - H) / max(1, lcy + R - H), 0, 1) ** 1.5)[..., None]
    a_lid = np.clip(R - rho + 0.5, 0, 1)

    # the lid stands in front of the tin
    rgb = lid_rgb * a_lid[..., None] + tin * (a_tin * (1 - a_lid))[..., None]
    a = a_lid + a_tin * (1 - a_lid)
    rgb = np.where(a[..., None] > 1e-3, rgb / np.maximum(a[..., None], 1e-3), 0)
    out[H:, :, :3] = rgb
    out[H:, :, 3] = a * 255
    return out


for name, cfg in CANDLES.items():
    unlit = np.asarray(Image.open(f'{D}/{name}-unlit-900.webp').convert('RGBA')).astype(np.float32)
    lcx, R = lid_circle(unlit[..., 3], *cfg['lid'], unlit.shape[0])
    cfg['lid_fit'] = (lcx, cfg['lid'][1])
    for kind in ('unlit', 'glow'):
        im = np.asarray(Image.open(f'{D}/{name}-{kind}-900.webp').convert('RGBA')).astype(np.float32)
        out = Image.fromarray(np.clip(extend(im, cfg, R), 0, 255).astype(np.uint8), 'RGBA')
        out.save(f'{D}/{name}-{kind}-900.webp', 'WEBP', quality=88, method=6)
        out.resize((480, round(out.height * 480 / out.width)), Image.LANCZOS).save(f'{D}/{name}-{kind}-480.webp', 'WEBP', quality=86, method=6)
    print(f'{name}: lid centre x {lcx:.1f}, radius {R:.1f}, height {im.shape[0]} -> {out.height} (900 wide)')
