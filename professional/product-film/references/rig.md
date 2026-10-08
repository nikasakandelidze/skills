# The rig: how a film is built in code

## Files

| File | What it is |
|---|---|
| `timeline.js` | The clock. Every beat in seconds, worked out from the words (`dur()` for typing, `holdFor()` for reading), so changing a line retimes everything after it. Also `TEXT`, the character's lines, `BLINKS`, and the voice takes. Read by the picture and the sound. |
| `lib.js` | Shared maths (easings, springs, one seeded rng), the camera (`zoomPath`, `camera(shots)`, `viewMatrix`), the character's body (`blobPoints`, `closedPath`), type (`typed`, `typedSaid`, `typer`, `wordRow`, `fadeWords`, `measure`), and the `fits` queue. |
| `film.js` | The picture: build once → `simulate()` once at 240 Hz → `render(frame)`. Exposes `window.seek`, `FILM`, `FILM_READY`, `FILM.events` and `CHECK()`. Big films split it up (`world.js`, `speech.js`, `bot.js`, `shapes.js`). |
| `scene.html` | One SVG with `#world` (moves with the camera) and `#over` (screen space). Opened directly, it plays and scrubs (space pauses, `?t=12` starts at 12 s); with `#render` it is driven frame by frame. |
| `render.mjs` | Headless Chrome over CDP: `video`, `still <dir> <s>…`, `events`, `eval "<js>"`. Pipes PNGs into ffmpeg (libx264 slow, crf 16, BT.709). |
| `audio/score.mjs` | The sound from arithmetic plus `events.json`; lays in voice takes; writes stems and `mix.wav`. |
| `audio/voice.mjs` | Finds the voiced spans and phrases in `audio/vo/*.wav`. |
| `make.sh` | events → score → video → two-pass loudnorm mux. `./make.sh sound` redoes only the sound. |
| `sheet.sh` | A contact sheet of stills via ffmpeg `tile` (there is no ImageMagick here). |
| `PROMPT.md` | The treatment: idea, rules, world, beats, words, the product truth, sound, files. |

## Starting

- **Starter:** `sh <this skill's folder>/scripts/new-film.sh <films>/<product>-<slug>` gives a 14 s film that
  builds as is (about 70 s for `./make.sh`). Rewrite its world and keep the shape of each file.
- **Fork:** when an earlier film in the ledger already has the grammar you need (upright depth planes, a calendar,
  a chat window, a speech-bubble morph), copy its folder (`cp -R <films>/<film> <films>/<new>`), delete its
  renders, and rewrite `timeline.js` and `film.js`. Note in `FILMS.md` which film has which rig.
- Other Claude sessions may be editing the repo at the same time. Build only inside your own film folder, and
  render headless, never through a dev server.

## The clock (`timeline.js`)

- Derive everything: `T.typed = T.type + dur(line)`, `T.next = T.typed + holdFor(nw(line))`. Never hand-type a
  time that depends on a line's length.
- For speech, use `card(lines, t)` (in the starter's `timeline.js` tools): it gives when each line starts, when
  it is all in (`done`), and when it may go (`out = done + holdFor`). Wrap it in a session when the character has
  a ritual for speaking: glide to its place → bubble opens → card → bubble closes.
- With a voice, each take's measured length sets its beat's length (`spoken(k)` in the starter), and `VOICE` lists
  the cuts (`file`, `from`, `to`, `at`, `type` parts) for the score and the picture.

## The picture (`film.js`)

- **Build once.** Create every node at load time. In `render`, only set attributes. No DOM queries per frame, and
  no layout reads except text measured once.
- **Fonts first.** `FILM_READY` waits for `document.fonts.load` of every face, then runs `fits` (all text
  measurement), then `simulate()`. Text measures 0 while it or a parent is `display:none`, so measure in the
  `meter` group, never in a hidden plane.
- **Simulate once at 240 Hz** for anything with memory (gaze springs, a nod, satellites), and keep one state per
  frame. Everything else is a direct function of `t`.
- **Pure render.** `render(f)` reads only `f / FPS` and `film[f]`. Any frame renders the same on its own.
- **Events for the sound.** `collectEvents()` returns the times of every key press, word, glide, landing, blink,
  press and title. `node render.mjs events` writes them to `audio/events.json`.
- **Checks in code.** `window.CHECK()` (timing holds) and a `DIAG()` (positions, e.g. where words the character
  leaves on a page land against where they were shown; the largest camera move per flight). Run them with
  `node render.mjs eval`.

## The character rig (adapt it to the product's own character)

- Body: nine points on a circle, each breathing on two sines with its own seeded phase, drawn as a closed
  Catmull-Rom curve. Black ink; lit from the upper left (#3a3a3a → #050505) when it needs volume.
- Eyes: rounded rects. Mood is their shape (tall pills = idle, squeezed = happy, narrowed = writing); match the
  product's own idle eyes or logo when it has them. Blink by height; gaze by offset.
- Speech: a bubble morph (a superellipse with a tail). Its words can stay on the page as its note when it draws
  back.
- In close-ups, swell the body once its edge leaves the frame, so the frame stays solid black around the eyes.

## Gotchas (each one cost a render)

- A timing field and a DOM node with the same name: the node gets into `FILM` and CDP fails with a serialisation
  error, and timings go NaN. `render.mjs` names the failing expression.
- Neighbouring xorshift seeds give the same first value. Seed one stream and draw from it.
- Springs on cameras lag fast targets (see craft.md). Use exact keyframes.
- `mask` on SVG text can silently fail in headless Chrome. Use `clipPath`.
- Greys and soft edges in a contact sheet may be scaling artefacts. Check the frame at full size before fixing.
- The Browser pane throttles animation frames when hidden, so judge timing from rendered frames or a headless
  run, not the pane.
- Low-angle text on a 3D floor reads as italics. Long lenses only hide it a little; don't do it.
- Text that hits the frame edge on a phone: check 9:16 cuts separately.
- Long renders: 60 fps × 60 s = 3,600 frames, about 3–8 minutes. Run `./make.sh` with `run_in_background` and keep
  checking other things meanwhile.
