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
