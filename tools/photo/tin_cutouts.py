"""The bench photographs of whole tins seen from above (public/img/studio/tins/), cut out as clean shapes.

The first cut-outs followed a background-removal mask: where a tin ran off the edge of the photograph its outline stopped
in a straight line, slivers of the neighbouring tins came along, and the edges were ragged with a halo of the paper behind.
Here every tin is cut along its real outline instead:

  1. each tin's wax face is fitted as an ellipse (tinfind.refine, from a seed read off the photograph), and its black rim
     is the same ellipse grown by the rim's width (measured on the photograph, the same for every tin in it);
  2. where the camera looked a little from one side, the tin's black wall shows beyond the rim on that side: the outline is
     then the rim swept along that direction for as far as the wall stays dark (found per tin);
  3. the outline is drawn analytically, anti-aliased over one pixel, so the edge is smooth whatever the size;
  4. a tin that runs a little off the photograph is completed round its own circle: each missing pixel takes the colour the
     tin has at the same distance from its centre at the two ends of the gap, blended between them (the black rim and wall
     carry on round, as they are), with the photograph's own grain added back;
  5. the colours of the anti-aliased edge pixel are pushed out from just inside it (no paper-coloured fringe).

A tin cut off by more than about a quarter of its outline is left out rather than completed.
Usage: python3 -I tools/photo/tin_cutouts.py <repo>/public/img/studio [name ...] [--debug <dir>]
"""
import os, sys
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tinfind import refine  # noqa: E402
from moon_faces import master  # noqa: E402

# name: source photograph, the tins to keep (each a seed: the face's centre x, y and radius, roughly), the direction the
# walls show in (degrees, 90 = down the picture; None for a straight-down photograph), the rim's width in pixels (None:
# measured), and the output widths
CUTS = {
    'jarrah-top': dict(src='jarrah-top', walls=None, tins=[(951, 475, 203), (561, 746, 211), (194, 851, 162), (560, 293, 202), (925, 857, 158), (240, 510, 156), (278, 236, 88)]),
    'mothers-garden': dict(src='mothers-garden', walls=None, tins=[(276, 910, 158), (467, 262, 206), (600, 710, 206), (886, 378, 204), (230, 565, 157), (972, 756, 153), (792, 962, 91), (170, 276, 90)]),
    'hello-cupcake': dict(src='hello-cupcake', walls=None, tins=[(260, 243, 207), (866, 801, 171), (658, 181, 152), (590, 513, 162), (567, 809, 99), (990, 400, 207), (211, 724, 229)]),
    'irish-coffee': dict(src='irish-coffee', walls=None, tins=[(986, 531, 201), (643, 265, 201), (896, 903, 154), (577, 704, 208), (204, 773, 157), (307, 440, 154), (431, 981, 92), (358, 192, 87)]),
    'spring-blooms': dict(src='spring-blooms', walls=None, tins=[(970, 468, 207), (602, 224, 207), (579, 671, 207), (206, 762, 158), (935, 851, 156), (270, 420, 156), (720, 1006, 91), (303, 168, 90)]),
    'tuscan-sandalwood': dict(src='tuscan-sandalwood', walls=None, tins=[(237, 307, 215), (962, 683, 219), (844, 307, 157), (236, 722, 165), (583, 531, 160), (574, 274, 90)]),
    'midnight-forest-moons': dict(src='midnight-forest-moons', walls=None, tins=[(932, 500, 190), (556, 652, 197), (595, 229, 183), (210, 762, 152), (1018, 866, 152), (298, 420, 143), (918, 148, 133)]),
    'sweet-romance': dict(src='sweet-romance', walls=None, tins=[(888, 693, 251)]),
    'lavender-haze': dict(src='lavender-haze', walls=None, tins=[(283, 290, 222), (641, 268, 96), (667, 523, 170), (709, 925, 196), (985, 260, 214), (1062, 1018, 114)]),
    'christmas-eve': dict(src='christmas-eve', walls=None, tins=[(673, 570, 300), (397, 980, 151)]),
    'mothers-day-florals': dict(src='mothers-day-florals', walls=None, rim=12, tins=[(433, 668, 231), (937, 780, 182), (795, 386, 200), (408, 335, 145)]),
    # the inside of these tins shows above the wax: cut along the tins' outer edges
    'black-crescent': dict(src='black-crescent', walls=None, outer=True, rim=-2.5, tins=[(175, 225, 150), (513, 180, 181), (290, 460, 212), (662, 540, 157), (440, 880, 247), (875, 285, 181)]),
}
WIDTHS = (480, 900)


def fit(V, seed, outer=False):
    got = refine(V, *seed, outer=outer)
    if not got:
        raise SystemExit(f'no face at {seed}')
    (cx, cy), (w, h), ang = got[0]
    return dict(cx=cx, cy=cy, a=w / 2, b=h / 2, t=np.deg2rad(ang))


def polar(e, xs, ys, grow=0.0):
    """normalised radius on the ellipse grown by `grow` pixels, and the angle"""
    dx, dy = xs - e['cx'], ys - e['cy']
    u = dx * np.cos(e['t']) + dy * np.sin(e['t'])
    v = -dx * np.sin(e['t']) + dy * np.cos(e['t'])
    return np.hypot(u / (e['a'] + grow), v / (e['b'] + grow)), np.arctan2(v / (e['b'] + grow), u / (e['a'] + grow))


def dist(e, xs, ys, grow):
    """about how far outside the grown ellipse a pixel is (negative inside), in pixels"""
    rho, _ = polar(e, xs, ys, grow)
    r = np.hypot(xs - e['cx'], ys - e['cy'])
    return r * (1 - 1 / np.maximum(rho, 1e-6))


def paper_colour(lab, far):
    """the paper or table behind the tins (Lab): the median of the coloured pixels away from the tins kept (the wax and black
    rims of the tins left out are colourless, so they do not sway it)"""
    px = lab[::4, ::4][far]
    chroma = np.hypot(px[:, 1] - 128, px[:, 2] - 128)
    pick = px[chroma > 10]
    return np.median(pick if len(pick) > 100 else px, axis=0)


def rim_width(lab, tins):
    """the rim's width: along rays out of each face, the run of pixels that are not the paper or table behind (the black
    rim and its rolled, light-catching edge), median over every ray that reaches the background"""
    H, W = lab.shape[:2]
    ys, xs = np.mgrid[0:H:4, 0:W:4].astype(np.float32)
    far = np.min([polar(e, xs, ys)[0] for e in tins], axis=0) > 1.3
    bg = paper_colour(lab, far) if far.sum() > 200 else None
    runs = []
    for e in tins:
        for th in np.linspace(0, 2 * np.pi, 120, endpoint=False):
            rr, _ = polar(e, np.array([e['cx'] + np.cos(th)]), np.array([e['cy'] + np.sin(th)]))
            rf = 1 / rr[0]
            n, calm = 0, 0
            for s in range(1, 50):
                x, y = e['cx'] + np.cos(th) * (rf + s), e['cy'] + np.sin(th) * (rf + s)
                if not (0 <= x < W and 0 <= y < H):
                    n = -1; break
                if any(o is not e and polar(o, np.array([x]), np.array([y]))[0][0] < 1.12 for o in tins):
                    n = -1; break
                # the background starts where three pixels in a row look like it (one can be a glint on the rim)
                if bg is not None and np.linalg.norm(lab[int(y), int(x)] - bg) < 70:
                    calm += 1
                    if calm == 3:
                        break
                else:
                    calm, n = 0, s
            if 1 < n < 45:
                runs.append(n)
    return float(np.median(runs)) if len(runs) > 20 else 10.0


def wall_length(V, e, grow, d, dark, others):
    """how far the tin's dark wall runs beyond its rim in direction d (pixels)"""
    H, W = V.shape
    cap = int(0.3 * max(e['a'], e['b']))
    # only the tin's own neighbourhood
    R = max(e['a'], e['b']) + grow + cap + 4
    x0, y0 = int(max(0, e['cx'] - R)), int(max(0, e['cy'] - R))
    x1, y1 = int(min(W, e['cx'] + R)), int(min(H, e['cy'] + R))
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    V = V[y0:y1, x0:x1]
    prev = dist(e, xs, ys, grow) <= 0
    free = np.ones(xs.shape, bool)
    for o in others:
        free &= polar(o, xs, ys, grow)[0] > 1
    L = 0
    for s in range(2, cap, 2):
        cur = dist(e, xs - d[0] * s, ys - d[1] * s, grow) <= 0
        new = cur & ~prev & free
        if new.sum() < 10:
            break
        if (V[new] < dark).mean() < 0.6:
            break
        L = s; prev |= cur
    return L


def complete(rgb, inframe, alpha, tin, grow):
    """fill the tin's pixels that lie outside the photograph, round its own circle (see step 4)"""
    NR, NA = 400, 1440
    e = tin['e']
    rmax = 1 + (tin['L'] + 4) / min(e['a'], e['b']) + grow / min(e['a'], e['b'])
    rho = np.linspace(0, rmax, NR, dtype=np.float32)[:, None]
    phi = np.linspace(-np.pi, np.pi, NA, endpoint=False, dtype=np.float32)[None, :]
    u, v = rho * np.cos(phi) * e['a'], rho * np.sin(phi) * e['b']
    px = (e['cx'] + u * np.cos(e['t']) - v * np.sin(e['t'])).astype(np.float32)
    py = (e['cy'] + u * np.sin(e['t']) + v * np.cos(e['t'])).astype(np.float32)
    H, W = alpha.shape
    ok = (px >= 0) & (py >= 0) & (px <= W - 1) & (py <= H - 1)
    okm = cv2.remap(((inframe > 0) & (alpha > 0.99)).astype(np.float32), px, py, cv2.INTER_NEAREST, borderValue=0) > 0.5
    ok &= okm
    col = cv2.remap(rgb.astype(np.float32), px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    out = col.copy()
    last = None
    for i in range(NR):
        good = np.where(ok[i])[0]
        if len(good) < 8:
            if last is not None:
                out[i] = last
            continue
        if len(good) < NA:
            # circular linear interpolation across each gap
            g = np.concatenate([good - NA, good, good + NA])
            for c in range(3):
                vals = col[i, good, c]
                out[i, :, c] = np.interp(np.arange(NA), g, np.concatenate([vals, vals, vals]))
        last = out[i]
    # back to the picture: for each missing pixel, its place on the polar grid
    miss = (inframe == 0) & (alpha > 0)
    yy, xx = np.nonzero(miss)
    if len(yy):
        r, a = polar(e, xx.astype(np.float32), yy.astype(np.float32))
        ri = np.clip(r / rmax * (NR - 1), 0, NR - 1).astype(np.float32)
        ai = ((a + np.pi) / (2 * np.pi) * NA).astype(np.float32) % NA
        vals = cv2.remap(out, ai[None, :], ri[None, :], cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)[0]
        rng = np.random.default_rng(7)
        vals += rng.normal(0, 2.2, vals.shape).astype(np.float32)  # the photograph's grain
        rgb[yy, xx] = np.clip(vals, 0, 255)
    return rgb


def push_out(rgb, core):
    """extend the colours of the core outwards a few pixels (each new ring is the mean of its known neighbours)"""
    col = rgb.astype(np.float32) * core[..., None]
    w = core.astype(np.float32)
    for _ in range(12):
        c2 = cv2.blur(col, (3, 3)); w2 = cv2.blur(w, (3, 3))
        fill = (w == 0) & (w2 > 0)
        col[fill] = c2[fill] / w2[fill][:, None]
        w[fill] = 1
    return np.where(w[..., None] > 0, col, rgb).astype(np.float32)


def cutout(name, cfg, studio, dbg=None):
    bgr = master(cfg['src'])
    H0, W0 = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    V = cv2.GaussianBlur(hsv[..., 2], (3, 3), 0).astype(np.float32)
    es = [fit(V, s, cfg.get('outer', False)) for s in cfg['tins']]
    dark = float(np.percentile(V, 99)) * 0.33
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    grow = cfg.get('rim') or (1.0 if cfg.get('outer') else rim_width(lab, es))
    d = None if cfg['walls'] is None else (np.cos(np.deg2rad(cfg['walls'])), np.sin(np.deg2rad(cfg['walls'])))
    tins = [dict(e=e, L=wall_length(V, e, grow, d, dark, [o for o in es if o is not e]) if d else 0) for e in es]
    # work on a canvas with room round the photograph for completed tins
    P = 80
    H, W = H0 + 2 * P, W0 + 2 * P
    rgb = np.zeros((H, W, 3), np.float32); rgb[P:P + H0, P:P + W0] = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    inframe = np.zeros((H, W), np.uint8); inframe[P:P + H0, P:P + W0] = 1
    for t in tins:
        t['e'] = dict(t['e'], cx=t['e']['cx'] + P, cy=t['e']['cy'] + P)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32) + 0.0
    Vp = np.zeros((H, W), np.float32); Vp[P:P + H0, P:P + W0] = V
    # how surely a pixel is the black of a tin's wall: fully below the dark level, none 40 levels above it, softened a little
    gate = cv2.GaussianBlur(np.clip((dark + 40 - Vp) / 40, 0, 1), (0, 0), 1.2)
    gate = cv2.morphologyEx(gate, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    alpha = np.zeros((H, W), np.float32)
    per = []
    for t in tins:
        dd = dist(t['e'], xs, ys, grow)
        a = np.clip(0.5 - dd, 0, 1)
        if t['L']:
            dw = dd.copy()
            for s in range(1, t['L'] + 1):
                dw = np.minimum(dw, dist(t['e'], xs - d[0] * s, ys - d[1] * s, grow))
            # the wall only where the photograph really is dark: the sweep must not carry a neighbour's wax with it
            a = np.maximum(a, np.clip(0.5 - dw, 0, 1) * gate)
        per.append(a)
        alpha = np.maximum(alpha, a)
    # how much of each tin lies off the photograph
    for t, a in zip(tins, per):
        off = (a * (1 - inframe)).sum() / max(1, a.sum())
        t['off'] = off
    for t, a in zip(tins, per):
        if t['off'] > 0:
            rgb = complete(rgb, inframe, a, t, grow)
    core = cv2.erode((alpha > 0.999).astype(np.uint8), np.ones((3, 3), np.uint8))  # a pixel in from the edge
    # the paper or table caught inside the outline where tins meet (a gap between three rims), near the edge
    ys4, xs4 = np.mgrid[0:H0:4, 0:W0:4].astype(np.float32)
    far = np.min([polar(e, xs4, ys4)[0] for e in es], axis=0) > 1.3
    if far.sum() > 200:
        labp = np.zeros((H, W, 3), np.float32); labp[P:P + H0, P:P + W0] = lab
        bgc = paper_colour(lab, far)
        near = cv2.erode((alpha > 0.5).astype(np.uint8), np.ones((3, 3), np.uint8))
        band = (alpha > 0) & (cv2.erode(near, np.ones((41, 41), np.uint8)) == 0)
        # (the background's colour, lit or in the shadow between tins: its hue, at any brightness a little either side)
        dl = labp[..., 0] - bgc[0]
        # (only outside every wax face, where the rims and the gaps are: never a topping or the wax itself; where the tins
        # were fitted by their outer edges, the faces are taken as a little inside them)
        offface = np.min([polar(t['e'], xs, ys)[0] for t in tins], axis=0) > (0.92 if cfg.get('outer') else 1.0)
        paper = band & offface & (np.linalg.norm(labp[..., 1:] - bgc[1:], axis=2) < 13) & (dl > -100) & (dl < 30) & (inframe > 0)
        # what shows there is the dark between the tins' walls: painted over with the tins' own shadow, taken from the
        # darkest of the photograph around it, blended in softly
        paper = cv2.morphologyEx(paper.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        soft = np.clip(cv2.GaussianBlur(cv2.dilate(paper, np.ones((5, 5), np.uint8)).astype(np.float32), (0, 0), 1.5) * 1.3, 0, 1)
        shadow = cv2.GaussianBlur(cv2.erode(rgb, np.ones((21, 21), np.uint8)), (0, 0), 4)
        rgb = rgb * (1 - soft[..., None]) + shadow * soft[..., None]
        print(f"  {name}: {int(paper.sum())} px of background painted over between tins")
    rgb = push_out(rgb, core)
    ys_, xs_ = np.nonzero(alpha > 0)
    x0, x1, y0, y1 = xs_.min() - 2, xs_.max() + 3, ys_.min() - 2, ys_.max() + 3
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255])[y0:y1, x0:x1]
    im = Image.fromarray(out.round().astype(np.uint8), 'RGBA')
    for w in WIDTHS:
        # never enlarged: a cut-out narrower than the size keeps its own pixels (the markup gives the real size)
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if im.width > w else im
        r.save(f'{studio}/tins/{name}-{w}.webp', 'WEBP', quality=86, method=6)
    if dbg:
        vis = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
        for t in tins:
            e = t['e']
            cv2.ellipse(vis, ((e['cx'], e['cy']), (2 * e['a'], 2 * e['b']), np.rad2deg(e['t'])), (0, 0, 255), 1)
            cv2.ellipse(vis, ((e['cx'], e['cy']), (2 * (e['a'] + grow), 2 * (e['b'] + grow)), np.rad2deg(e['t'])), (255, 0, 0), 1)
        cv2.imwrite(f'{dbg}/cut-{name}.jpg', vis)
    print(f"{name}: {len(tins)} tins, rim {grow:.1f} px, walls {[t['L'] for t in tins]}, off-frame {[round(t['off'], 3) for t in tins]}, "
          f"{im.width} x {im.height} -> {min(900, im.width)} x {round(im.height * min(900, im.width) / im.width)}")
    return im


if __name__ == '__main__':
    args = sys.argv[2:]
    dbg = None
    if '--debug' in args:
        i = args.index('--debug'); dbg = args[i + 1]; args = args[:i] + args[i + 2:]
    for name, cfg in CUTS.items():
        if args and name not in args:
            continue
        cutout(name, cfg, sys.argv[1], dbg)
