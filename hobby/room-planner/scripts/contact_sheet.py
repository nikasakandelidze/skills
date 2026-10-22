#!/usr/bin/env python3
"""Photos and/or videos of a room -> contact sheet(s) you can look at in one go.

    python3 contact_sheet.py IMG_1.jpg IMG_2.heic walk.mp4 --out sheet.jpg
    python3 contact_sheet.py walk.mp4 --fps 2 --per-sheet 20 --out sheet.jpg

Photos are turned upright from their EXIF orientation. Videos are sampled with ffmpeg (`--fps` frames per
second, upright, in order) so you can follow how one wall leads to the next. Every tile is labelled with its
file name (and the time, for video frames) so you can refer back to the full-size original.

If there are more tiles than `--per-sheet`, several sheets are written: sheet-1.jpg, sheet-2.jpg, …
With `--frames-dir`, the extracted video frames are kept there at full size so you can open single frames.
Needs Pillow (`pip install pillow`) and, for videos, ffmpeg. HEIC photos use pillow-heif if installed, else
macOS `sips`.
"""
import argparse
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

VIDEO = {'.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp'}
HEIC = {'.heic', '.heif'}


def font(size):
    for name in ('/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/SFNS.ttf',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'arial.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def open_photo(path: Path, tmp: Path) -> Image.Image:
    if path.suffix.lower() in HEIC:
        try:
            import pillow_heif  # type: ignore
            pillow_heif.register_heif_opener()
        except ImportError:
            if not shutil.which('sips'):
                raise SystemExit(f'{path.name}: HEIC needs `pip install pillow-heif` (or macOS sips)')
            out = tmp / (path.stem + '.jpg')
            subprocess.run(['sips', '-s', 'format', 'jpeg', str(path), '--out', str(out)],
                           check=True, capture_output=True)
            path = out
    img = Image.open(path)
    return ImageOps.exif_transpose(img).convert('RGB')


def video_frames(path: Path, fps: float, out_dir: Path):
    if not shutil.which('ffmpeg'):
        raise SystemExit('Videos need ffmpeg (macOS: `brew install ffmpeg`).')
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = out_dir / f'{path.stem}-%04d.jpg'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(path), '-vf', f'fps={fps}',
                    '-q:v', '3', str(pattern)], check=True)
    frames = sorted(out_dir.glob(f'{path.stem}-*.jpg'))
    for i, frame in enumerate(frames):
        seconds = i / fps
        yield f'{path.name} {int(seconds // 60)}:{seconds % 60:04.1f}', frame


def tiles_for(inputs, fps, frames_dir: Path, tmp: Path):
    for raw in inputs:
        path = Path(raw).expanduser()
        if not path.exists():
            print(f'skipping {raw}: not found', file=sys.stderr)
            continue
        if path.suffix.lower() in VIDEO:
            for label, frame in video_frames(path, fps, frames_dir):
                yield label, frame
        else:
            yield path.name, path


def build_sheet(tiles, tile_w, cols, tmp: Path) -> Image.Image:
    images = []
    for label, path in tiles:
        img = open_photo(path, tmp)
        img.thumbnail((tile_w, tile_w * 2))
        images.append((label, img))
    cols = min(cols, len(images))
    rows = math.ceil(len(images) / cols)
    label_h, pad = 26, 8
    cell_h = max(img.height for _, img in images)
    sheet = Image.new('RGB', (cols * (tile_w + pad) + pad, rows * (cell_h + label_h + pad) + pad), '#f4f4f2')
    draw = ImageDraw.Draw(sheet)
    f = font(16)
    for i, (label, img) in enumerate(images):
        x = pad + (i % cols) * (tile_w + pad)
        y = pad + (i // cols) * (cell_h + label_h + pad)
        sheet.paste(img, (x + (tile_w - img.width) // 2, y))
        draw.text((x + 2, y + cell_h + 4), f'{i + 1}. {label}'[:48], fill='#222', font=f)
    return sheet


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('inputs', nargs='+', help='photos and/or videos')
    ap.add_argument('--out', default='sheet.jpg', help='output image (default sheet.jpg)')
    ap.add_argument('--fps', type=float, default=2, help='video frames per second to sample (default 2)')
    ap.add_argument('--cols', type=int, default=4, help='tiles per row (default 4)')
    ap.add_argument('--tile', type=int, default=420, help='tile width in px (default 420)')
    ap.add_argument('--per-sheet', type=int, default=24, help='max tiles per sheet (default 24)')
    ap.add_argument('--frames-dir', help='keep extracted video frames here')
    args = ap.parse_args()

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmpname:
        tmp = Path(tmpname)
        frames_dir = Path(args.frames_dir) if args.frames_dir else tmp / 'frames'
        tiles = list(tiles_for(args.inputs, args.fps, frames_dir, tmp))
        if not tiles:
            raise SystemExit('Nothing to show.')
        chunks = [tiles[i:i + args.per_sheet] for i in range(0, len(tiles), args.per_sheet)]
        for n, chunk in enumerate(chunks, 1):
            target = out if len(chunks) == 1 else out.with_name(f'{out.stem}-{n}{out.suffix}')
            build_sheet(chunk, args.tile, args.cols, tmp).save(target, quality=85)
            print(f'{target}  ({len(chunk)} tiles)')


if __name__ == '__main__':
    main()
