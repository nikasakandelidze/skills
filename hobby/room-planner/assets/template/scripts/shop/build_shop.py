"""Builds data/shop.json from the researched product lists in this folder (raw-*.json).

Usage (from the room-planner folder):  python3 scripts/shop/build_shop.py .


Downloads each product's photos into public/shop/, samples the product's main colours from its
photo (ignoring the white studio background), maps the shop category to a 3D shape, and writes
the catalog. Re-runnable: photos already downloaded are kept.
"""
import json
import re
import subprocess
import sys
import urllib.request
from collections import Counter
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
APP = Path(sys.argv[1])
OUT_DIR = APP / "public" / "shop"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OVERRIDES = json.loads((HERE / "overrides.json").read_text()) if (HERE / "overrides.json").exists() else {}


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48]


def download(url, dest_stem):
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        if (OUT_DIR / f"{dest_stem}{ext}").exists():
            return f"/shop/{dest_stem}{ext}"
    quoted = urllib.parse.quote(url, safe=":/?=&%()")
    tmp = OUT_DIR / f"{dest_stem}.download"
    res = subprocess.run(
        ["curl", "-sSL", "--max-time", "40", "-A", "Mozilla/5.0 room-planner", "-o", str(tmp), "-w", "%{http_code} %{content_type}", quoted],
        capture_output=True,
        text=True,
    )
    code, _, ctype = res.stdout.partition(" ")
    if res.returncode != 0 or code != "200":
        print(f"  ! could not download {url}: {res.stderr.strip() or code}")
        tmp.unlink(missing_ok=True)
        return None
    data = tmp.read_bytes()
    tmp.unlink()
    ext = ".png" if "png" in ctype else ".webp" if "webp" in ctype else ".jpg"
    path = OUT_DIR / f"{dest_stem}{ext}"
    path.write_bytes(data)
    # Keep files reasonable: shop photos are often 2000px+.
    try:
        im = Image.open(path)
        if max(im.size) > 1200:
            im.thumbnail((1200, 1200))
            im.convert("RGB").save(path.with_suffix(".jpg"), quality=86)
            if path.suffix != ".jpg":
                path.unlink()
                path = path.with_suffix(".jpg")
    except Exception as e:  # noqa: BLE001
        print(f"  ! not an image {url}: {e}")
        path.unlink(missing_ok=True)
        return None
    return f"/shop/{path.name}"


def object_pixels(path):
    """Pixels that belong to the product: drops the plain light background around it."""
    im = Image.open(APP / "public" / path.lstrip("/")).convert("RGB")
    im.thumbnail((240, 240))
    w, h = im.size
    px = im.load()
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    bg = tuple(sum(c[i] for c in border) / len(border) for i in range(3))
    keep = []
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if sum(abs(c[i] - bg[i]) for i in range(3)) > 45 and not all(v > 238 for v in c):
                keep.append(c)
    return keep or [px[w // 2, h // 2]]


def palette(path, n=4):
    pixels = object_pixels(path)
    buckets = Counter((r // 24, g // 24, b // 24) for r, g, b in pixels)
    out = []
    for (r, g, b), count in buckets.most_common(12):
        col = (r * 24 + 12, g * 24 + 12, b * 24 + 12)
        if any(all(abs(col[i] - o[i]) < 40 for i in range(3)) for o in out):
            continue
        out.append(col)
        if len(out) == n:
            break
    return ["#%02x%02x%02x" % c for c in out]


def texture(photo, pid):
    """The product itself, cropped out of its studio photo, to use as its surface in 3D."""
    src = APP / "public" / photo.lstrip("/")
    im = Image.open(src).convert("RGB")
    w, h = im.size
    px = im.load()
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    bg = tuple(sum(c[i] for c in border) / len(border) for i in range(3))
    xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            c = px[x, y]
            if sum(abs(c[i] - bg[i]) for i in range(3)) > 40:
                xs.append(x)
                ys.append(y)
    if not xs:
        return photo
    box = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    # Trim a hair inside the edge so no background shows at the rim.
    inset = 3
    box = (box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset)
    out = APP / "public" / "shop" / f"{pid}-tex.jpg"
    im.crop(box).save(out, quality=88)
    return f"/shop/{out.name}"


SHAPES = {
    "bed": "bed",
    "sofa": "sofa",
    "armchair": "sofa",
    "desk": "desk",
    "officeChair": "officeChair",
    "bookshelf": "bookshelf",
    "wallShelf": "wallShelf",
    "floorLamp": "floorLamp",
    "rug": "rug",
    "curtain": "curtain",
    "wallArt": "poster",
    "mirror": "mirror",
    "plant": "plant",
    "nightstand": "box",
    "dresser": "box",
    "wardrobe": "box",
    "sideTable": "table",
}


def build():
    raw = []
    for f in sorted(HERE.glob("raw-*.json")):
        raw += json.loads(f.read_text())
    products = []
    for p in raw:
        pid = f"{slug(p['name'])}-{p['store'].lower()}"
        print(pid)
        photo = download(p["image"], f"{pid}-0") if p.get("image") else None
        photos = [u for u in (download(u, f"{pid}-{i + 1}") for i, u in enumerate(p.get("images") or [])) if u]
        if not photo:
            print("  ! skipped: no photo")
            continue
        cols = palette(photo)
        size = {k: (round(v, 1) if v is not None else None) for k, v in p["size"].items()}
        entry = {
            "id": pid,
            "name": p["name"],
            "shape": SHAPES[p["category"]],
            "size": size,
            "color": cols[0],
            "color2": cols[1] if len(cols) > 1 else None,
            "style": p.get("style"),
            "finish": p.get("finish"),
            "photo": photo,
            "photos": photos,
            "link": p["link"],
            "price": p["price"],
            "oldPrice": p.get("oldPrice"),
            "store": p["store"],
            "category": p["category"],
            "colorName": p.get("colorName"),
            "notes": p.get("notes") or None,
        }
        if p["category"] in ("rug", "wallArt"):
            entry["image"] = texture(photo, pid)
        entry.update(OVERRIDES.get(pid, {}))
        products.append({k: v for k, v in entry.items() if v not in (None, [], "")})
    (APP / "data" / "shop.json").write_text(json.dumps(products, indent=2, ensure_ascii=False) + "\n")
    print(f"\n{len(products)} products written")


import urllib.parse  # noqa: E402

build()
