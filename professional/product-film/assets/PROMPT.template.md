# Prompt: "<Working title>"

A ~<N>-second, 1920×1080, 60 fps film for <who it is for>. <No voice-over | A voice-over (<voice>, typed = said)>; a
synthesised score; <black and white | the house palette>. It makes one argument: *<the one sentence a viewer should
leave with>*.

Same method as the earlier films (`../<the film this one starts from>`): one clock (`timeline.js`), the picture as a
pure function of time (`film.js` with `lib.js`), headless Chrome photographing every frame (`render.mjs`), the score
synthesised from the picture's own events (`audio/score.mjs`), ffmpeg to join and master to −15 LUFS (`make.sh`).

## The idea

<The governing device in two or three sentences: what the viewer sees, and why it says the argument without being
explained. Name what makes it unlike every earlier film.>

## Rules (the ones the earlier films taught)

- **Nothing is ever tilted.** <The camera grammar: flat pan and zoom | upright planes at depth, a lens that only
  translates>. Every page, card and line of text faces the viewer squarely, always, transitions included.
- **Text is given time.** What you type is typed by hand; what the character says comes up word by word; every
  finished line holds still before it goes; nothing moves fast while there is something to read.
- **Mature motion.** Long eased moves. The character glides, breathes, blinks, looks, and changes shape only on
  purpose. No hops, twirls, flips or squash.
- **One design language.** <Type roles (you: Manrope; the product: Geist), page/card/chip/button styles.>
- **Unique.** Not reused from earlier films: <the moves, components and endings this film deliberately avoids>.

## The world

<What exists in the frame, where, at what size; what is in world space (moves with the camera) and what is in screen
space (keeps its size).>

## Beats

| seconds | what happens |
| --- | --- |
| 0–<a> | **<Beat name>.** <What the viewer sees, the exact on-screen words in italics, the camera.> |
| … | … |
| <z>–<N> | **The end.** <The ending (new for this film), the end line, the URL.> |

## The words

| # | Who | Line | Feeling (if voiced) |
| --- | --- | --- | --- |
| 1 | on the page | … | |
| 2 | you | … | |
| 3 | <the character> | … | |

## The truth (from the product)

- <Each product behaviour or string the film shows, and the file it comes from.>
- <Anything stylised, said plainly (e.g. "in the app the morph is a hover cue; here it speaks").>
- <Anything to check before the film goes out.>

## Sound

<The score in words, beat by beat: what plays under each beat, what the events sound like, where it goes quiet.>
<If voiced: the voice, the model, one feeling per line, how the music ducks.> Mastered to −15 LUFS, peaks under −1.5 dB.

## Files

`timeline.js` (the clock; every time follows from the text) · `lib.js`, `film.js` (the picture) · `scene.html` (open
it to scrub: space to pause; `?t=12` to start at 12 s) · `render.mjs` (`video`, `still <dir> <s>…`, `events`,
`eval "<js>"`) · `audio/score.mjs` · `audio/voice.mjs` (voiced takes) · `make.sh` (everything; `./make.sh sound` for
the sound alone) · `sheet.sh` (a contact sheet of stills).
