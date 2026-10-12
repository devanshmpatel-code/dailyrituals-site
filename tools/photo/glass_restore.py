"""Give the glass tumblers back the glass the background removal cut away.

The owner saw it on Cabana ("the bottom left is cut out, there should be glass there") and in the breathing pause: below
the label, at the bottom left of the tumbler (between the label, the small tin and the lid), the glass wall and the start of
its rounded base had gone with the background, so the page showed through. Verdant's tumbler had lost glass too: the
green-and-lilac reflection low on its right side, and the base just right of the lid, had been read as background and left
half transparent. The tins' completed feet (picker_foot.py) had also carried a few faint, half-transparent stripes down.

Every tumbler cut-out is repaired from the original photographs' own pixels:
  1. Registration: each 900 px cut-out is a crop of the retouched master (/tmp/retouch/master/<name>.png, grade.py),
     scaled. The scale and offset are found by template matching on the label, refined with ECC (sub-pixel).
  2. The tumbler's outline: a tumbler is symmetrical about its axis. The axis is the middle of the two walls (straight
     lines fitted to the cut-out's edges along the label). Its half-width is the walls' down to the start of the base,
     then a quarter-ellipse (the rounded base, in the photograph's perspective) fitted to the right-hand outline that the
     cut-out kept, clear of the lid. Mirrored, the same profile closes the side the cut lost (the bottom left), drawn
     anti-aliased and as soft as the cut-out's own edge. Right of the axis the cut-out's own edge is kept and only its
     inside is filled: holes and half-transparent patches (white glass is not see-through).
  3. Inside that outline, wherever the cut-out is more transparent than the glass, the glass comes back behind whatever
     is already there: the master's own pixels (the real wall, its reflections and the start of the base), mapped to each
     variant's light by a smooth colour fit (a second-order polynomial in RGB) over the whole tumbler, so the lit cut-out,
     the glow and the unlit photographs each keep their own grade. The outermost pixels take their colour from just inside
     the glass (no dark background in the edge). Nothing is painted: every restored pixel is the photograph's.
  4. Inside the tins and the lid (metal), any half-transparent pixel is made opaque.
The tin and the lid in front of the tumbler stay exactly as they were. Sizes are kept (900 x 900 and 900 x 841, the 480
px copies remade from them), so picker.ts, flamebreath.ts and the markup need no change.

Run it once, from the repository root, on the cut-outs as they were (a second run finds nothing to restore, but would
re-encode the WebP files once more):
    python3 -I tools/photo/glass_restore.py public/img/studio
Proofs (before and after over a dark and a light ground, and the restored pixels) go to /tmp/retouch/glass/.
"""
import os, sys
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True
from picker_foot import CANDLES as FOOT, lid_circle  # noqa: E402

ROOT = sys.argv[1] if len(sys.argv) > 1 else 'public/img/studio'
MASTER = '/tmp/retouch/master'
PROOF = '/tmp/retouch/glass'
os.makedirs(PROOF, exist_ok=True)

# per candle: the master, the rows along the label where both walls are clean, the first row from which glass is restored
# (the rim, the label and the walls beside it are whole), and the variants (path, 900 quality, 480 quality)
CANDLES = {
    'cabana': dict(master='cabana-candles', walls=(100, 460), start=470,
                   files=[('cut/cabana-900.webp', 86, 84), ('picker/cabana-glow-900.webp', 90, 90), ('picker/cabana-unlit-900.webp', 88, 88)]),
    'verdant': dict(master='verdant-candles', walls=(100, 440), start=430,
                    files=[('cut/verdant-900.webp', 86, 84), ('picker/verdant-glow-900.webp', 88, 86), ('picker/verdant-unlit-900.webp', 88, 88)]),
}


def load(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float64) / 255


def register(cut_rgb, master_rgb):
    """2x3 affine A with cut(x, y) = master(A @ [x, y, 1]): template match on the label, then ECC refinement."""
    cg = cv2.cvtColor((cut_rgb * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    mg = cv2.cvtColor((master_rgb * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    H, W = cg.shape
    x0, y0, x1, y1 = int(W * .40), int(H * .25), int(W * .95), int(H * .45)
    tpl = cg[y0:y1, x0:x1]
    best = None
    for s in np.arange(0.80, 1.00, 0.002):
        mm = cv2.resize(mg, (round(mg.shape[1] * s), round(mg.shape[0] * s)), interpolation=cv2.INTER_AREA)
        r = cv2.matchTemplate(mm, tpl, cv2.TM_CCOEFF_NORMED)
        _, v, _, loc = cv2.minMaxLoc(r)
        if best is None or v > best[0]:
            best = (v, s, loc)
    v, s, (lx, ly) = best
    A = np.array([[1 / s, 0, (lx - x0) / s], [0, 1 / s, (ly - y0) / s]], np.float32)
    # ECC on the tumbler (label and glass), master warped into the cut's frame
    roi = np.zeros((H, W), np.uint8); roi[int(H * .1):int(H * .6), int(W * .4):int(W * .97)] = 1
    try:
        _, A2 = cv2.findTransformECC(cg.astype(np.float32), mg.astype(np.float32), A.copy(), cv2.MOTION_AFFINE,
                                     (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), roi, 5)
        A = A2
    except cv2.error:
        pass
    return A, v


def warp(master_rgb, A, W, H):
    return cv2.warpAffine(master_rgb.astype(np.float32), A, (W, H), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_REPLICATE).astype(np.float64).clip(0, 1)


def crossings(a, y):
    xs = np.where(a[y] >= 0.5)[0]
    return (xs.min(), xs.max()) if len(xs) else (None, None)




def walls(a, cfg):
    ys = np.arange(*cfg['walls'], 4)
    L = np.array([crossings(a, y)[0] for y in ys], float)
    R = np.array([crossings(a, y)[1] for y in ys], float) + 1
    return np.polyfit(ys, L, 1), np.polyfit(ys, R, 1)


def occluders(shape, lid, tin):
    """The lid (a disc) and the small tin (its rim ellipse and the body below it), which stand in front of the tumbler."""
    H, W = shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    (lx, ly), lr = lid
    in_lid = np.hypot(xx - lx, yy - ly) < lr + 2
    tcx, tcy, ta, tb = tin
    u = np.clip((xx - tcx) / ta, -1, 1)
    in_tin = (np.abs(xx - tcx) <= ta + 4) & (yy >= tcy - tb * np.sqrt(1 - u ** 2) - 12)  # with its rolled rim
    return in_lid, in_tin


def outline(a, kl, kr, cfg, lid):
    """The tumbler's silhouette (0..1) and the parameters of its base.

    A tumbler is symmetrical about its axis (the middle of its two walls). Its half-width is the walls' down to the start
    of the base, then a quarter-ellipse (the rounded base in the photograph's perspective) fitted to the right-hand
    outline the cut-out kept, where the lid does not hide it. The same profile, mirrored, closes the left-hand side."""
    H, W = a.shape
    (lx, ly), lr = lid
    axis = lambda y: (np.polyval(kl, y) + np.polyval(kr, y)) / 2
    half = lambda y: (np.polyval(kr, y) - np.polyval(kl, y)) / 2
    pts = []
    for y in range(cfg['walls'][1], H):
        c = int(round(axis(y)))
        if a[y, c] < 0.5:
            continue
        x = c
        while x + 1 < W and a[y, x + 1] >= 0.5:
            x += 1
        x += 1
        if np.hypot(x - lx, y - ly) < lr + 3:
            continue
        pts.append((x, y))
    pts = np.array(pts, float)
    px, py = pts[:, 0], pts[:, 1]
    best = None
    for yb in np.arange(cfg['walls'][1], py.max(), 1.0):
        for b in np.arange(20, 220, 1.0):
            t = np.clip((py - yb) / b, 0, 1)
            pred = axis(py) + half(py) * np.sqrt(1 - t ** 2)
            err = np.mean(np.where(py <= yb + b, (pred - px) ** 2, 400.0))
            if best is None or err < best[0]:
                best = (err, yb, b)
    err, yb, b = best
    # anti-aliased: 4 sub-rows per row, exact horizontal coverage
    S = np.zeros((H, W))
    xx = np.arange(W) + 0.5
    for y in range(cfg['start'], H):
        acc = np.zeros(W)
        for sy in (0.125, 0.375, 0.625, 0.875):
            yf = y + sy
            t = (yf - yb) / b
            if t >= 1:
                continue
            w = half(yf) * np.sqrt(1 - max(t, 0) ** 2)
            acc += np.clip(w - np.abs(xx - axis(yf)) + 0.5, 0, 1)
        S[y] = acc / 4
    return S, dict(yb=float(yb), b=float(b), err=float(err), n=len(pts))


def poly_fit(src, dst, m):
    def feats(x):
        r, g, b = x[..., 0], x[..., 1], x[..., 2]
        return np.stack([r, g, b, r * r, g * g, b * b, r * g, r * b, g * b, np.ones_like(r)], -1)
    coef, *_ = np.linalg.lstsq(feats(src[m]), dst[m], rcond=None)
    resid = float(np.abs(feats(src[m]) @ coef - dst[m]).mean())
    return (lambda s: np.clip(feats(s) @ coef, 0, 1)), resid


def inward(rgb, solid, sigma=1.6):
    w = solid.astype(np.float64)
    num = cv2.GaussianBlur(rgb * w[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(w, (0, 0), sigma)[..., None]
    return num / np.maximum(den, 1e-6), den[..., 0]


def metal_solid(a, S, box):
    """Opaque interior of the tin and the lid: their filled shape, 3 px in from its edge, outside the tumbler."""
    m = ((a > 0.5) & ~(box & (S > 0.01))).astype(np.uint8)
    h, w = m.shape
    ff = m.copy()
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 1)
    filled = m | (1 - ff)
    return cv2.erode(filled, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0


def run(name, cfg):
    M = np.asarray(Image.open(f"{MASTER}/{cfg['master']}.png").convert('RGB')).astype(np.float64) / 255
    ref = load(f"{ROOT}/{cfg['files'][0][0]}")
    H, W = ref.shape[:2]
    A, score = register(ref[..., :3], M)
    Mw = warp(M, A, W, H)
    fx, fy = FOOT[name]['lid']
    lcx, lr = lid_circle(ref[..., 3] * 255, fx, fy, H)
    in_lid, in_tin = occluders((H, W), ((lcx, fy), lr), FOOT[name]['tin'])
    kl, kr = walls(ref[..., 3], cfg)
    S, geo = outline(ref[..., 3], kl, kr, cfg, ((lcx, fy), lr))
    yy, xx = np.mgrid[0:H, 0:W]
    axis = (np.polyval(kl, yy) + np.polyval(kr, yy)) / 2
    box = (xx >= np.polyval(kl, yy) - 6) & (xx <= np.polyval(kr, yy) + 6)
    # right of the axis the cut-out's own edge is the photograph's: there the outline only fills the inside (3 px in)
    inner = cv2.erode((S > 0.999).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
    # the new edge as soft as the cut-out's own (hero_cut.py blurs its alpha by 0.7 px)
    S = np.where(S > 0, cv2.GaussianBlur(S, (0, 0), 0.7), 0.0)
    S = np.where(xx >= axis, np.where(inner, 1.0, 0.0), S)
    print(f"{name}: master scale {1 / A[0, 0]:.4f}, offset ({A[0, 2]:.1f}, {A[1, 2]:.1f}), match {score:.3f}; "
          f"lid r {lr:.1f}; base from y {geo['yb']:.0f}, depth {geo['b']:.0f} (fit rms {np.sqrt(geo['err']):.2f} px on {geo['n']} rows)")
    for path, q900, q480 in cfg['files']:
        im = load(f'{ROOT}/{path}')
        rgb, a = im[..., :3], im[..., 3]
        # each variant's light: a colour fit from the master over the whole opaque tumbler (label, glass and rim)
        fitm = box & (a > 0.995) & ~in_lid & ~in_tin & (yy > 60)
        f, resid = poly_fit(Mw, rgb, fitm)
        src = f(Mw)
        core = S > 0.999
        src_in, cov = inward(src, core)
        src = np.where(((S < 0.999) & (cov > 0.05))[..., None], src_in, src)
        # the glass goes behind what is already there (the lid's and tin's edges, half-transparent glass)
        na = a + (1 - a) * S
        add = na - a
        out = (rgb * a[..., None] + src * add[..., None]) / np.maximum(na, 1e-6)[..., None]
        out = np.where((na > 1e-6)[..., None], out, rgb)
        solid = metal_solid(a, S, box)
        n_metal = int((solid & (a < 0.98)).sum())
        na = np.where(solid, 1.0, na)
        res = Image.fromarray((np.dstack([out, na]) * 255 + 0.5).clip(0, 255).astype(np.uint8), 'RGBA')
        before = Image.fromarray((im * 255 + 0.5).astype(np.uint8), 'RGBA')
        res.save(f'{ROOT}/{path}', 'WEBP', quality=q900, method=6)
        res.resize((480, round(480 * H / W)), Image.LANCZOS).save(f'{ROOT}/{path.replace("-900", "-480")}', 'WEBP', quality=q480, method=6)
        proof(before, res, add, f"{PROOF}/{path.split('/')[-1].replace('.webp', '')}.png")
        print(f'  {path}: colour fit residual {resid:.3f}; {int((add > 0.05).sum())} px of glass restored, {n_metal} px made opaque in the tin and lid')


def proof(before, after, add, out):
    W, H = before.size
    tiles = []
    for bg in [(24, 18, 30, 255), (246, 238, 226, 255)]:
        for im in (before, after):
            g = Image.new('RGBA', (W, H), bg); g.alpha_composite(im); tiles.append(g.convert('RGB'))
    tiles.append(Image.fromarray((np.clip(add * 4, 0, 1) * 255).astype(np.uint8)).convert('RGB'))
    o = Image.new('RGB', (W * 5, H), 'white')
    for i, t in enumerate(tiles): o.paste(t, (i * W, 0))
    o.save(out)


if __name__ == '__main__':
    for n, c in CANDLES.items():
        run(n, c)
