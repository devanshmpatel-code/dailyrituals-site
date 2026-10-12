"""Find the candle tins in one of Claire's overhead photographs.

Seen from above, every tin is a bright face of wax inside a black rolled rim. This finds each face, fits its edge (where the
wax meets the black rim) as an ellipse, and measures how far out the rim goes, so the other scripts can cut tins and faces as
exact, clean shapes instead of tracing a mask's ragged outline.

  1. the wax: bright, nearly colourless pixels, closed a little so sprinkles and petals do not break a face into pieces;
  2. each wax shape gives a first guess at its circle (the smallest circle around it: toppings along the rim cut into the
     shape but never past the rim, so the circle is still the face's);
  3. from that centre, 180 rays find the face's edge: the strongest bright-to-dark step near the guessed radius. An ellipse
     is fitted to those points, ignoring the ones that landed on a topping (a robust fit, three rounds);
  4. further out along the same rays, the rim ends where the black stops; the median of those gives the rim's outer edge.

find_faces(bgr) returns one dict per face: ellipse (cx, cy, a, b, angle in degrees, as cv2 uses it), outer (the rim's outer
edge as a multiple of the face's ellipse), inside (the whole tin is in the frame), fit (the share of rays that agree).
"""
import numpy as np
import cv2


def _rays(V, cx, cy, r0, n=180, lo=0.72, hi=1.22):
    """V along n rays from the centre, from lo * r0 to hi * r0 (one sample per pixel), and the angles."""
    th = np.linspace(0, 2 * np.pi, n, endpoint=False)
    rs = np.arange(lo * r0, hi * r0, 1.0)
    xs = cx + np.cos(th)[:, None] * rs[None, :]
    ys = cy + np.sin(th)[:, None] * rs[None, :]
    ok = (xs >= 0) & (ys >= 0) & (xs <= V.shape[1] - 1) & (ys <= V.shape[0] - 1)
    prof = cv2.remap(V, xs.astype(np.float32), ys.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return th, rs, prof, ok


def _fit(pts):
    """a robust ellipse through the points: refit three times, dropping those far from the last fit"""
    keep = np.ones(len(pts), bool)
    e = None
    for _ in range(3):
        if keep.sum() < 12:
            break
        e = cv2.fitEllipse(pts[keep].astype(np.float32))
        (cx, cy), (w, h), ang = e
        a, b, t = w / 2, h / 2, np.deg2rad(ang)
        dx, dy = pts[:, 0] - cx, pts[:, 1] - cy
        u = (dx * np.cos(t) + dy * np.sin(t)) / max(a, 1)
        v = (-dx * np.sin(t) + dy * np.cos(t)) / max(b, 1)
        res = np.abs(np.hypot(u, v) - 1)
        mad = np.median(res) + 1e-4
        keep = res < max(0.012, 3 * mad)
    return e, keep


def refine(V, cx, cy, r0, outer=False):
    """the face's edge as an ellipse, from a first guess at its circle. With outer, the tin's own outer edge instead: the
    step from its dark rim up to the lighter table (for photographs where the inside of the tin shows above the wax)"""
    th, rs, prof, ok = _rays(V, cx, cy, r0, lo=0.85 if outer else 0.72, hi=1.15 if outer else 1.22)
    g = np.diff(cv2.GaussianBlur(prof, (5, 1), 0), axis=1)  # the step outwards along each ray
    if outer:
        g = -g
    g[~(ok[:, 1:] & ok[:, :-1])] = 0
    # prefer a step near the guessed radius (the edge, not a topping's outline further in)
    w = np.exp(-((rs[1:] - r0) / ((0.08 if outer else 0.18) * r0)) ** 2)
    k = np.argmin(g * w[None, :], axis=1)
    strong = -g[np.arange(len(th)), k] > 6
    r = rs[k] + 0.5
    pts = np.stack([cx + np.cos(th) * r, cy + np.sin(th) * r], 1)[strong]
    if len(pts) < 20:
        return None
    e, keep = _fit(pts)
    if e is None:
        return None
    return e, keep.sum() / len(th)


def outer_edge(V, e, dark):
    """how far out the black rim reaches, as a multiple of the face's ellipse (median over the rays that see it end)"""
    (cx, cy), (w, h), ang = e
    a, b, t = w / 2, h / 2, np.deg2rad(ang)
    ratios = []
    for th in np.linspace(0, 2 * np.pi, 120, endpoint=False):
        dx, dy = np.cos(th), np.sin(th)
        # the face's radius along this ray
        u, v = dx * np.cos(t) + dy * np.sin(t), -dx * np.sin(t) + dy * np.cos(t)
        rf = 1 / np.sqrt((u / a) ** 2 + (v / b) ** 2)
        run = 0
        for s in np.arange(1.01, 1.4, 0.004):
            x, y = cx + dx * rf * s, cy + dy * rf * s
            if not (0 <= x < V.shape[1] - 1 and 0 <= y < V.shape[0] - 1):
                break
            if V[int(y), int(x)] > dark:
                run += 1
                if run >= 3:
                    ratios.append(s - 0.008)
                    break
            else:
                run = 0
    return float(np.median(ratios)) if len(ratios) > 20 else 1.1


def find_faces(bgr, min_r=40):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    V = cv2.GaussianBlur(hsv[..., 2], (3, 3), 0).astype(np.float32)
    S = hsv[..., 1]
    bright = np.percentile(V, 75)
    wax = ((V > max(150, bright * 0.82)) & (S < 70)).astype(np.uint8)
    wax = cv2.morphologyEx(wax, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    wax = cv2.morphologyEx(wax, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(wax, 8)
    # how dark the rims are: well below the wax
    dark = float(np.percentile(V[wax > 0], 5)) * 0.45 if wax.any() else 80
    H, W = V.shape
    faces = []
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < np.pi * min_r * min_r * 0.5:
            continue
        cnts, _ = cv2.findContours((lab == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        c = max(cnts, key=cv2.contourArea)
        (cx, cy), r0 = cv2.minEnclosingCircle(c)
        # a face's wax fills most of its circle; the background between tins does not
        if cv2.contourArea(c) < 0.55 * np.pi * r0 * r0 or r0 < min_r:
            continue
        got = refine(V, cx, cy, r0)
        if not got:
            continue
        e, fit = got
        (ex, ey), (w, h), ang = e
        if fit < 0.45 or min(w, h) / max(w, h) < 0.8:
            continue
        outer = outer_edge(V, e, dark)
        R = max(w, h) / 2 * outer
        faces.append(dict(ellipse=(ex, ey, w / 2, h / 2, ang), outer=outer, fit=fit,
                          inside=bool(ex - R >= 1 and ey - R >= 1 and ex + R <= W - 2 and ey + R <= H - 2)))
    # one detection per face (a face split in two by a topping can be found twice)
    faces.sort(key=lambda f: -f['ellipse'][2])
    out = []
    for f in faces:
        if all(np.hypot(f['ellipse'][0] - g['ellipse'][0], f['ellipse'][1] - g['ellipse'][1]) > 0.5 * g['ellipse'][2] for g in out):
            out.append(f)
    return out


def ellipse_coords(f, xs, ys, scale=1.0):
    """for pixel coordinates, the normalised radius (1 on the face's edge, times scale) and the angle on the ellipse"""
    cx, cy, a, b, ang = f['ellipse']
    t = np.deg2rad(ang)
    dx, dy = xs - cx, ys - cy
    u = (dx * np.cos(t) + dy * np.sin(t)) / (a * scale)
    v = (-dx * np.sin(t) + dy * np.cos(t)) / (b * scale)
    return np.hypot(u, v), np.arctan2(v, u)


def ellipse_point(f, rho, phi, scale=1.0):
    """the inverse of ellipse_coords: pixel coordinates for a normalised radius and angle"""
    cx, cy, a, b, ang = f['ellipse']
    t = np.deg2rad(ang)
    u, v = rho * np.cos(phi) * a * scale, rho * np.sin(phi) * b * scale
    return cx + u * np.cos(t) - v * np.sin(t), cy + u * np.sin(t) + v * np.cos(t)
