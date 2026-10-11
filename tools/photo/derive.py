"""Builds every web image the site uses from the retouched masters in /tmp/retouch/master (see grade.py).

- web/<name>-1000.webp and -560.webp (scaled, some cropped to the aspect the layout uses)
- web/hero-<name>-1000.webp and -720.webp: square crops for the hero arch, with a soft vignette
- cut/: product cut-outs re-cut from the retouched photographs; Claire from /tmp/retouch/claire-cut.png
- web/claire-900.webp: the coaching portrait (Claire's cut-out over a warm studio backdrop)
- web/claire-round.webp: the story page's round portrait, the same treatment
- moons/*.webp: the circular archive pictures, regraded in place (alpha kept)
Usage: python3 -I derive.py <repo>/public/img/studio
"""
import sys, os, subprocess
import numpy as np
from PIL import Image, ImageFilter

OUT = sys.argv[1]
M = '/tmp/retouch/master'
HERE = os.path.dirname(os.path.abspath(__file__))


def save(im, path, q=82):
    im.save(path, 'WEBP', quality=q, method=6)


def crop_aspect(im, ar, cx=0.5, cy=0.5):
    w, h = im.size
    if w / h > ar:
        nw = round(h * ar); x = int(min(max(cx * w - nw / 2, 0), w - nw)); return im.crop((x, 0, x + nw, h))
    nh = round(w / ar); y = int(min(max(cy * h - nh / 2, 0), h - nh)); return im.crop((0, y, w, y + nh))


def vignette(im, amount=0.16):
    w, h = im.size
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
    v = 1 - amount * np.clip((d - 0.45) / 0.55, 0, 1) ** 1.6
    a = np.array(im.convert('RGB')).astype(np.float32) * v[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def sizes(im, name, widths):
    for w in widths:
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if im.width != w else im
        save(r, f'{OUT}/web/{name}-{w}.webp')


def master(n):
    return Image.open(f'{M}/{n}.png').convert('RGB')


# ---- web photographs used by the layout ----
WEB = {  # name: (source, aspect or None, cx, cy)
    'candle-season': ('candle-season', None, .5, .5),
    'crystal-mushrooms': ('crystal-mushrooms', None, .5, .5),
    'black-crescent': ('black-crescent', None, .5, .5),
    'pumpkin-spice': ('pumpkin-spice', None, .5, .5),
    'midnight-forest-lit': ('midnight-forest-lit', None, .5, .5),
    'midnight-forest-moons': ('midnight-forest-moons', None, .5, .5),
    'large-candles': ('large-candles', None, .5, .5),
    'mothers-day-florals': ('mothers-day-florals', 3 / 2, .5, .5),
    'sweet-romance': ('sweet-romance', 4 / 3, .5, .5),
    'howlite-batch': ('howlite-tins-batch', 3 / 2, .5, .5),
}
for name, (src, ar, cx, cy) in WEB.items():
    im = master(src)
    if ar: im = crop_aspect(im, ar, cx, cy)
    sizes(im, name, (1000, 560))

# ---- hero arch: square crops, gently vignetted ----
HERO = {  # name: (source, cx, cy)
    'spring-blooms': ('spring-blooms', .5, .5), 'mothers-garden': ('mothers-garden', .5, .5), 'sweet-romance': ('sweet-romance', .5, .5),
    'sea-salt-sage': ('sea-salt-sage', .5, .5), 'hello-cupcake': ('hello-cupcake', .5, .5), 'easter-bread': ('easter-bread', .5, .5),
    'christmas-eve': ('christmas-eve', .5, .5), 'crystal-mushrooms': ('crystal-mushrooms', .5, .5), 'candy-cane-lane': ('candy-cane-lane', .5, .5),
    'cabana': ('cabana-candles', .55, .5), 'mulled-wine': ('mulled-wine', .5, .5), 'apple-cider': ('apple-cider', .5, .5),
    'midnight-forest': ('midnight-forest-lit', .5, .5), 'verdant': ('verdant-candles', .56, .5),
}
for name, (src, cx, cy) in HERO.items():
    im = vignette(crop_aspect(master(src), 1, cx, cy), 0.14)
    im = im.resize((1000, 1000), Image.LANCZOS)
    save(im, f'{OUT}/web/hero-{name}-1000.webp'); save(im.resize((720, 720), Image.LANCZOS), f'{OUT}/web/hero-{name}-720.webp')

# ---- cut-outs re-cut from the retouched photographs ----
from rembg import remove, new_session
s = new_session('isnet-general-use')
for name, src, hard in [('verdant', 'verdant-candles', True), ('cabana', 'cabana-candles', True), ('westcoast', 'westcoast-deodorant', True)]:
    if name == 'westcoast':
        out = remove(master(src), session=new_session('u2net'), post_process_mask=True)
    else:
        out = remove(master(src), session=s)
    a = out.split()[3].point(lambda v: 0 if v < 30 else (255 if v > 215 else v)); out.putalpha(a)
    out = out.crop(out.getbbox())
    if name == 'westcoast':
        save(out, f'{OUT}/cut/westcoast.webp', 86)
    else:
        for w in (480, 900):
            save(out.resize((w, round(out.height * w / out.width)), Image.LANCZOS), f'{OUT}/cut/{name}-{w}.webp', 84)
    print(name, out.size)

claire = Image.open('/tmp/retouch/claire-cut.png').convert('RGBA')
claire = claire.crop(claire.getbbox())
for w in (480, 900):
    save(claire.resize((w, round(claire.height * w / claire.width)), Image.LANCZOS), f'{OUT}/cut/claire-{w}.webp', 86)


# Claire over a warm studio backdrop (soft light behind her, the brand's sand and rose), for the photo slots that are not cut-outs
def backdrop(w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    top = np.array([246, 226, 196], np.float32); bot = np.array([196, 140, 128], np.float32)
    t = (yy / h)[..., None]
    base = top * (1 - t) + bot * t
    glow = np.exp(-(((xx - w * .5) / (w * .55)) ** 2 + ((yy - h * .38) / (h * .5)) ** 2))[..., None]
    base = base * (1 - .35 * glow) + np.array([255, 236, 210], np.float32) * (.35 * glow)
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert('RGBA')


def on_backdrop(size, scale, ox, oy):
    W, H = size
    bg = backdrop(W, H)
    c = claire.resize((round(claire.width * scale), round(claire.height * scale)), Image.LANCZOS)
    bg.alpha_composite(c, (ox, oy))
    return bg.convert('RGB')


# coaching portrait slot: 826 x 900, object-position 46% 14%
p = on_backdrop((826, 900), 826 * 1.04 / claire.width, -18, 900 - round(claire.height * 826 * 1.04 / claire.width))
save(p, f'{OUT}/web/claire-900.webp', 86)
# story page round portrait: 360 square, head and shoulders
r = on_backdrop((360, 360), 360 * 1.25 / claire.width, -45, 0)
save(r, f'{OUT}/web/claire-round.webp', 88)

# ---- the archive's circular pictures: regraded in place ----
for f in sorted(os.listdir(f'{OUT}/moons')):
    if not f.endswith('.webp'): continue
    src = f'{OUT}/moons/{f}'; tmp_in = f'/tmp/retouch/moon-in.png'; tmp_out = f'/tmp/retouch/moon-out.png'
    Image.open(src).save(tmp_in)
    subprocess.run([sys.executable, '-I', f'{HERE}/grade.py', tmp_in, tmp_out, '--strength', '0.85'], check=True, capture_output=True)
    save(Image.open(tmp_out), src, 84)
print('done')
