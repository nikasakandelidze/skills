// The sound, made from nothing but arithmetic: a felt piano in a room, a pad, soft key clicks, air, bells. Played
// against the film's own clock (../timeline.js) and the things that happen in it (events.json, written by
// `node render.mjs events`), so picture and sound cannot drift. If timeline.js lists VOICE takes, they are laid in
// from vo/ and the music steps back under them.
//   node audio/score.mjs      writes audio/mix.wav and one file per stem in audio/stems/, and prints loudness
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const window = {};
new Function('window', readFileSync(path.join(here, '../timeline.js'), 'utf8'))(window);
const { DUR, T, VOICE = [] } = window.TIMELINE;
const EV = JSON.parse(readFileSync(path.join(here, 'events.json'), 'utf8'));

const SR = 48000, N = Math.ceil(DUR * SR), TAU = Math.PI * 2;
const bus = () => [new Float32Array(N), new Float32Array(N)];
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const db = (v) => 10 ** (v / 20);
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
}
const rand = rng(2026);
/** Equal-power place between the speakers: -1 left, 1 right. */
const place = (p) => [Math.cos(((clamp(p, -1, 1) + 1) * Math.PI) / 4), Math.sin(((clamp(p, -1, 1) + 1) * Math.PI) / 4)];
function add(out, n, v, [l, r]) { if (n >= 0 && n < N) { out[0][n] += v * l; out[1][n] += v * r; } }

// ---------- instruments ----------
/** A felt piano: a few partials that die faster the higher they are, two strings a hair apart. */
function key(out, at, midi, vel = 0.5, pan = 0) {
  const f = hz(midi), p = place(pan), n0 = Math.round(at * SR);
  const long = 2.4 * (440 / f) ** 0.45, len = Math.min(N - n0, Math.round(long * 4.2 * SR));
  const soft = 0.5 + vel * 0.5;
  const parts = [1, 0.46 * soft, 0.2 * soft, 0.085 * soft * soft, 0.04 * soft * soft].map((a, i) => {
    const h = i + 1;
    return { a, w: (TAU * f * h * Math.sqrt(1 + 0.0004 * h * h)) / SR, d: Math.exp(-1 / ((long / (1 + 0.75 * i)) * SR)) };
  }).filter((q) => q.w < Math.PI * 0.9);
  for (const cents of [-1.6, 1.7]) {
    const tune = 2 ** (cents / 1200), ph = rand() * TAU;
    for (const q of parts) {
      let e = q.a * vel * 0.16;
      for (let n = 0; n < len; n++) {
        const rise = n < 384 ? 0.5 - 0.5 * Math.cos((n / 384) * Math.PI) : 1;
        add(out, n0 + n, Math.sin(q.w * tune * n + ph * (q.a < 1 ? 1 : 0)) * e * rise, p);
        e *= q.d;
        if (e < 2e-5) break;
      }
    }
  }
  let lp = 0;
  for (let n = 0; n < 900; n++) { lp += ((rand() * 2 - 1) - lp) * 0.12; add(out, n0 + n, lp * vel * 0.05 * Math.exp(-n / 220), p); }
}
/** A pad: every note three voices wide, breathing slowly. */
function pad(out, from, to, notes, amp, { attack = 1.4, release = 1.8, bright = 0.25 } = {}) {
  const n0 = Math.max(0, Math.round(from * SR)), n1 = Math.min(N, Math.round((to + release) * SR));
  for (const midi of notes) {
    const f = hz(midi);
    [[-6, -0.7], [0, 0], [7, 0.7]].forEach(([cents, pan]) => {
      const w = (TAU * f * 2 ** (cents / 1200)) / SR, p = place(pan), ph = rand() * TAU, lf = TAU * (0.07 + rand() * 0.12) / SR, lp = rand() * TAU;
      for (let n = n0; n < n1; n++) {
        const t = n / SR, env = smooth((t - from) / attack) * (1 - smooth((t - to) / release));
        const x = w * (n - n0) + ph;
        const v = Math.sin(x) + bright * Math.sin(2 * x + 1.3) + bright * 0.4 * Math.sin(3 * x + 0.4);
        add(out, n, v * env * (0.78 + 0.22 * Math.sin(lf * n + lp)) * (amp / (notes.length * 3)), p);
      }
    });
  }
}
/** Air: noise through a band that slides from one pitch to another (a glide, a whoosh, a page turning). */
function air(out, at, dur, f0, f1, amp, { peak = 0.5, q = 1.4, pan0 = 0, pan1 = 0 } = {}) {
  const n0 = Math.round(at * SR), len = Math.round(dur * SR);
  let low = 0, band = 0;
  for (let n = 0; n < len; n++) {
    const u = n / len, f = f0 * (f1 / f0) ** u, g = 2 * Math.sin((Math.PI * Math.min(f, SR / 6.5)) / SR);
    low += g * band;
    band += g * ((rand() * 2 - 1) - low - band / q);
    const env = u < peak ? smooth(u / peak) ** 2 : smooth((1 - u) / (1 - peak)) ** 2;
    add(out, n0 + n, band * env * amp, place(pan0 + (pan1 - pan0) * u));
  }
}
/** A key going down: a small wooden knock and a click on top of it. */
function tick(out, at, amp, pan = 0) {
  const n0 = Math.round(at * SR), f = 640 * (0.85 + rand() * 0.4), p = place(pan), a = amp * (0.65 + rand() * 0.6);
  let lp = 0;
  for (let n = 0; n < 1400; n++) {
    lp += ((rand() * 2 - 1) - lp) * 0.35;
    add(out, n0 + n, (Math.sin((TAU * f * n) / SR) * Math.exp(-n / 260) * 0.8 + lp * Math.exp(-n / 70) * 0.9) * a, p);
  }
}
/** Something landing: a low note that falls. */
function thump(out, at, amp, from = 118, to = 46) {
  const n0 = Math.round(at * SR);
  let ph = 0;
  for (let n = 0; n < 0.7 * SR; n++) {
    const t = n / SR;
    ph += (TAU * (to + (from - to) * Math.exp(-t / 0.05))) / SR;
    add(out, n0 + n, Math.sin(ph) * Math.exp(-t / 0.16) * Math.min(1, n / 120) * amp, [0.707, 0.707]);
  }
}
/** A small glass bell. */
function bell(out, at, midi, amp, pan = 0) {
  const n0 = Math.round(at * SR), f = hz(midi), p = place(pan);
  const parts = [[1, 1, 0.7], [2.76, 0.32, 0.28], [5.4, 0.12, 0.12]].filter(([r]) => f * r < SR * 0.45);
  for (let n = 0; n < 2.4 * SR; n++) {
    const t = n / SR;
    let v = 0;
    for (const [r, a, d] of parts) v += a * Math.sin(TAU * f * r * t) * Math.exp(-t / d);
    add(out, n0 + n, v * Math.min(1, n / 140) * amp, p);
  }
}
/** A room (Freeverb: eight combs and four allpasses a side). */
function room([inL, inR], { size = 0.86, damp = 0.32 } = {}) {
  const k = SR / 44100, out = bus();
  const line = (len) => ({ buf: new Float32Array(Math.round(len * k)), i: 0, keep: 0 });
  const sides = [0, 23].map((off) => ({
    combs: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((t) => line(t + off)),
    passes: [556, 441, 341, 225].map((t) => line(t + off)),
  }));
  for (let n = 0; n < N; n++) {
    const x = (inL[n] + inR[n]) * 0.015;
    sides.forEach((s, side) => {
      let y = 0;
      for (const c of s.combs) {
        const was = c.buf[c.i];
        c.keep = was * (1 - damp) + c.keep * damp;
        c.buf[c.i] = x + c.keep * size;
        if (++c.i >= c.buf.length) c.i = 0;
        y += was;
      }
      for (const a of s.passes) {
        const was = a.buf[a.i], through = was - y;
        a.buf[a.i] = y + was * 0.5;
        if (++a.i >= a.buf.length) a.i = 0;
        y = through;
      }
      out[side][n] = y;
    });
  }
  return out;
}

// ---------- files ----------
/** A 16-bit PCM WAV at 48 kHz (Cartesia: output_format { container: 'wav', encoding: 'pcm_s16le', sample_rate: 48000 }). */
function readWav(file) {
  const b = readFileSync(file);
  let at = 12, rate = SR, chans = 1, data = null;
  while (at + 8 <= b.length) {
    const id = b.toString('latin1', at, at + 4), size = b.readUInt32LE(at + 4);
    if (id === 'fmt ') { chans = b.readUInt16LE(at + 10); rate = b.readUInt32LE(at + 12); }
    if (id === 'data') { data = b.subarray(at + 8, Math.min(b.length, at + 8 + size)); break; }
    at += 8 + size + (size % 2);
  }
  if (!data || rate !== SR) throw new Error(`${file}: expected ${SR} Hz 16-bit PCM (ffmpeg -i in -ar 48000 -c:a pcm_s16le out.wav)`);
  const out = new Float32Array(Math.floor(data.length / 2 / chans));
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2 * chans) / 32768;
  return out;
}
function writeWav(file, [l, r]) {
  const b = Buffer.alloc(44 + N * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + N * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 4, 40);
  for (let n = 0; n < N; n++) {
    b.writeInt16LE(Math.round(clamp(l[n], -1, 1) * 32767), 44 + n * 4);
    b.writeInt16LE(Math.round(clamp(r[n], -1, 1) * 32767), 46 + n * 4);
  }
  writeFileSync(file, b);
}
const peak = ([l, r]) => { let m = 0; for (let n = 0; n < N; n++) m = Math.max(m, Math.abs(l[n]), Math.abs(r[n])); return m; };
const rms = ([l, r], from = 0, to = DUR) => { let s = 0; const a = Math.round(from * SR), z = Math.min(N, Math.round(to * SR)); for (let n = a; n < z; n++) s += l[n] * l[n] + r[n] * r[n]; return Math.sqrt(s / Math.max(1, 2 * (z - a))); };
const gain = (b, g) => { for (const c of b) for (let n = 0; n < N; n++) c[n] *= g; return b; };
const sum = (...buses) => { const out = bus(); for (const b of buses) for (let c = 0; c < 2; c++) for (let n = 0; n < N; n++) out[c][n] += b[c][n]; return out; };

// ---------- the score: write one cue per beat of the film, from the clock and the events ----------
const music = bus(), echo = bus(), fx = bus(), fxEcho = bus();
const both = (a, b, fn) => { fn(a); fn(b); };
const play = (at, midi, vel, pan = 0) => both(music, echo, (o) => key(o, at, midi, vel, pan));
const roll = (at, notes, vel = 0.4, step = 0.06, pan = -0.3) => notes.forEach((n, i) => play(at + i * step, n, i ? vel * 0.78 : vel, pan + i * 0.15));

// the harmony: D, quiet and warm (MIDI notes)
const Dsus = [38, 45, 50, 52, 57], Dadd9 = [38, 50, 54, 57, 64], Gadd9 = [43, 50, 57, 59, 62], HOME = [26, 38, 45, 50, 57, 62, 66, 69];
const chords = [
  [0, T.glide[0], Dsus, 0.3, { attack: 1.6, bright: 0.06 }],                            // you write: thin, waiting
  [T.glide[0], T.pull[0], Dadd9, 0.38, { attack: 0.8, bright: 0.14 }],                  // it arrives: warm
  [T.pull[0], T.tag, Gadd9, 0.4, { attack: 1.0, bright: 0.16 }],                        // the pull back: a lift
  [T.tag, DUR - 0.8, HOME, 0.5, { attack: 0.9, release: 2.2, bright: 0.24 }],           // the end line: home
];
for (const [from, to, notes, amp, how] of chords) both(music, echo, (o) => pad(o, from, to, notes, amp * 0.5, how));

for (const at of EV.keys) tick(fx, at - 0.012, 0.07, (rand() - 0.5) * 0.4);                    // every key you press
EV.words.forEach((at, i) => play(at + 0.03, [69, 71, 74, 76, 74, 71][i % 6], 0.16, 0.2));       // each word it says: a soft note
air(fx, EV.glide[0], EV.glide[1] - EV.glide[0] + 0.3, 2400, 500, 0.05, { pan0: 0.8, pan1: 0.2 }); // it glides in
EV.blinks.forEach((at) => tick(fx, at + 0.05, 0.02));
roll(EV.tag[0] - 0.05, [26, 38, 45, 50, 57, 62, 66, 69], 0.42, 0.07, -0.35);                       // the end line
bell(fx, EV.url + 0.05, 93, 0.08, 0.2);

// ---------- the voice: each take cut at from..to and laid in at `at`, every line at the same strength ----------
const voice = bus(), said = [];
for (const v of VOICE) {
  const file = path.join(here, 'vo', v.file);
  if (!existsSync(file)) { console.log(`missing ${file}: skipped`); continue; }
  const take = readWav(file), a = Math.round(v.from * SR), z = Math.min(take.length, Math.round(v.to * SR)), n0 = Math.round(v.at * SR), edge = 0.02 * SR;
  let power = 0, loud = 0;
  for (let n = a; n < z; n++) if (Math.abs(take[n]) > 0.02) { power += take[n] * take[n]; loud++; }
  const level = db(-15) / Math.sqrt(power / Math.max(1, loud));
  for (let n = a; n < z; n++) add(voice, n0 + n - a, take[n] * Math.min(1, (n - a) / edge, (z - n) / edge) * level, [0.707, 0.707]);
  said.push([v.at, v.at + (z - a) / SR]);
}
for (const c of voice) { let lo = 0; for (let n = 0; n < N; n++) { lo += (c[n] - lo) * (TAU * 75 / SR); c[n] -= lo; } } // no rumble under it

// ---------- the mix ----------
const wet = room(echo), fxWet = room(fxEcho, { size: 0.8, damp: 0.4 }), voiceWet = room(voice, { size: 0.7, damp: 0.5 });
gain(wet, 0.9 * rms(music) / Math.max(1e-9, rms(wet)));
gain(fxWet, 0.6 * rms(fx) / Math.max(1e-9, rms(fxWet)));
gain(voiceWet, 0.12 * rms(voice) / Math.max(1e-9, rms(voiceWet)));
const band = sum(music, wet), sound = sum(fx, fxWet), speech = sum(voice, voiceWet);
gain(band, db(said.length ? -23.5 : -22) / Math.max(1e-9, rms(band, 1, DUR - 1)));
gain(sound, db(-12) / Math.max(1e-9, peak(sound)));
if (said.length) {
  // its loudest moments rounded off rather than the whole of it turned down; the music steps back while it speaks
  for (const c of speech) for (let n = 0; n < N; n++) { const v = Math.abs(c[n]); if (v > 0.5) c[n] = Math.sign(c[n]) * (0.5 + 0.42 * Math.tanh((v - 0.5) / 0.42)); }
  let g = 1;
  for (let n = 0; n < N; n++) {
    const t = n / SR, speaking = said.some(([a, z]) => t >= a - 0.15 && t < z + 0.05);
    g += ((speaking ? db(-9.5) : 1) - g) * (speaking ? 1 / (0.09 * SR) : 1 / (0.45 * SR));
    band[0][n] *= g; band[1][n] *= g;
  }
}
const mix = sum(band, sound, speech);
for (const c of mix) for (let n = 0; n < N; n++) c[n] = Math.tanh(c[n] * 1.05) * smooth((DUR - n / SR) / 0.9) * smooth(n / SR / 0.05);

mkdirSync(path.join(here, 'stems'), { recursive: true });
writeWav(path.join(here, 'stems/music.wav'), band);
writeWav(path.join(here, 'stems/sound.wav'), sound);
if (said.length) writeWav(path.join(here, 'stems/voice.wav'), speech);
writeWav(path.join(here, 'mix.wav'), mix);
const dbs = (v) => (20 * Math.log10(Math.max(1e-9, v))).toFixed(1);
for (const [name, b] of [['music', band], ['sound', sound], ['voice', speech], ['mix', mix]]) if (name !== 'voice' || said.length) console.log(`${name.padEnd(6)} peak ${dbs(peak(b))} dB   rms ${dbs(rms(b))} dB`);
// how loud it is, two seconds at a time: the shape of the film in sound (quiet under reading, lifting at the turns)
const marks = [];
for (let t = 0; t < DUR - 0.5; t += 2) marks.push(`${String(t).padStart(3)}s ${dbs(rms(mix, t, Math.min(DUR, t + 2)))}`);
console.log(marks.join('  |  '));
