# House: Mirrorly

Mirrorly is a journal and workspace where an AI character (Mirrorly, "the bot") reads along, remembers, speaks
first, keeps messages for your future self, and helps you reflect. URL: **trymirrorly.online**. The films are for
consumers and for X/LinkedIn, and they should be immersive and classy, with Mirrorly doing the UX.

## The look

- Black, white and greys only. Colour appears only when it means something: the five pastel goal colours in
  Goals were the only colour ever used.
- Type: **Manrope** (600/700) is what *you* write. **Geist** (500/600) is what Mirrorly and the app write. Both are
  embedded in `fonts.css` as base64 woff2, so the film opens from a file.
- Pages are white with a 3 px ink outline and round corners. Chips are outlined pills. Buttons are black pills.
  The calendar is Monday-first, with today's number in a black pill and days with notes dashed.
- Mirrorly: a black breathing blob with two white eyes. Its idle eyes are wide slits ([5.8, 2.2]), matching the
  logo. The logo is a horizon line with a striped reflection under it and the face on top.

## The product's truth (read before writing a beat)

| What | Where |
|---|---|
| Face, eyes, moods, glasses (rise from below the chin, clipped to the face), lighting | `src/components/MirrorFace.tsx` |
| How it roams, leaves the header, lands on the page | `src/components/editor/mirrorRoam.ts`, `src/components/editor/MirrorPresence.tsx` |
| Springs and motion maths the app uses | `src/lib/mirrorMotion.ts` |
| Message future me, capsules, realizations | `src/components/moments/` (`Capsules.tsx`, `CapsuleAnimation.tsx`, `CapsuleRecorder.tsx`, `Realizations.tsx`) |
| Video and voice recorder, transcripts | `src/components/Recorder.tsx`, `src/components/AudioRecorder.tsx`, `src/components/editor/RecorderNode.tsx`, `convex/recordings.ts` |
| Goals: shapes per period, the orbit | `shared/goals.ts`, `src/components/goals/GoalOrbit.tsx` |

**Its real repertoire:** breathing; the speech-bubble morph (a superellipse with its tail at the lower left; in the
app it is a hover cue); leaps that stretch along the path; satellites in orbit; spilling as ink across a pane;
turned eyes; reading glasses; emotes (nod, wink, shake, lean, yawn, proud, celebrate, a splat when thrown);
double press = it flies home; its dark chat room (only its eyes).

**Strings earlier films used** (check them in the code before reusing, since the app changes): *Dear future me,* ·
*Seal for my future self* · *Arrives on the morning of …* · *From past you* · *Open my capsule* · *Kept.* ·
*Something to keep?* · *Keep this realization* · *Things I've realized* · *Been here before* · *Start recording* ·
*Stop & save* · *Transcript*.

## The user's feedback, in order (each became a rule in SKILL.md)

- **Sep 30, the trailer and Drops in:** liked the camera variety, the extreme close-ups on the face, the mature
  monochrome vibe and the same fonts. "Make each film unique… thinking out of the box."
- **Oct 5, Future me v1:** "too many things happening… didn't like the tilted editor stuff… not this many editor
  texts… liked the movement… more fluid… a different kind of metaphor." Then asked for 10 variations, then "creative
  things, visually appealing with camera motions", then "pick the best and do" → Freefall.
- **Oct 5, On the day:** "I don't like the overall video. I want a simpler video. Don't use flat elements and a
  flat point of view for the camera." Wanted original dynamics, great cinematography, emotion, and an original
  outro → Why you started.
- **Oct 5, Why you started:** wanted the film centred on the bot's motions, morphs and movement, "as creative as
  possible", then "something more original" (two rounds of 10 ideas).
- **Oct 5, The dots v1:** loved the idea and the texts; disliked **tilted views**, **text appearing and leaving too
  fast**, and **childish motion**; asked for **nothing reused** from earlier films, a **different ending**, and
  **Mirrorly reminding first** ("You weren't ready last time either.").
- **Oct 7, idea brainstorms:** wanted a cohesive set without repeating messages; preferred Mirrorly making the case
  itself to comparison shots; asked for a critical assessment of the first ideas; "Mirrorly is the place to think
  and reflect" (not just two minutes); "remove the 2 minutes thing".
- **Oct 7, How far:** "let me approve the scenario before generating"; "think about how the messages will be
  perceived from the user's perspective, and optimise for it".
- **Oct 5–6, Goals:** steered step by step: no creation UI, liquid colour setting into solid shapes, pastel with
  no glare, shorter, labels that stay with their goals, an end line about goals rather than the name.

## Ledger: films already made (a new film differs on device, camera, ending and end line)

| Folder | Length / voice | Idea (device) | Camera | Ending / end line |
|---|---|---|---|---|
| `mirrorly-intro` | 28.5 s (and a `-nolan` variant) | First intro: Mirrorly on its mirror line | flat, mirror line and striped reflection | wordmark |
| `mirrorly-trailer` | 54 s, Garrett VO | Problem → pattern → "I'm Mirrorly. I help you see it."; weeks pile up and press flat | flat, mirror line, extreme close-ups | *Reflect. Understand. Improve.*, wink |
| `mirrorly-multiplayer` | 43 s, no VO | Multiplayer editing teaser, two typed lines | mirror-line stage | — |
| `mirrorly-together` | 66 s | Collaboration | — | — |
| `mirrorly-stranger` | 57 s, Garrett VO | Night: asking a stranger AI; ~70 windows get the same list; the light comes on, the chat sinks, your past pages rise | flat plus a dutch tilt (now banned) | *Don't ask a stranger. Ask Mirrorly.* |
| `mirrorly-drops-in` | 43 s, no VO (the no-VO reference) | It reads along from the page's top edge and drops in to ask; text mirrored in its eyes; a dive through its eyes | flat, whip-pans, a perspective corridor of pages | typed "Mirrorly", bot as the dot on the i; *It drops in while you write.* |
| `mirrorly-future-me` | 57 s, no VO, **rejected** | Letter → capsule → road of days | 3D floor, low angles (tilted) | wordmark, dot on the i |
| `mirrorly-from-you` | 43 s, no VO | **Freefall: deeper is later.** Wax seal with its face; falls through a spiral of date cards; three slow-motion realizations | straight-down 3D | wordmark, dot on the i; *From you, to you.* |
| `mirrorly-on-the-day` | 48 s, no VO, **rejected** | Three letters (a week, a month, a year) carried along a spiral road | low 3D flight, crane-overs | god's-eye spiral, wordmark |
| `mirrorly-why-you-started` | 60 s, no VO | A founder's letter kept six months; the months go by; Mirrorly reads it back against the notes | upright planes at depth, translate-only lens, fog and DOF | anamorphic glyphs → wordmark; *Mirrorly remembers why you started.* / "See you in six months." |
| `mirrorly-the-dots` (v1 in `v1/`) | 67 s, no VO | **You can only connect the dots looking back**: looking back is zooming out; recorder → transcript → "You weren't ready last time either." | flat pan/zoom, calendar → 4-year wall of dots | the drawn line becomes the logo's horizon; *You keep the dots. Mirrorly connects them.* |
| `mirrorly-who-is-it-for` (`mirrorly-dont-wait.mp4`) | 105 s, no VO | **A chat waits; Mirrorly doesn't.** A generic chat → the bubble grows into its dark room → February's notes, voice and video → it speaks first → a message to April | flat, one continuous flight over a calendar year | the chat waits empty → wordmark, dot on the i; *Don't wait for the question.* |
| `mirrorly-goals` | 23 s, no VO | Pastel colours fill the screen, Mirrorly drops in, wants set into solid goal shapes orbiting it | flat, slow push | goals orbiting above *Set your goals. Mirrorly helps you remember them and stay on track.* |
| `mirrorly-feeling` | 76 s | Mirrorly feels what you write (reactions) | — | — |
| `svg-article/intro` | 22 s, no VO, dark palette | "A video is just a program": code on a canvas, render bar → play | flat | builder audience (X article) |
| `mirrorly-how-far` | scenario only | One year learning to swim at 34, recorded in three forms; a sealed letter answered with the record | — | the year in its eyes (proposed) |

Short clips: `mirrorly-meets-itself` (14.5 s), `mirrorly-chat` (14.7 s), `mirrorly-unseen` (6 s), `mirrorly-loader`.

## Bank: ideas already pitched but not built (the user has seen these)

Receipts (it shows its work) · One minute / 0.14% at every scale · "Fine. One word." (negotiating with excuses) ·
A sentence is a door · I could keep you here · Tonight's question (series) · Worst notifications ever · Hire in a
sentence (agents) · Catch me up (teams over time) · The room with one lamp (privacy) · Made in a prompt (builder
story) · Flight recorder · Task card (an STE manual page) · Redacted · Autocomplete · Overprint · Ink · It mails
itself · Satellites · Sleep · A hundred Mirrorlies · The line · Shadow play · In its eyes · Swallowed · Backwards ·
Your reflection, six months late · Flipbook · Made of your words · Murmuration · The stamp · Origami · Long
exposure · Both sides · Outside your window · Powers of ten · One take through the months · Through the mirror ·
Into its eyes · The rolling date · It keeps it inside · The essence · The dial · Night sky · The desk drawer ·
Now | Next year · The time post.

When you make a new film, add a row to the ledger. When you pitch new ideas, add their names to the bank.
