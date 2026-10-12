# Photo retouching

These scripts produce every studio photograph the site uses from Claire's originals in `public/img/studio/*.jpg`.

1. `grade.py` is the house retouch. It runs a light denoise, white balance from the wax, levels, a gentle curve, local contrast, vibrance and a light sharpen. Candle-lit photographs take `--dark`, which skips the wax white balance.
2. `derive.py` builds the web images from the graded masters:
   - the sizes in `web/`;
   - the square hero crops (`web/hero-*`) with a soft vignette;
   - the product cut-outs in `cut/`;
   - Claire's portraits;
   - regraded copies of the archive pictures in `moons/`.

Requirements (Python 3.11): `opencv-python-headless`, `numpy`, `pillow`, `rembg`, `onnxruntime`, `pymatting`. The cut-outs use the rembg models `isnet-general-use` and `u2net`. Claire's cut-out also uses `birefnet-portrait`, combined with the `u2net` mask so the sofa behind her drops out, then cleaned at the edges with pymatting's `estimate_foreground_ml`. `derive.py` reads that result from `/tmp/retouch/claire-cut-clean.png`.

Note: `derive.py` regrades `moons/` in place. Run it only from the original (ungraded) archive pictures, or they will be graded twice.

## Product cut-outs (added)
- `hero_cut.py` cuts out the lit Cabana and Verdant photographs. It also removes flash specks, dust and scratches from the black tin and lid. Lettering is protected: marks that sit in a row are treated as text and left alone.
- `lid_clean.py` gives a tin lid a clean matte finish inside its rim. It finds the printed scent sticker from its lettering and keeps it untouched. Pass the lid's centre and radius (from HoughCircles).
- `public/img/studio/tins/`: groups of whole tins seen from above, cut from the retouched photographs. Each tin's wax face is found as a separate shape, because the black rims divide the faces. Only tins whose whole outline is inside the frame are kept, and anything that belongs to a neighbouring tin is cut away. (The script is the inline block that produced `/tmp/cut4`. It still needs to be saved here.)
