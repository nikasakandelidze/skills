# Filling the shop with real local products

The shop is what turns this from a model into a decision tool, so the products have to be real: things the
person can actually buy near them, at their real size and price. Aim for 40–60 products across the
categories, at least 2 per category, from 2–3 stores, in a range of styles, colours and prices.

## 1. Pick the stores

Search for online furniture and home stores that deliver in their country or city. Good candidates, in order:

1. Big chains with a local site and full spec tables (IKEA, JYSK, Ashley, Home24, Wayfair, Leroy Merlin…
   whichever operate there).
2. Strong local furniture stores with proper product pages.
3. Marketplaces, only if nothing better exists (sizes are often missing or wrong).

Before sending researchers, open one product page yourself (WebFetch) and confirm it shows **dimensions**,
**price** and a **photo URL**. Note quirks: maybe the English page has an empty spec table but the local
language page doesn't; maybe width and depth are swapped; maybe sizes are only in inches.

## 2. Research in parallel

Categories (ids from `Category` in `src/types.ts`): bed, sofa, armchair, desk, officeChair, bookshelf,
floorLamp, rug, curtain, wallArt, mirror, plant, nightstand, dresser, wardrobe, sideTable, wallShelf.

Send one subagent per group so it finishes quickly, for example:

- beds, nightstands, wardrobes, dressers
- sofas, armchairs, side/coffee tables
- desks, office chairs, bookcases, wall shelves
- floor lamps, mirrors, plants
- rugs, curtains, wall art

Prompt template (adapt the stores, the room size and the categories):

```
You are collecting REAL products from online stores in <country> so someone can try them in a 3D model of
their room (about <W> × <D> cm, ceiling <H> cm). Use WebFetch (and WebSearch if needed). Do NOT invent
anything: every value must come from the product page you fetched.

Stores: <store 1 with an example category URL and product URL; note quirks such as "the English spec table is
empty, use the <language> page">, <store 2 …>

YOUR CATEGORIES: 1. "<category>" — <what to look for, e.g. "compact sofas 140–210 cm wide that fit a small
room">. Get <n>. … Mix stores, styles and colours so there is real choice.

For EACH product open its page and record: name, store, category, link, price (current, as shown, with
currency), oldPrice if discounted, size {w, d, h} in cm (overall assembled size; inches × 2.54; null and a note
if missing), colorName, materials, image (main photo URL, prefer a plain white background), images (up to 2
more photo URLs), and <extra fields for the category: office chairs "mesh" or "padded"; lamps tripod/arc/stick/
spot and drum/dome/cone shade; mirrors wall or floor-standing and rect/round/arch; plants tree/broad/palm; rugs
whether a photo shows it flat from above; wall art framed or canvas>, notes.

Return ONLY a JSON array of objects with those keys. Double-check that every URL you return appeared in content
you fetched.
```

Review what comes back. Check that sizes are plausible for the product type, that width and depth aren't
swapped (a desk can't be 70 wide × 140 deep), and that plant listings giving only the pot width get a
realistic footprint in `size` plus a note.

## 3. The product file

Save each group's results as `scripts/shop/raw-<group>.json` in the project, normalising the extra fields
into `style` and `finish` (the 3D look):

```json
{
  "name": "Sofa EGEDAL 2.5-seater, green velvet",
  "store": "JYSK",
  "category": "sofa",
  "link": "https://…",
  "price": "1,079.40 ₾",
  "oldPrice": "1,799.00 ₾",
  "size": { "w": 170, "d": 81, "h": 82 },
  "colorName": "Green velvet, dark wooden legs",
  "image": "https://…/main.jpg",
  "images": ["https://…/2.jpg"],
  "style": "modern-wood",
  "finish": "velvet",
  "notes": "2.5-seater, seat height 50 cm."
}
```

`style` and `finish` values are listed in look-and-ux.md. The currency symbol is taken from the prices
automatically.

## 4. Build

```bash
python3 scripts/shop/build_shop.py .
```

This downloads each product's photos to `public/shop/` (with curl, because Python on macOS often lacks SSL
certificates), samples colours, cuts the rug and wall-art photos down to the object to use as their 3D
texture, maps categories to shapes, and writes `data/shop.json`. It's safe to re-run: existing photos are kept.

Sampled colours are often off (white backgrounds tint them, bedding outweighs the frame). Look at a contact
sheet of the photos and set the real colours by eye in `scripts/shop/overrides.json`, keyed by product id
(the id is printed during the build). You can also override `style`, `finish`, `size` or `frame` there:

```json
{
  "bed-frame-kongsberg-160x200-grey-jysk": { "color": "#3a3c40", "color2": "#eceae4" },
  "dressing-mirror-norring-48x180-bamboo-jysk": { "style": "lean-rect", "size": { "w": 48, "d": 20, "h": 180 } }
}
```

What `color2` means depends on the shape: bedding for beds, legs or base for desks, chairs and sofas, the shade
for lamps, the pot for plants, and the top for drawer units.

Then open `http://localhost:5178/?showroom` and look at every product. Fix any whose 3D look doesn't match its
photo, either with an override or a new variant.

## Adding one product later

When the person pastes a link, follow the same steps for one product: fetch the page, add an entry to a raw
file, re-run the build, and check it in the showroom. If it's a one-off find rather than a shop product, add it
to `data/catalog.json` with its photo saved in `public/items/`.
