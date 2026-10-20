"""The Journal's article pictures (public/img/studio/journal/<slug>.webp): ONE whole tin each, seen from above.

The owner asked (October 2026) for each article to show one candle rather than a group of tins, a different candle for
each. Each is one tin out of a bench photograph already cut by tin_cutouts.py, cut the same way (its rim's ellipse, drawn
analytically), with the rim width measured over the whole group (measured on one tin alone it takes in the neighbours'
wax). Written at the cut-out's own size (never enlarged; about 440 to 500 px).

Usage: python3 -I tools/photo/journal_singles.py <repo>/public/img/studio
"""
import os, sys
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tin_cutouts as T  # noqa: E402
from moon_faces import master  # noqa: E402

# article slug: (group in tin_cutouts.CUTS, index of the one tin kept). Each tin lies whole inside its photograph.
ONE = {
    'wooden-wick': ('jarrah-top', 1),          # wood chips beside the flat wooden wick
    'first-burn': ('mothers-garden', 2),       # one dried flower, a wide face of wax
    'candle-safety': ('black-crescent', 4),    # a curve of small black stones along the rim
    'wax-guide': ('tuscan-sandalwood', 1),     # pale crystals along one side, most of the wax bare
    'candle-and-roller': ('spring-blooms', 2), # dried flowers and buds
}

if __name__ == '__main__':
    studio = sys.argv[1]
    os.makedirs(f'{studio}/journal', exist_ok=True)
    for slug, (grp, k) in ONE.items():
        cfg = dict(T.CUTS[grp])
        if not cfg.get('rim'):
            bgr = master(cfg['src'])
            V = cv2.GaussianBlur(cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[..., 2], (3, 3), 0).astype(np.float32)
            es = [T.fit(V, s, cfg.get('outer', False)) for s in cfg['tins']]
            cfg['rim'] = T.rim_width(cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32), es)
        cfg['tins'] = [cfg['tins'][k]]
        name = f'journal-tmp-{slug}'
        T.cutout(name, cfg, studio, None)
        os.replace(f'{studio}/tins/{name}-900.webp', f'{studio}/journal/{slug}.webp')
        os.remove(f'{studio}/tins/{name}-480.webp')
