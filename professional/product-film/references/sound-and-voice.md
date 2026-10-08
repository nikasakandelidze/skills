# Sound and voice

## The score (always)

The music and sound effects come from arithmetic in `audio/score.mjs`: no samples, no stock music. Because the
score reads the same clock and the picture's own event list, it can't drift from the picture.

- **Instruments** (in the starter): `key` (a felt piano: decaying partials, two strings a hair apart), `pad` (three
  detuned voices per note, slow breathing), `air` (noise through a sliding band: glides, whooshes, page turns),
  `tick` (a key press), `thump` (a landing), `bell` (a small glass bell), `room` (Freeverb). Earlier films add
  `drop` (a note that bends up, like a drop into water), `swell` (a swell too low to be a note), `click` (a
  pointer's button) and `pencil` (a pencil on paper).
- **Write a cue sheet, one cue per beat**, as a `chords` table of `[from, to, notes, amp, how]` with a comment on
  each saying what it means ("you ask: cold, thin", "it speaks first: a lift", "the name: home"). Then add events:
  a tick per key press, a soft note per word the character says, air on glides and flights, a bell when it speaks
  first and on the end line, a roll on the title.
- **Use contrast.** The strongest moments in the earlier films were drops: no pad at all under the turn of the
  argument, one held note, then the wide chord.
- **Levels** (as in the starter): music about −22 dB RMS (−23.5 with a voice), effects peak −12 dB, the mix
  soft-clipped with `tanh`, a 0.9 s fade out. `make.sh` masters to −15 LUFS integrated with true peak under
  −1.5 dB (two-pass loudnorm, linear).
- **Check it with numbers.** `score.mjs` prints loudness every 2 s; the shape should dip under reading and lift at
  the turns. For a picture of the sound: `ffmpeg -i film.mp4 -lavfi showspectrumpic=s=1600x400 spec.png`. You can't
  hear it, so tell the user what to listen for (the balance of typing against whooshes, the voice against music).

## The voice-over (optional)

**When.** The default is no voice: the typed text carries the film and it works muted, which suits most
showcases. Use a voice when the film argues or explains in sentences (a trailer that names a problem, a manifesto),
or when the user asks. If unsure, say what each choice gives and ask: a calm voice makes "the character
talking to you" land; typed-only keeps pauses pure and works in feeds.

**Script first.** Write a table of `# | line | feeling`, one feeling per line (contemplative, calm, sad, anxious,
disappointed, frustrated, serious, confident, affectionate, curious, enthusiastic), and get it approved before
recording. On screen, **typed = said**: what is typed is what the voice is saying, as it says it.

**Voice.** Cartesia `sonic-3.5` with a warm stock voice works well; **Garrett**
(`c58bda25-abd5-4c72-97a2-4dbe049b368d`, US English, warm and bright) is a good default, and Corey, Tanner, Kira
and Nolan are worth auditioning. Record the same two lines in 3–4 voices into `audio/audition/` and let the user
choose; note the choice in `FILMS.md`. Use stock voices only; never clone or imitate a real person.

**Recording, with the Cartesia MCP** (load the tools via ToolSearch: `select:mcp__cartesia__text_to_speech,mcp__cartesia__list_voices`):

```
text_to_speech {
  transcript: "I'm Notelee. I was there when you wrote it.",   // "Notely", spelled for the ear
  voice_id: "c58bda25-abd5-4c72-97a2-4dbe049b368d",
  output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 48000 },
  emotion: "calm", language: "en"            // speed 0.6–1.5 exists but is a weak lever (~14%); use pauses instead
}
→ { file_id, download_url, file_path }        // file_path is on the MCP host, not this machine
curl -sSL -o audio/vo/02-say.wav "<download_url>"
```

- **Spell the product's name for the ear.** Coined names are often misread (a name ending in "-ly" can come out
  as another word, and a hyphen adds a catch), so use a phonetic spelling ("Notelee" for "Notely"). Listen to a
  test take of the name first, or make a pronunciation dictionary, and keep the spelling that works in
  `FILMS.md`.
- **One take per beat** (`NN-name.wav`), so a take's length is its beat's length and re-recording one line touches
  one file. Keep alternatives in subfolders (`vo/v1/`, `vo/<voice>-v2/`) rather than overwriting.
- Takes come back as 48 kHz 16-bit mono, which is what `score.mjs` reads. Convert anything else with
  `ffmpeg -i in -ar 48000 -c:a pcm_s16le out.wav`.

**Timing the picture to the voice.** Run `node audio/voice.mjs`. It finds each take's voiced span and its phrases
from the sound's energy, splitting at pauses over 0.16 s, and prints a ready entry. Put it in `TAKES` in
`timeline.js` with `phrases` and the matching `parts` of text. The take's length then sets the beat's length;
typed text (`typedSaid`) and spoken words (`saidWords`) follow each phrase as it is heard. Tested: a two-phrase
take ("I'm <name>." | "I was there when you wrote it.") split exactly at its pause.

The Cartesia `speech_to_text` tool failed on every call in October 2026 (`argument after ** must be a mapping`),
and the energy method doesn't need it. If word-level timing is ever needed and speech-to-text works, ask for word
timestamps (`timestamp_granularities: ["word"]`) and match each typed part's words against them in order.

**The mix with a voice** (in the starter's `score.mjs`): each take is cut at `from..to` with 20 ms fades and
normalised so every line has the same strength, whatever feeling it was spoken with (−15 dB RMS over its voiced
samples). A high-pass at 75 Hz, a light room (0.12), and soft-clipped peaks. **The music ducks −9.5 dB while it
speaks** (90 ms down, 450 ms back up). The voice stem is written to `audio/stems/voice.wav`.
