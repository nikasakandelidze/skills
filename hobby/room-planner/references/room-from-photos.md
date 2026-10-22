# Reading a room from photos

The goal is a believable, correctly proportioned model of the room as it is today. It doesn't need to be
millimetre-exact, because the person can measure later, but things must be on the right walls, in the
right order, at plausible sizes.

## 1. See everything first

```bash
python3 <skill>/scripts/contact_sheet.py photo1.jpg photo2.jpg … --out sheet.jpg
python3 <skill>/scripts/contact_sheet.py walk.mp4 --fps 2 --out sheet.jpg     # video: frames in order
```

A video pan is the best map you'll get: consecutive frames show which wall connects to which. Phone videos
often carry a rotation flag; ffmpeg applies it, so frames come out upright.

Phone photos are usually ultra-wide (0.5×). Straight lines stay straight, but things near the edges look
bigger and closer than they are, so measure with objects near the centre of the frame when you can.

## 2. Map the walls

Choose a "north" wall (the back wall in the first photo works well) and go round clockwise seen from above:
north → east → south → west. For each wall write down, left to right as seen standing in the room facing it:

- finish and colour (paint, wallpaper, panelling, tiles; where a finish starts and stops)
- windows and doors: where they start and end, width, sill height, and anything special (balcony door,
  double door, built-in wardrobe that looks like a door)
- what hangs on it: posters, mirrors, shelves, AC unit, radiator, curtains (with the rail height)
- what stands against it: bed (headboard against it, or its side?), desk, shelves, sofa…

Then place the free-standing things relative to these (the desk is about 1 m from the north wall, with the
chair between them, and so on).

Corners are where you catch mistakes. If the bed's headboard is against the north wall in one photo, that
same wall must be on the bed's head side in every other photo where the bed appears.

## 3. Estimate sizes

Use several references and prefer ones at the same distance as the thing you're measuring:

| Reference | Typical size |
| --- | --- |
| Interior door leaf | 200–210 cm tall, 70–90 cm wide (double doors 120–160) |
| Ceiling | 250–280 cm (older buildings up to 320) |
| Bed frame | mattress width + 8–15 cm; length 205–215 cm; mattresses 90/120/140/160/180 × 200 |
| Desk | 74–76 cm high, 60–80 cm deep, 100–160 cm wide; standing desks 70–120 cm high |
| Office chair | seat ≈ 45–50 cm high; total 110–130 cm (with headrest) |
| Sofa seat height | ≈ 42–47 cm; depth 80–100 cm |
| Wall socket / light switch | ≈ 20–30 cm / 90–110 cm above the floor (varies by country) |
| Radiator | 50–60 cm tall, top ≈ 70 cm |
| Window sill | 80–95 cm |
| Poster / frame sizes | 21×30, 30×40, 40×50, 50×70, 60×80, 70×100 cm (A-sizes: 29.7×42, 42×59.4, 59.4×84) |
| Split AC indoor unit | ≈ 80–100 × 28–32 × 20–25 cm, mounted near the ceiling |

Work out a "cm per pixel" at the depth of the wall you're measuring (e.g. from a door or poster on it), then
measure along the wall. Then cross-check:

- Everything standing along a wall plus the gaps must add up to the wall's length.
- Opposite walls are the same length (rooms are almost always rectangles).
- The bed length plus the walkway at its foot should match the room depth when the bed spans it.

Round to whole centimetres and note in your summary which numbers are estimates.

## 4. Coordinates

- Units are cm. The origin is the **north-west inside corner**; `x` runs west → east (0 … width) and `z` runs
  north → south (0 … depth). Walls are drawn outside this rectangle.
- **Floor items**: `place: { type: 'floor', x, z, rot }`. `x, z` is the centre of the footprint; `rot` is
  degrees clockwise seen from above. At `rot: 0` the item's front faces south (+z). So something with its back
  against the north wall uses 0, against the east wall 90, the south wall 180, the west wall 270. For a bed the
  "front" is the foot end; for a desk it's the side you sit at.
- **Wall items and openings**: `along` is the centre position measured from the wall's left end as seen
  standing in the room facing that wall (north: from the west end, east: from the north end, south: from the
  east end, west: from the south end). `elev` is the bottom edge above the floor; `sill` is a window's.
- `size: { w, d, h }`: width (left–right as you face the item's front), depth, height. For wall items `d` is
  how far it sticks out of the wall.

The fit check in the app flags overlaps, things outside the room, things blocking a window, and things in
the door's swing. In "My room now" these almost always mean an estimate is off: adjust it.

## 5. The room file (`src/defaultState.ts`)

The template's file shows the shape. Fill in:

- `defaultRoom`: `name` ("Anna's bedroom"), `width`, `depth`, `height`, `wallColor`, `floorColor`, `finishes`
  (stretches of a different wall finish; dark finishes render as a soft textile, the rest as wallpaper),
  `wallNames` (the names they'd use: "window wall", "TV wall", "bed wall"), and `openings` (windows/doors with
  `along`, `width`, `height`, `sill`).
- `defaultItems`: one entry per thing, `id` (readable, e.g. `bed`, `desk-chair`), `name` (what they'd call it),
  `shape` + `style` + `finish` (see look-and-ux.md), `color` (+ `color2`), `size`, `place`. Mark building
  parts (radiator, AC, built-in wardrobe) `fixture: true, locked: true`.

## 6. Their wall art

Posters and pictures make the room recognisable. For each one, read the four corners of the picture in the
photo, then flatten it. A pixel grid over a 2× crop makes the corners easy to read exactly:

```bash
python3 <skill>/scripts/rectify.py photo.jpg --grid --crop 300,250,320,320 --out grid.jpg   # look at grid.jpg
python3 <skill>/scripts/rectify.py photo.jpg --corners 375,293 550,316 548,530 383,517 --size 600x800 \
  --out public/items/poster-name.jpg
```

Corners go clockwise from the top left, in the upright photo's pixels. Open the result to check it's straight
and complete.

Use the real aspect ratio for `--size`. If the crop includes the frame, set `frame: 0` on the item so the
model doesn't add a second frame. Objects in front of the art (a lamp shade, a plant) can be painted out
with a matching colour in a short PIL step.
