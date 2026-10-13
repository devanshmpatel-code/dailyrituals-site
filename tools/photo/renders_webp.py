"""Make the webp the site serves for each canvas render in public/img/*.jpg (src/ui.ts fixImages rewrites name.jpg to name.webp),
plus the small widths of the concept card pictures (discovery, moondrop) and the 1200x630 share card (brand/og-1200x630.jpg).
Usage: python3 tools/photo/renders_webp.py   (from the repository root; needs Pillow)"""
import glob, os
from PIL import Image
root = 'public/img'
for f in sorted(glob.glob(f'{root}/*.jpg')):
    Image.open(f).convert('RGB').save(f[:-4] + '.webp', 'WEBP', quality=78, method=6)
for base in ('discovery', 'moondrop'):
    im = Image.open(f'{root}/{base}.jpg').convert('RGB')
    for w in (320, 640):
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(f'{root}/{base}-{w}.webp', 'WEBP', quality=78, method=6)
logo = Image.open(f'{root}/brand/logo-1200.webp').convert('RGBA')
card = Image.new('RGB', (1200, 630), (0x4A, 0x30, 0x50))  # the theme colour
lw = 880; logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
card.paste(logo, ((1200 - lw) // 2, (630 - logo.height) // 2), logo)
card.save(f'{root}/brand/og-1200x630.jpg', 'JPEG', quality=86, optimize=True)
