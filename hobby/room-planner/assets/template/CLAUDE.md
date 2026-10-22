# Room planner: notes for Claude

A Vite + React + three.js (react-three-fiber) planner of one person's real room, for non-technical use: see
real furniture from local shops at true size in their room, swap things, and try layouts. Keep the UI
light-themed, plain-spoken and uncluttered: two screens, **Explore** (3D + top view + a layouts drawer) and
**Shop** (catalog beside the 3D room). Settings live behind the gear; versions of the room are in the
top-left menu. Resist adding panels and options: every extra control makes it harder for the people this
is for.

Run with `npm run dev` (port 5178). The dev server has a small file API (`vite.config.ts`): the app saves to
`data/state.json`, reads `data/catalog.json` ("My finds") and serves new images from `public/` immediately.
Editing the JSON while the app is open is picked up live. `?showroom` renders every shop product in one big
read-only room, handy for checking 3D models.

## The room (src/defaultState.ts)

The model of the room as it is today, worked out from the person's photos. Once the app has run,
`data/state.json` holds their edits; "Reset" in room settings goes back to `defaultState.ts`. Sizes are
estimates until they measure; when they give measurements, update both.

## The shop (data/shop.json)

Real products from online shops in the person's country. To add products:

1. From each product page take name, link, current price (and old price if discounted), **W × D × H in cm**
   from the spec table (never guess; inches × 2.54), colour name, and the main white-background photo URL plus
   up to two more. Put them in a `scripts/shop/raw-*.json` file with `category` (see `Category` in
   `src/types.ts`) and a `style`/`finish` that picks the right 3D look.
2. Add colours (by eye from the photo) and any special style/size to `scripts/shop/overrides.json`.
3. Run `python3 scripts/shop/build_shop.py .` from the project folder: it downloads photos to `public/shop/`,
   cuts rug and wall-art textures out of their photos, and writes `data/shop.json`.

3D looks are chosen by `shape` + `style` (+ `finish` for materials: fabric, velvet, boucle, leather, wood,
painted, metal). Variants live in `src/three/variants.tsx` (beds: wood/panel/cushioned; desks: standing/metal/
drawers/classic; sofas: modern-wood/modern-hidden; armchairs: wing/highback-metal/frame-metal/barrel; lamps:
tripod-drum/stick-dome/spot/arc; mirrors: wall-round/wall-arch/lean-rect/lean-arch; plants: tree/broad/palm;
rugs: plain/shaggy/pattern/round/oval; curtains: sheer/semi/blackout; storage: drawers/legs/doors/combi;
tables: round-pedestal/shelf-wood/cabinet-metal; shelving: metal; wall shelf: ladder). Items without a style
use the originals in `src/three/models.tsx`. If something needs a look that doesn't exist, add a variant
from its photos rather than forcing a poor match.

For a one-off thing the person found (not a shop product), add it to `data/catalog.json` instead (same
`CatalogEntry` fields; download its photo to `public/items/`; never hot-link shop images, WebGL needs CORS).

Trying things never touches the real room: `tryProduct` (`src/shop.ts`) opens a new version first if the
person is on "My room now" (the `current` variant). Do the same if you place things by editing
`data/state.json`.

## Layouts

`src/autoLayout.ts` generates arrangements automatically: random wall-anchored placements, collision-free
nudging, then a score (free floor, a walkable path from the door to bed/desk/sofa, desk near a window,
windows clear, no fit errors), keeping the best distinct ones. `src/layouts.ts` has hand-written classics;
adjust them to the room's walls. Wall names in suggestions come from `room.wallNames`.

## Coordinates

- All lengths in cm. Plan origin is the north-west inside corner; `x` runs west→east, `z` north→south.
  "North" is simply the wall chosen as the back wall when the room was modelled.
- Floor items: `{ "type": "floor", "x", "z", "rot" }` (centre; degrees clockwise from above; rot 0 faces south).
- Wall items: `{ "type": "wall", "wall", "along", "elev" }` (`along` from the wall's left end as seen facing
  it: north from west, east from north, south from east, west from south; `elev` = bottom edge height).

Code map: `src/geometry.ts` walls, footprints, fit checks · `src/placement.ts` where new/swapped things go ·
`src/store.ts` state, undo, versions · `src/shop.ts` categories, try-on, costs · `src/three/` 3D
(`models.tsx`, `variants.tsx`, `materials.ts` procedural PBR, `geometries.ts` soft shapes, `RoomMesh.tsx`,
`Scene.tsx`) · `src/plan/PlanView.tsx` floor plan · `src/ui/` top bar, `ShopPanel`, `LayoutsDock`, room
settings (`RoomTab`), photo dialog, ⌘K menu · `src/photo.ts` background removal · tokens in `src/styles.css`.
