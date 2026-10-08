# Craft: camera, motion, text, composition

## Camera grammars (pick one per film, ideally one the ledger hasn't used recently)

**A. Flat: pan and zoom only.** The world is one `<g>` with a matrix; titles sit in a screen-space group on top.
Moves between views use the smooth zoom path (`zoomPath` in the starter's `lib.js`, van Wijk–Nuij, the same as
`d3.interpolateZoom`): it rises in scale and comes back down so the centre moves at a steady screen speed, which
is what makes long flights feel fluid. Hard cuts are a shot with `cut: true`. Nothing can tilt.
*Good for:* flights over a calendar or a map of pages, one continuous take through the product's world.

**B. Upright planes at depth, with a lens that only translates.** Every element stands upright, facing the lens, at
its own depth z (deeper = later). The lens moves in x, y and z only:
`scale = f / (z − camZ)`, `screen = centre + (p − cam) · scale`. Depth reads from parallax, from fog to white past
~5000 px, and from CSS blur for depth of field. Camera z follows an exact monotone-cubic curve through knots.
*Good for:* time passing (months standing alternately left and right as the lens glides past), a message
travelling forward.

**C. Straight-down 3D** (`matrix3d` planes in one `preserve-3d` context, camera looking straight down). Text lying
on the floor stays flat only while the view is straight down. The user rejected every oblique or low view of text.
*Good for:* falling through layers (a year of days below today's page). Avoid low hero shots over pages: every
cut with them was rejected.

**D. Eye and lens transitions** (combine with any grammar):
- pull straight out of the character's eyes onto the page;
- the character jumps at the lens until the frame is black, then a hard cut;
- dive through its eyes: a black full-frame shape with two eye-shaped holes (even-odd fill) over a zoom;
- words reflected in its eyes: a `<use>` of the page, flipped with `scale(-s, s)`, clipped to the eye.

**Camera rules**
- Let the camera carry the energy: whip-pans (horizontal Gaussian blur only during the whip), cranes, long glides.
- Use exact keyframes, not springs, for the camera. A spring tracking a fast target lags by about velocity/ω
  (thousands of pixels mid-flight). If something must follow a moving target, lock to it with a smoothstep
  blend-in. Crane-overs to a reading need the stiff keyframe held until the reading starts.
- When the camera is far out, draw the character bigger than true scale (`mapScale`) so it still reads.
- Slow pushes during a reading hold are fine. Fast moves wait until the text has been read.

## Motion

- The character glides along long eased paths (`smoother`), with a gentle arc rather than a hop. It breathes
  (the blob's nine points wobble on two sines), blinks (a quick close, a slower open), and looks: gaze is a small
  spring towards the caret, the words, or the lens.
- It changes shape once or twice a film, on purpose: its body growing into a speech bubble, reading glasses
  rising into place, the bubble growing into a full-screen room.
- The opening and the ending deserve the most care: an extreme close-up, a pull-out, a reveal.
- One idea per beat, and one caret on screen at a time.

## Text

- What the person writes is typed by hand, with a breath at commas and full stops. The caret is solid while
  typing and blinks only when typing rests.
- What the character says, and transcripts, come up word by word (`wordRow` + `fadeWords`). Subtitles on video.
- Lines that reveal (an underline, a strike, a line drawing on) grow with a `clipPath`. SVG masks on text fail
  silently in headless Chrome.
- Holds: `holdFor(words)` = 0.8 + 0.1 × words, clamped to 1.3–1.9 s after a line completes. A note that passes the
  lens must ride beside it for about 2.8 s.
- When the character leaves words on the page (it speaks in a bubble, then draws back), they should land exactly
  where they were shown, to the pixel. Check with a `DIAG()` that reports the positions.

## Composition

- Use one design language for every page and card: the same width and x for blocks, the same sizes for typed
  text and for the product's text, outlined pills for chips, black pills for buttons.
- Keep the character one size and in one place whenever it speaks; its bubble opens to one side.
- Keep a safe margin (96 px) for type in screen space, and leave generous white.
- Monochrome by default. When colour comes in, it must mean something (only the feature's own objects).

## Endings (each film needs a new one)

Check the ledger for the endings already used. Endings that have worked: the typed wordmark with the character
landing as the dot on the i (the obvious one; use it at most once); the line the character drew turning into the
logo; scattered glyph pieces that line up into the wordmark only from one point of view; the opening shot
returning, changed; the character's eyes closing to black; the whole story reflected in its eyes.
Look for an ending that completes this film's own device: the rule of the world, played one last time.

## Social cuts

1080×1920, 15–20 s. The hook is already moving in frame 1, never a black frame. Large text that reads on a phone,
every complete line on screen for at least 2 s, ideally a loop (the last frame cuts cleanly to the first). Re-frame
the shots rather than letterboxing the 16:9 film.
