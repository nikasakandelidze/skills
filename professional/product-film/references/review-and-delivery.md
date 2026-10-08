# Review and delivery

## Before the full render (cheap: seconds per check)

1. `node render.mjs eval "CHECK()"`: every finished line holds 1.3–1.9 s before the next beat, and the end line is
   up for at least 2 s. Extend `CHECK` as the film grows (one entry per spoken or typed line).
2. A contact sheet per act: `./sheet.sh act1 4 0 12 0.5`, then read the PNG it prints. Look for text at an angle,
   crowded frames, things off the frame, a character that's too small to read, and empty beats.
3. Full-size frames at the moments that matter: `node render.mjs still /tmp/k 4.9 17.6 31.2`. Check the start,
   the middle of every camera move, every reading hold, every place where the character's words land, and the
   last frame. A grey in a sheet can be a scaling artefact, so confirm at full size before fixing.
4. Motion in the fast parts: sample a 1–2 s stretch at 10–20 stills per second and tile them as a strip.
5. Numbers instead of eyes where you can: a `DIAG()` for positions and alignments, and the largest camera move per
   flight.
6. If the idea is risky or the user wants to see the look first, send a 6-frame storyboard (a sheet) before
   building the rest.

## The full render

`./make.sh` with `run_in_background: true`. A 60 s film takes about 3–8 minutes (the progress log shows the frame
count every 300 frames). Keep working while it runs: write the treatment's final timings, draft the post copy,
update the ledger.

## After the render

- Streams and length: `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate:format=duration -of compact film.mp4`
- Loudness: `ffmpeg -i film.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary`. Expect about −15 LUFS
  integrated, true peak under −1.5 dB.
- The loudness curve printed by `score.mjs`, and a spectrogram if the sound matters.
- Frames pulled from the encoded file, not the stills: `ffmpeg -ss 31 -i film.mp4 -frames:v 1 f.png`.

## What you can't check, said plainly

You see frames and numbers. You can't watch at real speed or hear the mix. Every delivery should say: "I checked
the sound only by its loudness numbers; it needs your ears", plus the specific things to listen and watch for
(fast stretches, the typing against the music, the voice level).

## The delivery message

Send the film with `SendUserFile` (`display: "render"`), then write:

1. **One line:** the title, length, format, voice or not, loudness, and the path as a link.
2. **The idea** in one sentence.
3. **What happens:** 4–6 beats with times, quoting the on-screen words.
4. **True vs stylised:** which product behaviours are exact, and what was dramatised.
5. **Worth knowing:** at most three items (what to listen for, what you'd change, anything left unchecked).
6. **How to change it:** where the words and timings live, and `./make.sh` (with its build time) or
   `./make.sh sound`.

Offer one follow-up in a line, not a list: a 9:16 cut, a voice version, or post copy.

## After delivery

- Add the film to the **ledger** in the house file: folder, length, voice, idea, camera grammar, ending, end line,
  and the user's verdict once you have it.
- Save new lessons (feedback, rig tricks, bugs) to the project memory note on films.
- When the user gives feedback on a cut, rebuild in the same folder with the earlier cut kept in `v1/`, and say
  how each point was addressed.

## Post copy (when asked)

Give 2–3 options: one about 2 sentences long, two short. Plain words, the product's real behaviour, the URL at the
end, no hashtags or emoji unless asked. Match the user's framing (e.g. "it decides when to drop in, and you can
call it yourself anytime").
