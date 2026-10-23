"""Claire's portrait: a clean cut-out, a gentle portrait retouch, and the framed plates every page uses.

Source: public/img/studio/claire.jpg (her own selfie on the sofa, 1101 x 1200). Everything is rebuilt from it; nothing is
read from an earlier cut-out. Run from the repository root:

    python3 -I tools/photo/claire_portrait.py public/img/studio

Steps
1. Masks: rembg's birefnet-portrait, u2net and u2net_human_seg (models in /root/.rembg/models/<name>/), cached in
   /tmp/retouch/claire/.
2. Trimap: the person is where the models agree, minus the sofa (the grey cushion right of her hair, the rust cushion
   behind her raised arm, the dark seat under her arm and the throw at the left) drawn in by hand as known background.
   The band of unknown pixels is wide round the hair (flyaways over the cushion) and narrow round skin and lace.
3. Alpha: closed-form matting (pymatting) in that band. Two stretches are drawn instead: right of her hair, where the
   cushion is the same brown-grey as the hair and the compressed photograph breaks the matte into 8 px blocks, the
   u2net matte is used; left of her hair by the ear, where the dark back of the sofa touches it, the outline is a smooth
   traced curve. In the hair the outline is smoothed and the strands kept, softened. The foreground colours are then
   re-estimated (estimate_foreground_ml) and every edge pixel is pulled towards her own colour just inside the edge, so
   no sofa or wall colour stays in the hair or along the arms (decontaminated edges, no halo).
4. Crown: the photograph cuts the top of her head flat. The crown is completed above the frame edge from the hair's own
   pixels (continued along the hair's flow, with its grain) inside a dome that continues the hair's outline, so the
   portrait can have room above her head.
5. Retouch: an even, warm skin tone without losing texture (low-frequency smoothing on skin only, the fine detail kept),
   a touch of light in the eyes, a gentle curve. No reshaping.
6. Plates: the cut-out placed for the arch frames (head and shoulders, centred, the head 40 % of the width, the eyes 38 %
   down the plate, about a third once the arch crops it, with room above her head), with the edges where the photograph
   ends (the bottom of her torso, her raised arm at the right) faded softly to transparent along one rounded fade, so
   the frame's own background shows through instead of a hard crop line.

Outputs (public/img/studio/...)
- cut/claire-480.webp (480 x 600), cut/claire-900.webp (900 x 1125): the arch plate (transparent, 4:5), used by the home
  Meet Claire arch and the coaching opener arch. Both frames show it with object-fit: cover anchored at the bottom.
- web/claire-round.webp (720 x 720): head and shoulders on the warm studio backdrop, for the round portraits (coaching
  Meet your coach, the story page's quote).
- web/claire-900.webp: the same on the backdrop in the old 826 x 900 slot (kept for any page that still asks for it).
Working files go to /tmp/retouch/claire/: the masks, trimap, alpha, cutout-full.png (the whole cut-out with its crown,
no fades) and plate.png. Set REMATTE=1 to redo the matting after changing steps 2 and 3.
"""
import os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/img/studio'
WORK = '/tmp/retouch/claire'
os.makedirs(WORK, exist_ok=True)
SRC = os.path.join(OUT, 'claire.jpg')


# ---------------------------------------------------------------- 1. masks
def model_mask(rgb: Image.Image, name: str) -> np.ndarray:
    cache = f'{WORK}/mask-{name}.png'
    if not os.path.exists(cache):
        os.environ['U2NET_HOME'] = f'/root/.rembg/models/{name}'
        from rembg import remove, new_session
        remove(rgb, session=new_session(name), only_mask=True).save(cache)
    return np.asarray(Image.open(cache).convert('L')).astype(np.float32) / 255


def poly_mask(shape, polys):
    m = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(p, fill=255)
    return np.asarray(m) > 0


# Known background, drawn by hand on the 1101 x 1200 photograph (x, y)
SOFA = [
    # the grey-brown cushion right of her hair, down to where her shoulder meets it (kept clear of the flyaways)
    [(932, 0), (1101, 0), (1101, 772), (1046, 760), (1010, 724), (978, 686), (958, 640), (944, 580), (936, 470), (930, 330), (926, 160)],
    # the rust cushion behind her raised arm
    [(1050, 772), (1101, 776), (1101, 905), (1092, 902), (1074, 866), (1056, 828), (1040, 800)],
    # the throw, pillow and wall at the left, outside her hair and her arm
    [(0, 0), (300, 0), (296, 150), (292, 330), (262, 380), (226, 470), (180, 560), (120, 590), (90, 660), (0, 700)],
    [(0, 700), (88, 680), (84, 900), (82, 1200), (0, 1200)],
    # the dark seat in the gap between her side and her raised arm
    [(880, 1112), (896, 1150), (912, 1200), (868, 1200), (862, 1150)],
]
# Background that must never be matted in, however close to her: the dark back of the sofa just behind her hair at the
# left (the models read it as a spike of hair), drawn along the hair's real edge
FORCE_BG = [
    [(262, 262), (305, 266), (303, 290), (303, 310), (306, 330), (312, 348), (320, 366), (327, 388), (262, 400)],
]
# Where the hair meets the background: a wide band of unknown pixels so strands are matted, not clipped
HAIR_ZONES = [(270, 0, 470, 560), (760, 0, 1060, 840), (300, 0, 900, 60)]


def build_alpha(img: np.ndarray) -> np.ndarray:
    cache = f'{WORK}/alpha.png'
    if os.path.exists(cache) and os.environ.get('REMATTE') != '1':
        return np.asarray(Image.open(cache)).astype(np.float64) / 255
    rgb = Image.fromarray(img)
    B, U, H = model_mask(rgb, 'birefnet-portrait'), model_mask(rgb, 'u2net'), model_mask(rgb, 'u2net_human_seg')
    h, w = U.shape
    sofa = poly_mask(U.shape, SOFA)
    agree = np.minimum(np.minimum(B, U), H)
    anyof = np.maximum(np.maximum(B, U), H)
    person = ((agree + anyof) / 2 > 0.5) & ~sofa
    # keep the one big shape, fill its holes
    n, lab, st, _ = cv2.connectedComponentsWithStats(person.astype(np.uint8), 8)
    person = lab == (1 + np.argmax(st[1:, cv2.CC_STAT_AREA]))
    inv = (~person).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n):
        x, y, ww, hh, a = st[i]
        if a < 4000 and x > 0 and y > 0 and x + ww < w and y + hh < h:
            person[lab == i] = True
    hairz = np.zeros((h, w), bool)
    for x0, y0, x1, y1 in HAIR_ZONES:
        hairz[y0:y1, x0:x1] = True
    pm = person.astype(np.uint8)
    k = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    fg_narrow, fg_wide = cv2.erode(pm, k(4)) > 0, cv2.erode(pm, k(16)) > 0
    bg_narrow, bg_wide = cv2.dilate(pm, k(4)) == 0, cv2.dilate(pm, k(22)) == 0
    fg = np.where(hairz, fg_wide, fg_narrow)
    bg = np.where(hairz, bg_wide, bg_narrow) | (sofa & ~(cv2.dilate(pm, k(3)) > 0) & ~hairz) | (sofa & bg_wide)
    # the face, neck and lace are certainly her; never let matting eat into them
    core = cv2.erode((agree > 0.97).astype(np.uint8), k(10)) > 0
    fg |= core & ~sofa
    force = poly_mask(U.shape, FORCE_BG)
    bg |= force
    fg &= ~force
    tri = np.full((h, w), 0.5)
    tri[bg] = 0.0
    tri[fg] = 1.0
    Image.fromarray((tri * 255).astype(np.uint8)).save(f'{WORK}/trimap.png')
    from pymatting import estimate_alpha_cf
    a = estimate_alpha_cf(img.astype(np.float64) / 255, tri, laplacian_kwargs={'epsilon': 1e-6}, cg_kwargs={'maxiter': 4000})
    a = np.clip(a, 0, 1)
    # Right of her hair the cushion is the same brown-grey as the hair and the photograph is block-compressed, so the
    # closed-form matte breaks into 8 px blocks there. Along that stretch the u2net matte (smooth, and the one model that
    # leaves the cushion out) is used instead, eased in and out over 24 px.
    zone = np.zeros((h, w)); zone[120:700, 820:1010] = 1
    zone = gblur(zone, 10)
    a = a * (1 - zone) + U * zone
    # Left of her hair, between the wall and her ear, the dark back of the sofa touches the hair in a compressed blur
    # that no matte separates cleanly. The hair's outline there is a smooth curve (traced on the photograph), drawn
    # anti-aliased with a soft 1.5 px edge, eased into the matte above and below.
    ys = np.array([196, 220, 250, 280, 300, 320, 340, 360, 380, 404])
    xs = np.array([350, 337, 323, 314, 310, 310, 313, 321, 332, 342])
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    xe = np.interp(yy[:, 0], ys, xs)[:, None]
    edge = smoothstep(xe - 1.5, xe + 1.5, xx)
    band = ((yy >= 196) & (yy <= 404) & (xx < xe + 14)).astype(np.float64)
    band = gblur(band, 3) * ((yy >= 190) & (yy <= 410))
    a = a * (1 - band) + edge * band
    a[tri == 1] = np.maximum(a[tri == 1], 1 - band[tri == 1])
    a[(tri == 0) & (band < 0.01)] = 0
    # matting speckle in the sofa: drop faint islands not connected to her
    solid = (a > 0.08).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    keep = lab == (1 + np.argmax(st[1:, cv2.CC_STAT_AREA]))
    keep = cv2.dilate(keep.astype(np.uint8), k(2)) > 0
    a = np.where(keep, a, 0)
    # tidy the alpha's ends: near-zero to zero, near-one to one (no faint veil, no pin holes)
    a = np.clip((a - 0.04) / 0.92, 0, 1)
    Image.fromarray((a * 255 + 0.5).astype(np.uint8)).save(cache)
    return a


def foreground(img: np.ndarray, a: np.ndarray) -> np.ndarray:
    cache = f'{WORK}/fg.png'
    if os.path.exists(cache) and os.environ.get('REMATTE') != '1':
        return np.asarray(Image.open(cache)).astype(np.float64) / 255
    from pymatting import estimate_foreground_ml
    f = estimate_foreground_ml(img.astype(np.float64) / 255, a, regularization=1e-5, n_small_iterations=10, n_big_iterations=4)
    f = np.clip(f, 0, 1)
    Image.fromarray((f * 255 + 0.5).astype(np.uint8)).save(cache)
    return f


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def gblur(x, s):
    return cv2.GaussianBlur(x, (0, 0), s)


def interior_colour(f, solid, sigmas=(4, 10, 24, 60)):
    """The colour just inside her edge at every pixel (normalised convolution of the opaque pixels, widening until found)."""
    out = np.zeros_like(f); got = np.zeros(f.shape[:2])
    w = solid.astype(np.float64)
    for s in sigmas:
        num = gblur(f * w[..., None], s); den = gblur(w, s)
        est = num / np.maximum(den, 1e-6)[..., None]
        take = (den > 0.02) & (got == 0)
        out[take] = est[take]; got[take] = 1
    return out


def refine(f, a):
    """Firm, clean edges: a gentle curve on the alpha (no faint veil of sofa), then every edge pixel's colour pulled
    towards her own colour just inside the edge, in proportion to its transparency (no grey or rust fringe)."""
    a = smoothstep(0.05, 0.95, a)
    # the hair's outline: the photograph is a compressed screenshot, so the matte follows its 8 px blocks in steps.
    # Smooth the outline (a blurred, re-firmed copy) and keep a softened copy of the strands on top of it.
    h, w = a.shape
    hz = np.zeros((h, w))
    for x0, y0, x1, y1 in HAIR_ZONES:
        hz[y0:y1, x0:x1] = 1
    hz = gblur(hz, 12)
    outline = smoothstep(0.3, 0.7, gblur(a, 2.4))
    strands = gblur(a, 1.0)
    hair = np.clip(np.maximum(outline, strands * 0.85), 0, 1)
    a = a * (1 - hz) + hair * hz
    a = np.where(a > 0.004, gblur(a, 0.6), 0)
    a = np.clip(a, 0, 1)
    inside = interior_colour(f, a > 0.97)
    wgt = np.clip((1 - a) * 1.15, 0, 1) ** 0.8 * (a > 0)
    f = f * (1 - wgt[..., None] * 0.85) + inside * (wgt[..., None] * 0.85)
    return f, a


# ---------------------------------------------------------------- 4. the crown
PAD = 320  # rows added above the photograph


def edges_at(a, y):
    xs = np.where(a[y] > 0.5)[0]
    return xs.min(), xs.max()


def crown(f, a):
    """Extend the canvas upwards by PAD rows and complete the top of her head."""
    h, w = a.shape
    F = np.zeros((h + PAD, w, 3)); A = np.zeros((h + PAD, w))
    F[PAD:] = f; A[PAD:] = a
    # the hair's outline where the photograph cuts it, and its slope a little lower down
    l0, r0 = edges_at(a, 1); l1, r1 = edges_at(a, 41)
    sl, sr = (l0 - l1) / 40, (r1 - r0) / 40  # how far each side moves in per row going up
    # a dome continuing that outline: a cubic Bezier from the left edge to the right edge, tangent to both sides
    k = 0.38 * (r0 - l0)
    dl = np.array([sl, -1.0]); dl /= np.linalg.norm(dl)
    dr = np.array([-sr, -1.0]); dr /= np.linalg.norm(dr)
    P0 = np.array([l0, 0.0]); P3 = np.array([r0, 0.0]); P1 = P0 + k * dl; P2 = P3 + k * dr
    t = np.linspace(0, 1, 400)[:, None]
    curve = (1 - t) ** 3 * P0 + 3 * (1 - t) ** 2 * t * P1 + 3 * (1 - t) * t ** 2 * P2 + t ** 3 * P3
    poly = [(float(x), float(y + PAD)) for x, y in curve] + [(r0, PAD + 2), (l0, PAD + 2)]
    m = Image.new('L', (w * 4, (h + PAD) * 4), 0)
    ImageDraw.Draw(m).polygon([(x * 4, y * 4) for x, y in poly], fill=255)
    dome = np.asarray(m.resize((w, h + PAD), Image.LANCZOS)).astype(np.float64) / 255
    # hair for the dome. Hair on the crown runs out from the crown towards the cut, so every pixel of the dome takes the
    # colour of the strand it lies on: the ray from a point above the crown through the pixel meets the cut at x0, and the
    # hair just below the cut at x0 (a few rows averaged) gives the strand's colour. The parting continues to the crown
    # the same way. Further from the cut the strands soften, deepen a little and get the photograph's grain back.
    apex = curve[np.argmin(curve[:, 1])]
    C = np.array([apex[0], apex[1] - 0.3 * (r0 - l0)])
    band = f[2:10].mean(axis=0)                                  # (w, 3)
    yy, xx = np.mgrid[0:PAD, 0:w].astype(np.float64)
    y = yy - PAD                                                 # negative above the cut
    x0 = C[0] + (xx - C[0]) * (0 - C[1]) / np.maximum(y - C[1], 1e-3)
    x0 = np.clip(x0, 0, w - 1)
    lo = np.floor(x0).astype(int); hi = np.minimum(lo + 1, w - 1); t = (x0 - lo)[..., None]
    fill = band[lo] * (1 - t) + band[hi] * t
    d = -y
    soft = np.stack([gblur(fill[..., c], 1.5) for c in range(3)], -1)
    mix = smoothstep(2, 60, d)[..., None]
    fill = fill * (1 - mix * 0.5) + soft * (mix * 0.5)
    fill *= (1 - 0.08 * smoothstep(0, 70, d))[..., None]
    rng = np.random.default_rng(7)
    grain = gblur(rng.normal(0, 1, (PAD, w)), 0.7)
    fill += (grain * 0.012)[..., None]
    # a soft hair edge (about 2 px), as along the rest of her outline
    region = np.clip(gblur(dome[:PAD], 1.1), 0, 1)
    region = np.where(np.arange(PAD)[:, None] >= PAD - 3, np.maximum(region, A[PAD][None, :] * (dome[:PAD] > 0.5)), region)
    F[:PAD] = np.clip(fill, 0, 1)
    A[:PAD] = region
    return np.clip(F, 0, 1), A


# ---------------------------------------------------------------- 5. retouch
def retouch(f, a):
    img = (np.clip(f, 0, 1) * 255).astype(np.uint8)
    h, w = a.shape
    ycc = cv2.cvtColor(img, cv2.COLOR_RGB2YCrCb).astype(np.float64)
    Y, Cr, Cb = ycc[..., 0], ycc[..., 1], ycc[..., 2]
    skin = ((Cr > 136) & (Cr < 175) & (Cb > 85) & (Cb < 128) & (Y > 60) & (a > 0.9)).astype(np.float64)
    # keep eyes, brows, lips, nostrils and jewellery crisp (positions on the canvas, PAD rows down)
    keep = Image.new('L', (w, h), 0); d = ImageDraw.Draw(keep)
    for (cx, cy, rx, ry) in [(522, 296, 62, 34), (690, 350, 62, 34), (540, 506, 92, 44), (560, 432, 40, 24), (372, 370, 22, 52), (536, 432, 14, 14)]:
        d.ellipse((cx - rx, cy + PAD - ry, cx + rx, cy + PAD + ry), fill=255)
    keep = gblur(np.asarray(keep).astype(np.float64) / 255, 4)
    skin = gblur(skin, 3) * (1 - keep)
    x = img.astype(np.float64)
    # even skin: a bilateral low-frequency layer replaces blotches, the fine texture (pores) is added back
    low = cv2.bilateralFilter(img, 0, 16, 9).astype(np.float64)
    fine = x - gblur(x, 1.1)
    smooth = low + fine * 0.85
    x = x * (1 - skin[..., None] * 0.5) + smooth * (skin[..., None] * 0.5)
    # redness: pull very red patches of skin a little towards the average skin hue
    ycc2 = cv2.cvtColor(np.clip(x, 0, 255).astype(np.uint8), cv2.COLOR_RGB2YCrCb).astype(np.float64)
    m = skin > 0.5
    cr0 = np.median(ycc2[..., 1][m])
    ycc2[..., 1] = np.where(ycc2[..., 1] > cr0, ycc2[..., 1] - (ycc2[..., 1] - cr0) * 0.25 * skin, ycc2[..., 1])
    x = cv2.cvtColor(np.clip(ycc2, 0, 255).astype(np.uint8), cv2.COLOR_YCrCb2RGB).astype(np.float64)
    # warmth and a gentle curve over the whole portrait
    x = x * np.array([1.025, 1.0, 0.965])
    t = np.clip(x / 255, 0, 1)
    t = t + 0.05 * np.sin((t - 0.5) * np.pi) * 0.5
    t = np.clip(t * 1.02 + 0.006, 0, 1)
    # a little light in the eyes (local contrast only)
    eyes = Image.new('L', (w, h), 0); d = ImageDraw.Draw(eyes)
    for (cx, cy) in [(522, 296), (690, 350)]:
        d.ellipse((cx - 40, cy + PAD - 18, cx + 40, cy + PAD + 18), fill=255)
    eyes = gblur(np.asarray(eyes).astype(np.float64) / 255, 3)[..., None]
    t = t + (t - gblur(t, 2.0)) * 0.6 * eyes
    return np.clip(t, 0, 1)


# ---------------------------------------------------------------- 6. plates
def fade_edges(a):
    """Fade the alpha softly where the photograph ends (the bottom of her torso, her raised arm at the right edge).

    One rounded fade round her, centred below her face: it reaches nothing above her shoulders, ends exactly at the
    photograph's right and bottom edges, and is wide enough at the left to leave her other arm whole. The bottom-right
    corner, where both edges meet, fades earliest, so the raised arm melts away along its length instead of being cut."""
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    y = yy - PAD  # photo rows
    cx, cy = 560.0, 430.0
    rx = np.where(xx > cx, 1101 - cx, 900.0)
    ry = 1200 - cy
    # a rounded rectangle rather than an oval (power 4): the bottom fades level, the arm fades along the right edge
    r = ((np.abs(xx - cx) / rx) ** 4 + (np.maximum(y - cy, 0) / ry) ** 4) ** 0.25
    return a * (1 - smoothstep(0.78, 0.998, r))


def place(rgba: Image.Image, size, eye_frac, head_frac, cx_photo=575, eye_y=322, head_w=480):
    """Scale and place the canvas so the eyes sit at eye_frac of the height and the head spans head_frac of the width."""
    W, H = size
    s = W * head_frac / head_w
    big = rgba.resize((round(rgba.width * s), round(rgba.height * s)), Image.LANCZOS)
    ox = round(W / 2 - cx_photo * s)
    oy = round(eye_frac * H - (eye_y + PAD) * s)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # composite only the overlap (alpha_composite takes no negative offsets)
    sx, sy = max(0, -ox), max(0, -oy)
    out.alpha_composite(big.crop((sx, sy, min(big.width, sx + W - max(ox, 0)), min(big.height, sy + H - max(oy, 0)))), (max(ox, 0), max(oy, 0)))
    return out, s


def backdrop(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    top = np.array([246, 226, 196], np.float32); bot = np.array([214, 160, 140], np.float32)
    t = (yy / h)[..., None]
    base = top * (1 - t) + bot * t
    glow = np.exp(-(((xx - w * .5) / (w * .55)) ** 2 + ((yy - h * .36) / (h * .5)) ** 2))[..., None]
    base = base * (1 - .35 * glow) + np.array([255, 238, 214], np.float32) * (.35 * glow)
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert('RGBA')


def save(im, path, q):
    im.save(path, 'WEBP', quality=q, method=6)


def main():
    img = np.asarray(Image.open(SRC).convert('RGB'))
    a = build_alpha(img)
    f = foreground(img, a)
    f, a = refine(f, a)
    F, A = crown(f, a)
    F = retouch(F, A)
    cut = Image.fromarray(np.dstack([(F * 255 + .5).astype(np.uint8), (A * 255 + .5).astype(np.uint8)]), 'RGBA')
    cut.save(f'{WORK}/cutout-full.png')       # the whole cut-out, crown completed, no fades (for proofs)
    Af = fade_edges(A)
    plate_src = Image.fromarray(np.dstack([(F * 255 + .5).astype(np.uint8), (Af * 255 + .5).astype(np.uint8)]), 'RGBA')
    plate_src.save(f'{WORK}/cutout-faded.png')
    # the arch plate: 4:5, eyes at 38 % of the height (about a third once the arch crops it), the head 40 % of the width (room above her head); the fade at
    # the bottom of the photograph ends just above the plate's bottom edge
    plate, s = place(plate_src, (1200, 1500), 0.38, 0.40)
    plate.save(f'{WORK}/plate.png')
    for w in (900, 480):
        save(plate.resize((w, w * 5 // 4), Image.LANCZOS), f'{OUT}/cut/claire-{w}.webp', 88)
    # round portrait: head and shoulders on the studio backdrop
    r, _ = place(plate_src, (1090, 1090), 0.42, 0.44)
    bg = backdrop(1090, 1090); bg.alpha_composite(r)
    save(bg.convert('RGB').resize((720, 720), Image.LANCZOS), f'{OUT}/web/claire-round.webp', 88)
    # the old 826 x 900 slot, the same composition as the arch
    p, _ = place(plate_src, (1032, 1125), 0.34, 0.42)
    bg = backdrop(1032, 1125); bg.alpha_composite(p)
    save(bg.convert('RGB').resize((826, 900), Image.LANCZOS), f'{OUT}/web/claire-900.webp', 86)
    print('claire: plate scale', round(s, 3), 'outputs written')


if __name__ == '__main__':
    main()
