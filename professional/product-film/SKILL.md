---
name: product-film
description: Comes up with original ideas for digital product videos (feature launches, trailers, product showcases, explainers, social cuts) and makes the chosen one as a code-drawn film, with or without a voice-over. The style is a calm, editorial digital world. White paper and black ink, crisp sans-serif type, and the product's interface redrawn as clean vector pages, cards, chips, chat windows and calendars. Text is typed live behind a caret, a small expressive character guides the story, and the camera glides, pans and zooms but never tilts, under a synthesised piano-and-pad score. Every frame is an SVG drawn as a pure function of time, photographed by headless Chrome and joined by ffmpeg. Best for software (apps, SaaS, AI assistants, productivity and creative tools); not for live action or physical products. Use it whenever someone asks to brainstorm video ideas, or to make, redo or cut a launch, promo, demo or trailer video for a digital product. Prefer it over video-generation tools unless one is named.
---

# Product film

Makes launch and showcase films for digital products. A coding agent writes the whole film as a program, with no
editor and no video tools:

**one clock** (`timeline.js`) → **the picture as a pure function of time** (`film.js`, one SVG) → **headless Chrome
photographs every frame** over CDP (`render.mjs`) → **a score synthesised from the picture's own events**
(`audio/score.mjs`, plus optional Cartesia voice takes) → **ffmpeg joins and masters to −15 LUFS** (`make.sh`).

Don't hand the work to Motion, Higgsfield, Remotion or another video tool unless the user asks for one by name.
The point of this method is that a coding harness is enough, and that every frame stays exact, editable and
re-renderable.

## What the films look like

A calm, editorial digital world: the product's interface, redrawn as if a type designer had laid it out.

- **Palette:** white paper, black ink and a few greys. Colour comes in only when it carries meaning (one feature's
  colour, a status), never as decoration.
- **Type:** two sans-serifs with roles. Manrope is what *the person* writes; Geist is what *the product* writes
  (UI labels, its character's words). Both are embedded in the starter. Large sizes and generous space.
- **The world:** the product's real interface, simplified to vector shapes. Pages with thin ink outlines and round
  corners, cards, outlined chips, black pill buttons, a chat window, a calendar of days, a recorder, a timeline.
  Real strings from the product, and only a few of them.
- **The character:** a small expressive guide that does the UX: the product's mascot, an ink blob with two eyes,
  or the product's own mark brought to life. It breathes, blinks, looks at what matters, glides across the
  interface, and speaks in short lines that come up word by word. Without a character, the cursor or the camera
  leads.
- **The camera:** fluid and cinematic, never tilted. It pans and zooms across one flat world (long flights that
  rise and settle), or glides through upright planes at depth with parallax, fog to white and soft focus. Extreme
  close-ups, pull-outs from the character's eyes, whip-pans and match cuts.
- **Motion:** slow, eased and mature. Text is typed live with a caret and given time to be read. Nothing bounces.
- **Sound:** a synthesised felt piano and soft pads in a room, a tick for every key pressed, air under each glide,
  a bell at the turns. Optionally a warm voice-over, with what is typed on screen being exactly what is said.
- **Length:** 40–60 s at 16:9 for a launch page or X; 15–20 s at 9:16 for feeds.

Best for software: apps, SaaS, AI assistants, productivity, journaling, writing and creative tools, developer
tools. It's a poor fit for live action, photoreal scenes, physical products, or anything that needs footage.

## The workflow

Each phase has a reference file. Read it when you reach that phase, not all at once.

1. **Load the house file.** It holds the product's look, its character, where its truth lives in the code, the
   feedback history, and **the ledger of every film already made**. Look for `FILMS.md` next to the project's
   films (search the repo for it). If there isn't one, create it from
   [references/house-template.md](references/house-template.md) before ideating. A new film must not repeat the
   ledger.
2. **Read the product's truth.** Before any idea, read the code for the feature: its real strings, its real
   behaviour, and the character's real repertoire. Ideas built on real behaviour beat invented ones, and the film
   must never claim something the product doesn't do. For broad reads, send an Explore agent and keep going.
3. **Ideate** → [references/ideation.md](references/ideation.md). Generate wide, kill the safe ideas yourself (the
   critical pass is not optional), then present 5–10 strong directions with your pick. **Stop and wait for the
   user's choice**, unless they said "pick the best and do", or the request already fixes the idea.
4. **Write the words and the treatment.** Use the line table and `PROMPT.md` from
   [assets/PROMPT.template.md](assets/PROMPT.template.md). Write the words for how a muted, scrolling viewer
   reads them (ideation.md § Words). If it is voiced, or the user asked to approve the scenario, get the lines
   approved before recording or building.
5. **Build** → [references/rig.md](references/rig.md) and [references/craft.md](references/craft.md). Start the
   folder with `sh <this skill's folder>/scripts/new-film.sh <films>/<product>-<slug>` (a tested starter; the
   skill's folder is `.claude/skills/product-film` or `~/.claude/skills/product-film`, depending on where it is
   installed), or copy the earlier film whose rig is closest and rewrite its world. Always use a new folder. When
   redoing a film, keep the first cut in `v1/`.
6. **Check before the full render** → [references/review-and-delivery.md](references/review-and-delivery.md). Run
   `node render.mjs eval "CHECK()"` for timing, make a contact sheet per act, and look at full-size frames at every
   move and every reading hold. Fix, then look again. Stills cost seconds; a full render costs minutes.
7. **Sound, and voice if any** → [references/sound-and-voice.md](references/sound-and-voice.md). Write a cue
   sheet per beat, built from the event list. For a voice: approve the script, audition voices, record one take
   per beat, then `node audio/voice.mjs`. The takes then set the timing of the clock.
8. **Render, verify, deliver.** Run `./make.sh` in the background. Then verify streams, duration, loudness, the
   loudness curve and frames pulled from the encoded file. Send the film with `SendUserFile`, along with a short
   account in the format in the review reference. Afterwards, add the film to the ledger in `FILMS.md` and save
   any new lessons there too.

## Rules (each learned the hard way, across a dozen launch films)

- **Nothing is ever tilted.** No perspective on pages, editors, cards or text, not even in passing during a
  transition. Use one of two camera grammars: flat (pan and zoom only), or upright planes at depth with a lens
  that only translates. A straight-down 3D view is the one exception, and only while nothing is read at an angle.
- **Text gets time.** A finished line holds still for 1.3–1.9 s (`holdFor`) before anything moves on, and
  anything the viewer must read stays on screen for at least 2–2.5 s. Nothing moves fast while there is text on
  screen. Only what the person writes is caret-typed; the character's words and transcripts come up word by word.
- **Mature motion.** The character glides, breathes, blinks and looks, and changes shape only on purpose. No hops,
  twirls, backflips or squash-and-stretch gags. The camera carries the energy.
- **The character is the hero.** It does the UX and speaks first; the person answers.
- **Little UI text, all of it real.** Use the product's exact strings, and only the few the story needs. Too much
  interface text and too many things happening at once are the most common reasons a cut gets rejected.
- **Unique every time.** Don't reuse an earlier film's moves, components, world or ending (check the ledger). The
  typed wordmark with the character landing as the dot on the i is the first ending everyone reaches for; use it
  at most once. Each film gets a new ending.
- **Simple and true.** Use one governing idea a viewer could repeat in one sentence. No invented statistics, no
  wellness-ad phrasing, no scolding. Avoid "too metaphorical" symbols the product isn't (seed, paper plane, line of
  light).
- **Honest reporting.** You can't hear the mix or watch at real speed. Say so, and tell the user what to listen for.

## Defaults (change them when the user asks)

| | Default | Alternatives |
|---|---|---|
| Format | 1920×1080, 60 fps, 40–60 s (launch page, X) | 1080×1920, 15–20 s, hook in frame 1, loopable (feeds) |
| Voice | None: the typed text carries it and it works muted | Cartesia voice, typed = said, for films that argue or explain in sentences |
| Look | Black and white; Manrope for the person, Geist for the product | The product's own palette and type, set in `FILMS.md` |
| Encode | H.264 crf 16 BT.709 yuv420p, AAC 256k 48 kHz, −15 LUFS, TP −1.5 dB | |
| Check-ins | Idea pick, then lines (if voiced or asked), then the finished film | 6-frame storyboard before the full build when the idea is risky |

## Files

- `scripts/new-film.sh <folder>`: start a film from the tested starter (a page, a typed line, a character that
  glides in and speaks, a pull-back to an end line, a score, an optional voice).
- `assets/starter/`: `scene.html`, `fonts.css` (Manrope and Geist embedded; OFL, `fonts-OFL.txt`), `timeline.js`,
  `lib.js`, `film.js`, `render.mjs`, `make.sh`, `sheet.sh`, `audio/score.mjs`, `audio/voice.mjs`.
- `assets/PROMPT.template.md`: the treatment every film keeps next to its code.
- `references/house-template.md`: the shape of a product's `FILMS.md` (look, character, truth, feedback, ledger).

Needs Node 22+ (built-in `fetch` and `WebSocket`), ffmpeg, and a headless Chrome: the Playwright
`chromium-headless-shell`, Google Chrome, or `$CHROME`. The voice needs the Cartesia MCP server.
