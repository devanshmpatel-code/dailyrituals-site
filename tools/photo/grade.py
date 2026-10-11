"""House retouch for Claire's studio photographs (Instagram screenshots, ~1200 px).

Steps, in order: light denoise (Instagram compression), white balance from the wax (the wax is white, so the
brightest low-saturation pixels are pulled to a warm white), levels from percentiles, a gentle S-curve, local
contrast (CLAHE on L, blended), vibrance (lifts muted colours more than strong ones, protects the wax), and a
light unsharp mask. Dark, candle-lit photographs skip the wax white balance (the flame would skew it).

Usage: python3 -I grade.py <src> <dst> [--dark] [--strength 1.0]
Alpha is kept when the source has it (the circular "moons" and the cut-outs).
"""
import sys
import numpy as np
import cv2


def grade(bgr: np.ndarray, dark: bool = False, strength: float = 1.0) -> np.ndarray:
    img = bgr.astype(np.float32)
    # 1. denoise lightly (compression blocks and chroma noise)
    den = cv2.fastNlMeansDenoisingColored(bgr, None, 3, 4, 7, 21).astype(np.float32)
    img = img * 0.35 + den * 0.65

    # 2. white balance from the wax
    lab = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[..., 0]
    hsv = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    S = hsv[..., 1]
    if not dark:
        m = (L > np.percentile(L, 88)) & (S < 60)
        if m.sum() > 500:
            ref = img[m].mean(axis=0)  # B, G, R of the wax
            target = np.array([236.0, 243.0, 248.0])  # a warm white (B, G, R)
            gain = np.clip(target / np.maximum(ref, 1), 0.86, 1.22)
            gain = 1 + (gain - 1) * 0.8 * strength
            img = img * gain
    else:
        # gray-world, very gently, so the flame stays warm
        mean = img.reshape(-1, 3).mean(axis=0)
        gain = np.clip(mean.mean() / np.maximum(mean, 1), 0.93, 1.07)
        img = img * (1 + (gain - 1) * 0.5)

    # 3. levels from percentiles
    lum = img.mean(axis=2)
    lo, hi = np.percentile(lum, 0.6), np.percentile(lum, 99.7)
    lo_t, hi_t = (4.0, 252.0) if not dark else (2.0, 250.0)
    img = (img - lo) * ((hi_t - lo_t) / max(hi - lo, 1)) + lo_t
    img = np.clip(img, 0, 255)

    # 4. gentle S-curve (shadows a touch deeper, highlights a touch brighter, midtones kept)
    x = img / 255.0
    k = 0.10 * strength
    x = x + k * np.sin((x - 0.5) * np.pi) * 0.5 * (1 - np.abs(2 * x - 1) * 0.3)
    img = np.clip(x, 0, 1) * 255

    # 5. local contrast (clarity) on L
    u8 = img.astype(np.uint8)
    lab = cv2.cvtColor(u8, cv2.COLOR_BGR2LAB)
    cl = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8)).apply(lab[..., 0])
    lab[..., 0] = cv2.addWeighted(lab[..., 0], 0.55, cl, 0.45, 0)
    u8 = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 6. vibrance: muted colours gain more than strong ones; near-white wax is protected
    hsv = cv2.cvtColor(u8, cv2.COLOR_BGR2HSV).astype(np.float32)
    s = hsv[..., 1] / 255.0
    v = hsv[..., 2] / 255.0
    protect = np.clip((v - 0.82) / 0.15, 0, 1) * np.clip((0.22 - s) / 0.22, 0, 1)
    boost = (0.20 * strength) * (1 - s) * (1 - protect)
    hsv[..., 1] = np.clip(s * (1 + boost), 0, 1) * 255
    u8 = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    # 7. unsharp mask (light, with a threshold so flat wax stays smooth)
    f = u8.astype(np.float32)
    blur = cv2.GaussianBlur(f, (0, 0), 1.2)
    diff = f - blur
    mask = (np.abs(diff).max(axis=2, keepdims=True) > 3).astype(np.float32)
    f = f + diff * 0.55 * mask
    return np.clip(f, 0, 255).astype(np.uint8)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    dark = '--dark' in sys.argv
    strength = float(sys.argv[sys.argv.index('--strength') + 1]) if '--strength' in sys.argv else 1.0
    im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    alpha = None
    if im.ndim == 3 and im.shape[2] == 4:
        alpha = im[..., 3]
        im = im[..., :3]
    out = grade(im, dark, strength)
    if alpha is not None:
        out = np.dstack([out, alpha])
    ok = cv2.imwrite(dst, out, [cv2.IMWRITE_PNG_COMPRESSION, 3]) if dst.endswith('.png') else cv2.imwrite(dst, out)
    print(dst, ok)


if __name__ == '__main__':
    main()
