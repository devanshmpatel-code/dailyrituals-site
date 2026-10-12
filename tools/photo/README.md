# Photo retouching

These scripts produce every studio photograph the site uses from Claire's originals in `public/img/studio/*.jpg`.

1. `grade.py` is the house retouch. It runs a light denoise, white balance from the wax, levels, a gentle curve, local contrast, vibrance and a light sharpen. Candle-lit photographs take `--dark`, which skips the wax white balance.
2. `derive.py` builds the web images from the graded masters:
   - the sizes in `web/`;
   - the square hero crops (`web/hero-*`) with a soft vignette;
   - the product cut-outs in `cut/`;
   - regraded copies of the archive pictures in `moons/`.

Requirements (Python 3.11): `opencv-python-headless`, `numpy`, `pillow`, `rembg`, `onnxruntime`, `pymatting`. The cut-outs use the rembg models `isnet-general-use` and `u2net`. Claire's portrait is made separately by `claire_portrait.py` (below), which also uses `birefnet-portrait` and `u2net_human_seg`.

Note: `derive.py` regrades `moons/` in place. Run it only from the original (ungraded) archive pictures, or they will be graded twice.

## Product cut-outs (added)
- `hero_cut.py` cuts out the lit Cabana and Verdant photographs. It also removes flash specks, dust and scratches from the black tin and lid. Lettering is protected: marks that sit in a row are treated as text and left alone.
- `picker_unlit.py`, `picker_rim.py` and `picker_foot.py` make the candle picker's photographs (`public/img/studio/picker/`): the unlit version of each lit photograph, a repair to the Cabana glow photograph's rim, and then, once, the feet of the tin and lid that the original photographs cropped (completed from the photographs' own colours, so they stand whole on the picker's floor).
- `lid_clean.py` gives a tin lid a clean matte finish inside its rim. It finds the printed scent sticker from its lettering and keeps it untouched. Pass the lid's centre and radius (from HoughCircles).
- `public/img/studio/tins/`: groups of whole tins seen from above, cut from the retouched photographs. Each tin's wax face is found as a separate shape, because the black rims divide the faces. Only tins whose whole outline is inside the frame are kept, and anything that belongs to a neighbouring tin is cut away. They are now made by `tin_cutouts.py` (below), which replaced that first inline script.

## Clean round cut-outs (October 2026)
The owner found the tin photographs "weird and cut out": flat sides where a photograph ended, slivers of neighbouring tins,
ragged edges with a halo of the paper behind. These scripts remake every candle and tin cut-out the site shows, along the
objects' real shapes instead of a mask's outline. Run them from the repository root with `python3 -I`.

- `tinfind.py` (shared): fits a tin's wax face, or its outer edge, as an ellipse from a seed (a rough centre and radius read
  off the photograph): rays out of the centre find the strongest step at the edge, and a robust fit ignores the rays that
  land on a topping.
- `moon_faces.py public/img/studio`: the archive's moons and the opening's candle moons (`moons/*.webp`, 520 px). Each is one
  candle's wax face, warped from its ellipse to a circle, cut a hair inside its edge (no rim, table or neighbour), with an
  exact anti-aliased circular edge and the edge colours taken from just inside. The faces chosen lie whole inside their
  photographs, so the circle is entirely the photograph's own pixels.
- `tin_cutouts.py public/img/studio`: the bench photographs of whole tins seen from above (`tins/*-480.webp`, `-900.webp`),
  used by From the studio, Ritual on Repeat, Send a Sunrise, the candle pages, the journal and the Moon Drops archive. Each
  tin is its rim's ellipse (the face grown by the measured rim width, or the tin's own outer edge where the inside of the tin
  shows above the wax), drawn analytically and anti-aliased; a tin that runs a little off its photograph is completed round
  its own circle from the colours at the two ends of the gap, with grain added back; the edge pixel is decontaminated. Tins
  cut off by more than a little are left out. Never enlarged: a cut-out narrower than 900 px keeps its own size.
- `cut_feet.py public/img/studio/cut`: completes the feet of the lit Cabana and Verdant cut-outs (`cut/`), which were cropped
  through the small tin and the lid; it reuses `picker_foot.py` (same photographs, same geometry). Run once.
- `westcoast_cut.py public/img/studio` (with `U2NET_HOME=/root/.rembg`): re-cuts the Westcoast deodorant jars from a crop of
  the photograph, keeps the one shape, fills its holes (the black label had gone), smooths and decontaminates the edge.

The masters are `/tmp/retouch/master/<name>.png` (grade.py); when one is missing `moon_faces.master()` grades it on the fly.
The flawed whole-tin cut-outs that no page showed (apple-cider, candy-cane-lane, easter-bread, mulled-wine, sea-salt-sage)
were removed rather than left to be picked up later.

## Claire's portrait and the glass tumblers (October 2026, second retouch)
The owner asked for Claire's picture to fit its frames better ("too close up"), as a professional cut-out with nothing of
the original background leaking and soft fades where the photograph ends, on the home page and the coaching page; and
for the glass candles' missing bottom-left glass to be put back everywhere (Cabana behind the shelf, the breathing pause).

- `claire_portrait.py public/img/studio` (with the rembg models in `/root/.rembg/models/<name>/`): rebuilds every Claire
  image from `claire.jpg`. Three rembg models and hand-drawn sofa areas make the trimap; closed-form matting (pymatting)
  finds the alpha, with the u2net matte along the cushion right of her hair and a traced curve by her ear where the
  compressed photograph defeats matting; the edges are decontaminated (`estimate_foreground_ml`, then pulled towards her
  own colour just inside). The crown the photograph cut flat is completed from the hair's own pixels along its flow. A
  gentle retouch evens and warms the skin (texture kept, no reshaping). It writes:
  - `cut/claire-900.webp` (900 x 1125) and `cut/claire-480.webp` (480 x 600): a transparent 4:5 plate for the arch frames
    (home Meet Claire, coaching opener): head and shoulders centred, room above her head, the torso and the raised arm
    fading softly to transparent where the photograph ends. The frames show it with `object-fit: cover` from the bottom.
  - `web/claire-round.webp` (720 x 720): head and shoulders on the warm studio backdrop (coaching Meet your coach, story).
  - `web/claire-900.webp` (826 x 900): the same on the backdrop (no page uses it at present).
- `glass_restore.py public/img/studio`: puts back the glass the background removal cut away from the tumblers in
  `cut/cabana-*`, `cut/verdant-*` and `picker/*` (lit, glow and unlit; 900 and 480). Each cut-out is registered to its
  master (template match, then ECC); the tumbler's outline is its walls plus a rounded base fitted to the side the cut
  kept, mirrored across the tumbler's axis to close the side it lost; inside it, the master's own pixels come back behind
  the lid's and tin's edges, mapped to each variant's grade by a polynomial colour fit over the whole tumbler. Half-
  transparent pixels inside the tins and lid are made opaque. Image sizes are unchanged. Run it after `picker_foot.py` and
  `cut_feet.py`, once.
- `frame_shots.mjs` (Node, with the preview running): screenshots of every frame that shows the portrait or a tumbler
  (home, coaching opener, Meet your coach, story, the home shelf, the shop's candle heading, the coaching cue kit, the
  breathing pause) at 1440, 1024, 390 and 360 px.

## The logo (October 2026)
- `logo_cut.py public/img/studio/logo.jpg public/img/brand`: lifts Claire's logo (white "Daily Rituals", cream "Co.",
  tagline and "Made in White Rock, BC" arc on black) off its black square. Because the ground is black, each pixel is ink
  times coverage, so the alpha is read back exactly (the pixel's projection on its ink colour) instead of cut with a mask.
  Each letter is assigned to the white or the cream ink as a whole shape (JPEG blurs colour at the edges of thin letters),
  faint edge pixels take the ink of the nearest letter, JPEG speckle and ringing are clipped, and the colour is set to the
  exact ink everywhere, so there is no grey fringe or dark halo. Writes `logo.png`, `logo-1200.webp` and `logo-600.webp`
  (used by the footer's signature and the Ritualists' membership card, `src/brand.ts`). It is made for dark grounds: the
  cream lettering is too pale to read on the light pages.
