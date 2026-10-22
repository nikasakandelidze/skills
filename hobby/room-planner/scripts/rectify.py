#!/usr/bin/env python3
"""Cut a poster, picture or mirror out of a photo and flatten it to a straight-on image.

    python3 rectify.py photo.jpg --corners 375,293 550,316 548,530 383,517 --size 600x800 \
        --out public/items/poster-name.jpg

`--corners` are the picture's four corners in the photo's pixels, clockwise from the top left
(top-left, top-right, bottom-right, bottom-left), measured on the photo as it appears upright. `--size` is
the output width x height; keep the real aspect ratio (a 50 x 70 cm print -> 500x700).

`--grid` writes a copy of the upright photo with a 100 px grid instead, so you can read corner positions
(zoom into it, or crop with --crop x,y,w,h first).
Needs Pillow only.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


def solve(a, b):
    """Gaussian elimination for a small dense system a·x = b."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[pivot][col]) < 1e-12:
            raise SystemExit('Corners are degenerate (three in a line?). Check the order.')
        m[col], m[pivot] = m[pivot], m[col]
        for r in range(n):
            if r != col:
                f = m[r][col] / m[col][col]
                m[r] = [x - f * y for x, y in zip(m[r], m[col])]
    return [m[i][n] / m[i][i] for i in range(n)]


def perspective_coeffs(dst, src):
    """Coefficients that map output pixels (dst) back to photo pixels (src), as PIL expects."""
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        b += [u, v]
    return solve(a, b)


def point(text):
    x, y = text.split(',')
    return float(x), float(y)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('photo')
    ap.add_argument('--corners', nargs=4, type=point, metavar='X,Y')
    ap.add_argument('--size', default='600x800', help='output WxH in px (default 600x800)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--grid', action='store_true', help='write the photo with a pixel grid instead')
    ap.add_argument('--crop', help='with --grid: only this region x,y,w,h (shown at 2x)')
    args = ap.parse_args()

    img = ImageOps.exif_transpose(Image.open(args.photo)).convert('RGB')
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.grid:
        ox = oy = 0
        if args.crop:
            ox, oy, w, h = (int(v) for v in args.crop.split(','))
            img = img.crop((ox, oy, ox + w, oy + h)).resize((w * 2, h * 2))
        scale = 2 if args.crop else 1
        draw = ImageDraw.Draw(img)
        step = 50 if args.crop else 100
        start_x = (step - ox % step) % step
        start_y = (step - oy % step) % step
        for gx in range(start_x, img.width // scale + 1, step):
            draw.line([(gx * scale, 0), (gx * scale, img.height)], fill=(255, 0, 80), width=1)
            draw.text((gx * scale + 2, 2), str(gx + ox), fill=(255, 0, 80))
        for gy in range(start_y, img.height // scale + 1, step):
            draw.line([(0, gy * scale), (img.width, gy * scale)], fill=(0, 160, 255), width=1)
            if gy * scale > 14:
                draw.text((2, gy * scale + 2), str(gy + oy), fill=(0, 160, 255))
        img.save(out, quality=90)
        print(f'{out}  (photo is {img.width // scale}x{img.height // scale} px upright)')
        return

    if not args.corners:
        ap.error('--corners is required (or use --grid to find them)')
    w, h = (int(v) for v in args.size.lower().split('x'))
    dst = [(0, 0), (w, 0), (w, h), (0, h)]
    coeffs = perspective_coeffs(dst, args.corners)
    flat = img.transform((w, h), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)
    flat.save(out, quality=92)
    print(f'{out}  ({w}x{h})')


if __name__ == '__main__':
    main()
