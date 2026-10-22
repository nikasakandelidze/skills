# Looks and UX

## Choosing a 3D look

Every item has a `shape`, an optional `style` (the variant within the shape) and an optional `finish` (the
main material). Pick whatever matches the photo best. Proportions come from `size`, so a 140 cm sofa and a
210 cm sofa use the same style.

| shape | styles | notes |
| --- | --- | --- |
| bed | *(none)* buttoned upholstered headboard, wooden legs · `wood` low panel headboard, storage drawers · `panel` tall wooden headboard + footboard with posts · `cushioned` deep padded headboard on a platform | `color` frame, `color2` bedding; `h` is the headboard height |
| desk | *(none)*/`standing` electric standing desk · `metal` simple metal T-legs · `drawers` wooden top over a drawer apron, metal legs · `classic` painted turned legs + drawers | `color` top, `color2` legs/base |
| officeChair | `mesh` ergonomic mesh back (headrest when h > 115) · `executive` padded leather | `color2` base (light = chrome, dark = black plastic) |
| sofa | *(none)* overstuffed leather loveseat with rolled arms · `modern-wood` track arms, tapered wooden legs · `modern-hidden` plush, low feet, throw pillows · armchairs: `wing`, `highback-metal`, `frame-metal`, `barrel` | width < 115 cm counts as an armchair |
| bookshelf | *(none)* closed sides and back, filled with books · `metal` open metal frame with an X-brace | `finish: painted` for white/lacquered |
| box (storage) | `drawers` · `legs` drawer box on splayed legs · `doors` 2-door wardrobe · `combi` doors over drawers | nightstand / dresser / wardrobe categories |
| table | `round-pedestal` · `shelf-wood` square with a slatted lower shelf · `cabinet-metal` oval cabinet on thin legs · *(none)* plain 4-leg table | |
| floorLamp | *(none)* tripod with an egg dome shade · `tripod-drum` · `stick-dome` · `spot` reading lamp · `arc` | `color2` shade |
| plant | `tree` · `broad` (banana, bird of paradise) · `palm` · *(none)* generic leafy | `color` leaves, `color2` pot |
| rug | `plain` · `shaggy` · `pattern` · `round` · `oval` | `image` = the rug photo cut to the rug (pattern texture) |
| curtain | `sheer` · `semi` · `blackout` (*none* = plain cloth) | wall item; `h` usually ceiling − 4 cm |
| mirror | `wall-round` · `wall-arch` (window-pane) · `lean-rect` · `lean-arch` (*none* = plain rectangle) | leaning mirrors: `elev: 0`, `d` ≈ 20 cm footprint |
| poster | framed print or canvas | `image` = the art; `frame` = border in cm, or 0 if the image includes it |
| wallShelf | *(none)* floating shelf · `ladder` metal-framed shelf unit | |
| others | `chair`, `foldingChair`, `tripod`, `lightStand`, `whiteboard`, `ac`, `radiator`, `cutout` (a photo with its background removed, standing at real size) | |

Finishes: `fabric`, `velvet` (soft sheen), `boucle` (teddy/loop texture), `leather`, `wood` (real grain in the
given colour), `painted` (smooth laminate), `metal`.

### When nothing fits

Add a variant in `src/three/variants.tsx` and route it in `ShapeModel` (`src/three/models.tsx`). Build it from
the photo with the existing parts:

- `Part` (box with optional rounded edges), `Cyl`, `Rod` (between two points), `Ball`, `Shape` (any geometry)
- soft shapes in `geometries.ts`: `cushionGeometry` (sofa cushions, mattresses), `pillowGeometry`,
  `bentPanelGeometry` (curved chair backs, barrel chairs), `headboardGeometry`, `duvetGeometry`, `tubeAlong`
  (cables, bent lamp necks)
- `material(kind, colour)` from `materials.ts` for realistic surfaces

Conventions: metres; floor items centred on their footprint, standing on y = 0, front facing +z; wall items hang
from the wall surface (z = 0) with their bottom edge at y = 0. Check the result in `?showroom` from close up.
The usual tells of a poor model are floating parts (connect them) and paper-thin soft things (give them
thickness).

## UX rules (why the template looks the way it does)

The people using this are not technical. The first version of this app had a sidebar, inspector panels and
dark mode, and real users found it overwhelming. What works:

- **Two screens.** Explore (3D + top view, with a Layouts drawer) and Shop (catalog beside the 3D room). The
  top view stays visible in Explore because people navigate with it.
- **Light theme, plain words.** "Try it instead of your bed", not "Swap entity". Sizes in cm, prices with the
  shop's currency.
- **Direct manipulation.** Drag in 3D or on the plan; click shows a tiny bar (turn, replace, remove). No forms
  for positions.
- **Safe experiments.** Trying a product or a layout opens a version ("idea"); the real room is never changed
  behind their back. Layout previews reuse one version so they don't pile up.
- **Red means it doesn't fit.** Overlaps, sticking out, blocking windows and doors are shown, not hidden.

Keep any change you make within these rules.
