// One clock for the picture (film.js) and the sound (audio/score.mjs). Seconds.
// Every time here is worked out from the words themselves (how long a line takes to type, to come up, to be
// read), so changing a line retimes everything after it. Never hand-type a time that a line's length decides.
(function () {
  const clampn = (v, a, b) => Math.max(a, Math.min(b, v));
  /** How long a line takes to type by hand: a breath at commas and stops. */
  const dur = (text, per = 0.052, pause = 0.22) => { let t = 0; for (const ch of text) t += ',.?!:'.includes(ch) ? pause : per; return t; };
  const nw = (s) => (s.match(/\S+\s*/g) || []).length;
  const WS = 0.15, WF = 0.45;                                          // between the words of a spoken line; one word's fade
  const holdFor = (words) => clampn(0.8 + 0.1 * words, 1.3, 1.9);    // how long a finished line holds still before it goes

  // What is written on screen. You (Manrope) and the product / its character (Geist) are told apart by typeface.
  const TEXT = {
    date: 'Thursday, October 8',
    line: 'Dear future me, keep going.',
    tagline: 'One idea, said once.',
    url: 'example.com',
  };
  // What the character says: its words come up one by one.
  const SAY = {
    hello: 'Kept. I’ll bring it back.',
  };

  // The voice-over (optional; references/sound-and-voice.md). Empty: no voice, the typed text carries the film.
  // One take per beat in audio/vo/ (keyed by the beat it voices), its phrases measured by `node audio/voice.mjs`;
  // `parts` is the line's text split the same way. A take's length sets its beat's length: the voice times the clock.
  //   say: { file: '02-say.wav', feeling: 'calm', says: 'Kept. I’ll bring it back.', phrases: [[0.11, 0.62], [0.9, 2.05]],
  //          parts: ['Kept.', 'I’ll bring it back.'] },
  const TAKES = {};
  const spoken = (k) => (TAKES[k] ? TAKES[k].phrases[TAKES[k].phrases.length - 1][1] - TAKES[k].phrases[0][0] : null);

  const T = {};
  T.pageIn = [0.2, 1.1];
  T.type = 1.0; T.typed = T.type + (spoken('line') ?? dur(TEXT.line, 0.062, 0.26));
  T.glide = [T.typed + holdFor(nw(TEXT.line)), 0];                    // your line is read first; then it glides in (no hops)
  T.glide[1] = T.glide[0] + 1.65;
  T.say = T.glide[1] + 0.25; T.said = T.say + (spoken('say') ?? (nw(SAY.hello) - 1) * WS + WF);
  T.sayOut = T.said + holdFor(nw(SAY.hello));
  T.pull = [T.sayOut, T.sayOut + 2.1];                                // the lens pulls back for the end
  T.tag = T.pull[1] - 0.6; T.url = T.tag + 1.0;
  const DUR = +(T.url + 2.8).toFixed(2);
  const BLINKS = [T.glide[1] + 0.3, T.said + 0.5, T.url + 1.1];

  // The takes as the score lays them in: cut at from..to, placed at `at`, typed (or spoken word by word) as heard.
  const AT = { line: T.type, say: T.say }, TEXTOF = { line: TEXT.line, say: SAY.hello };
  const VOICE = Object.entries(TAKES).map(([k, v]) => {
    const from = v.phrases[0][0], to = v.phrases[v.phrases.length - 1][1];
    const parts = v.parts ?? [TEXTOF[k]], ph = v.parts ? v.phrases : [[from, to]];
    return { file: v.file, from, to, at: AT[k], feeling: v.feeling, says: v.says, type: parts.map((text, i) => ({ line: k, text, from: ph[i][0], to: ph[i][1] })) };
  });

  window.TIMELINE = { DUR, T, TEXT, SAY, BLINKS, VOICE, tools: { dur, nw, holdFor, WS, WF } };
})();
