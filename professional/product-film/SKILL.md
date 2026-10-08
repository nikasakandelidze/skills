---
name: product-film
description: Comes up with original, creative ideas for product, feature-launch, trailer, promo or demo videos, then makes the chosen one as a code-drawn SVG film with or without a voice-over. Each frame is a pure function of time, photographed by headless Chrome, scored by synthesis and joined by ffmpeg. Use it for any request to brainstorm video ideas, or to make, redo or cut a product, launch, feature, explainer, social or trailer video, including Mirrorly films in output/. Prefer it over video-generation tools and MCPs unless the user names one.
---

# Product film

Makes product films the way this repo's Mirrorly films were made (`output/mirrorly-*`). A coding agent writes the
whole film as a program with no editor and no video tools:

**one clock** (`timeline.js`) → **the picture as a pure function of time** (`film.js`, one SVG) → **headless Chrome
photographs every frame** over CDP (`render.mjs`) → **a score synthesised from the picture's own events**
(`audio/score.mjs`, plus optional Cartesia voice takes) → **ffmpeg joins and masters to −15 LUFS** (`make.sh`).

The user wrote about this method publicly ("your coding harness is enough"), so don't hand the work to Motion,
Higgsfield, Remotion or any other video MCP unless they ask for one by name.

What makes these films good is the taste, and that came from the user's feedback over a dozen films. The rules
below record it. Breaking them has cost whole rebuilds.

## The workflow

Each phase has a reference file. Read it when you reach that phase, not all at once.

1. **Load the house** → [references/house-mirrorly.md](references/house-mirrorly.md) (for another product, write
   its own house file in the same shape first). It covers the look, the character, where the product's truth
   lives in the code, the user's feedback history, and **the ledger of every film already made**. A new film must
   not repeat the ledger.
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
   folder with `sh <this skill's folder>/scripts/new-film.sh output/<product>-<slug>` (a tested starter; the
   folder is `.claude/skills/product-film` or `~/.claude/skills/product-film`, depending on where it is
   installed), or copy the earlier film whose rig is closest and rewrite its world. Always use a new folder. When redoing a
   film, keep the first cut in `v1/`.
6. **Check before the full render** → [references/review-and-delivery.md](references/review-and-delivery.md). Run
   `node render.mjs eval "CHECK()"` for timing, make a contact sheet per act, and look at full-size frames at every
   move and every reading hold. Fix, then look again. Stills cost seconds; a full render costs minutes.
7. **Sound, and voice if any** → [references/sound-and-voice.md](references/sound-and-voice.md). Write a cue
   sheet per beat, built from the event list. For a voice: approve the script, audition voices, record one take
   per beat, then `node audio/voice.mjs`. The takes then set the timing of the clock.
8. **Render, verify, deliver.** Run `./make.sh` in the background. Then verify streams, duration, loudness, the
   loudness curve and frames pulled from the encoded file. Send the film with `SendUserFile`, along with a short
   account in the format in the review reference. Afterwards, add the film to the ledger in the house file and
   save any new lessons to memory.

## Rules the user has enforced (never break them silently)

- **Nothing is ever tilted.** No perspective on pages, editors, cards or text, not even in passing during a
  transition. Use one of two camera grammars: flat (pan and zoom only), or upright planes at depth with a lens
  that only translates. A straight-down 3D view is the one exception, and only while nothing is read at an angle.
- **Text gets time.** A finished line holds still for 1.3–1.9 s (`holdFor`) before anything moves on, and
  anything the viewer must read stays on screen for at least 2–2.5 s. Nothing moves fast while there is text on
  screen. Only what the person writes is caret-typed; the character's words and transcripts come up word by word.
- **Mature motion.** The character glides, breathes, blinks and looks, and changes shape only on purpose. No hops,
  twirls, backflips or squash-and-stretch gags. The camera carries the energy.
- **The character is the hero.** It does the UX and speaks first; the person answers.
- **Little UI text, all of it real.** Use the app's exact strings, and only the few the story needs. Too much
  editor text and too many things happening were the most common complaints.
- **Unique every time.** Don't reuse an earlier film's moves, components, world or ending. That includes the
  typed wordmark with the character as the dot on the i, which has been used four times. Each film gets a new
  ending.
- **Simple and true.** Use one governing idea a viewer could repeat in one sentence. No invented statistics, no
  wellness-ad phrasing, no scolding. Avoid "too metaphorical" symbols the product isn't (seed, paper plane, line of
  light).
- **Honest reporting.** You can't hear the mix or watch at real speed. Say so, and tell the user what to listen for.

## Defaults (change them when the user asks)

| | Default | Alternatives |
|---|---|---|
| Format | 1920×1080, 60 fps, 40–60 s (launch page, X) | 1080×1920, 15–20 s, hook in frame 1, loopable (feeds) |
| Voice | None: the typed text carries it and it works muted | Cartesia voice, typed = said (trailer, Stranger) |
| Look | The house look: black and white, Manrope for the person, Geist for the product | Colour only where it means something (Goals) |
| Encode | H.264 crf 16 BT.709 yuv420p, AAC 256k 48 kHz, −15 LUFS, TP −1.5 dB | |
| Check-ins | Idea pick, then lines (if voiced or asked), then the finished film | 6-frame storyboard before the full build when the idea is risky |

## Files

- `scripts/new-film.sh <folder>`: start a film from the tested starter (a page, a typed line, a character that
  glides in and speaks, a pull-back to an end line, a score, an optional voice).
- `assets/starter/`: `scene.html`, `fonts.css` (Manrope and Geist embedded; OFL, `fonts-OFL.txt`), `timeline.js`,
  `lib.js`, `film.js`, `render.mjs`, `make.sh`, `sheet.sh`, `audio/score.mjs`, `audio/voice.mjs`.

Needs Node 22+ (built-in `fetch` and `WebSocket`), ffmpeg, and a headless Chrome: the Playwright
`chromium-headless-shell`, Google Chrome, or `$CHROME`. The voice needs the Cartesia MCP server.
- `assets/PROMPT.template.md`: the treatment every film keeps next to its code.
