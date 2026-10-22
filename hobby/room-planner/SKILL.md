---
name: room-planner
description: Turn photos or a short video of someone's real room into a realistic, interactive 3D room planner they run locally. It has their own furniture rebuilt from the photos, a shop of real products from online stores in their country (true sizes, real prices, photos) that they can swap into the room, automatic layout suggestions, and a top-down plan. Use this whenever someone shares pictures of a bedroom, living room, studio or office and wants to redecorate, rearrange furniture, see whether a sofa/bed/desk would fit, try products from a shop in their space, plan a move, or asks "how would this look in my room". Use it even if they don't say "3D" or "planner".
---

# Room planner from photos

The person gets a local web app where their room looks like their room. They can walk around it in 3D, drag
furniture, ask for new layouts, and try real products from shops near them before buying. The idea behind it:
when you want to change a room, by rearranging or by buying something, agents should find the options and you
should only have to look and choose.

A finished, polished app ships with this skill in `assets/template/`. Don't rebuild it from scratch: copy it
and spend your effort on what's unique to this person, which is **their room**, **their furniture** and
**their local shops**. That's what makes the result feel like magic rather than a generic demo.

## What you'll hand over

- A project folder with the app running at `http://localhost:5178`, opened in the browser.
- **Explore** screen: their room in 3D (walls, floor, windows, door, their furniture and wall art) beside a
  top-down plan. Drag to move, click to turn, replace or remove. A **Layouts** drawer suggests arrangements.
- **Shop** screen: 40–60 real products from 2–3 local online stores, at least 2 per category, each with real
  size, price and photo. One click swaps their bed, sofa, lamp… for the product, at true scale.
- Trying anything opens a new version of the room; "My room now" stays as it is.
- An honest note on what was estimated (room size, furniture sizes) and what to measure or photograph next.

## Workflow

### 1. Gather what you need (ask only for what's missing)

You need photos that together show every wall. Four to eight photos from the corners, plus an optional
10–20 second slow pan video, are ideal. You also need the country or city, to pick shops. Nice to have:
tape-measured room width, depth and ceiling height, and the size of the big furniture.

Start with what they gave you. Don't block on measurements: estimate, label the estimates, and ask for numbers
at the end. If a wall is never visible, say which one and ask for one more photo of it.

### 2. Understand the room

Read `references/room-from-photos.md` before this step. In short:

1. Make contact sheets so you can see everything at once:
   `python3 <skill>/scripts/contact_sheet.py <photos-or-video...> --out <workdir>/sheet.jpg`. For video it
   extracts frames (2 per second) in order, which shows how the walls connect.
2. Pick a "north" wall (usually the one facing the camera in the first photo) and walk around the room in
   order. For each wall note: its finish and colour, the windows and doors (position, width, sill), what hangs
   on it, and what stands against it.
3. Estimate sizes from things whose size you know (doors, beds, desks, outlets, poster formats). Cross-check:
   the things along a wall have to add up to the wall's length.
4. Write the room into `src/defaultState.ts` of the project: size, wall colours and finishes, `wallNames`
   (what the person would call each wall, e.g. "window wall", "TV wall"), openings, and every piece of
   furniture with shape, style, finish, colours, size and position.
5. Cut their posters and pictures out of the photos so the 3D walls show their actual art:
   `python3 <skill>/scripts/rectify.py <photo> --corners x1,y1 x2,y2 x3,y3 x4,y4 --size 600x800 --out public/items/<name>.jpg`
   (corners clockwise from the top left; `--grid --crop x,y,w,h` draws a pixel grid on a zoomed crop so you
   can read them precisely).

### 3. Set up the app from the template

```bash
cp -R <skill>/assets/template <project-dir>      # e.g. ./room-planner
cd <project-dir> && npm install
npm run dev                                       # http://localhost:5178
```

Then:

- Replace `src/defaultState.ts` with the room from step 2. Use the existing shapes and styles: they cover
  beds, sofas, armchairs, desks, office chairs, chairs, shelving, storage, tables, lamps, plants, rugs,
  posters, mirrors, curtains, radiators, AC units, whiteboards and more (`references/look-and-ux.md` has the
  full list and how to pick). If one of their pieces really doesn't match anything, add a variant in
  `src/three/variants.tsx`, built from their photos, rather than settling for a box.
- Update `src/layouts.ts` if a hand-written layout makes no sense for their room (e.g. it pushes the bed
  under the only window).
- Fill in `CLAUDE.md` and `README.md` with this person's room and shops, so later sessions know the context.

### 4. Fill the shop with real local products

Read `references/shop-research.md` before this step. In short:

1. Find 2–3 online furniture stores that sell in their country and whose product pages show a price,
   dimensions and a photo. Check one product page yourself before sending out research.
2. Split the categories across parallel subagents (beds and storage; sofas, armchairs and tables; desks,
   chairs and shelving; lamps, mirrors and plants; rugs, curtains and wall art). Use the prompt template in the
   reference. Every number must come from a product page; nothing gets invented.
3. Save their results as `scripts/shop/raw-*.json`, set colours by eye in `scripts/shop/overrides.json`, and
   run `python3 scripts/shop/build_shop.py .`. It downloads the photos, cuts rug and wall-art textures out of
   them, and writes `data/shop.json`.

### 5. Check it the way they'll see it

Open the app in a browser and look, the way the person will. Don't just type-check.

- **Whole room** view: the room fits the frame, the walls look like the photos, and nothing is red in
  "My room now" unless it's really cramped. Overlaps usually mean a size or position estimate is off, so fix
  the estimate rather than ignoring it.
- **Close-ups** of each piece of their furniture next to its photo. Does it read as the same object? Adjust
  style, colours or proportions until it does.
- `?showroom` shows every shop product in one room. Scan it for anything that looks wrong.
- **Shop**: try a product in a few categories. The swap should land in the same spot and the cost line
  should update.
- **Layouts** drawer: suggestions appear, and picking one rearranges the room.
- The browser console should show no errors.

### 6. Hand over

Tell them how to open it (`npm run dev`, then the link), what you estimated, and the two things that make it
better: a few tape measurements, and close-up photos of anything that doesn't look right yet. Mention they
can paste any product link and ask you to add it to the shop.

## Principles

- **Real data only.** Sizes, prices and photos come from the product page or the person's photos. Where you
  estimate, say so in the item's notes and in your summary. A planner that says something fits when it
  doesn't is worse than none.
- **Their room, not a room.** Specific details sell it: the real art on the walls, the colour of the
  headboard, the radiator under the window. Spend time there.
- **Simple for non-technical people.** Keep the template's two screens, light theme and plain words. Don't
  add panels, settings or jargon. When in doubt, leave it out.
- **Never overwrite the real room.** Trying things happens in a new version; "My room now" changes only when
  they drag things there themselves.
- **Their photos stay local.** Everything runs on their machine. Don't upload their photos anywhere.

## Bundled files

- `assets/template/`: the app (Vite + React + three.js). Read its `CLAUDE.md` for the code map and data model.
- `scripts/contact_sheet.py`: photos or video → one overview image (needs Pillow, plus ffmpeg for video).
- `scripts/rectify.py`: perspective-correct a poster or picture out of a photo.
- `references/room-from-photos.md`: reading the room, estimating sizes, coordinates, the room file format.
- `references/shop-research.md`: finding stores, the research prompt, the product file format, building the shop.
- `references/look-and-ux.md`: choosing shapes, styles and finishes; adding a new look; UI rules.
