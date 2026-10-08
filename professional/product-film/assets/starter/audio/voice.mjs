// Where the voice actually is in each take in audio/vo/: the voiced span, and the phrases in it (split where it
// pauses), found from the sound's energy, with no speech-to-text. Record one take per typed phrase and the span
// of the take is the typing window; a take with several phrases splits at its pauses.
//   node audio/voice.mjs              prints every take, and a VOICE entry for it to paste into timeline.js
//   node audio/voice.mjs 03-back.wav  just that take
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const VO = path.join(here, 'vo');
if (!existsSync(VO)) { console.log('no takes yet: put one 48 kHz 16-bit WAV per beat in audio/vo/'); process.exit(0); }
const files = process.argv[2] ? [process.argv[2]] : readdirSync(VO).filter((f) => f.endsWith('.wav')).sort();

function readWav(file) {
  const b = readFileSync(file);
  let at = 12, rate = 0, chans = 1, bits = 16, data = null;
  while (at + 8 <= b.length) {
    const id = b.toString('latin1', at, at + 4), size = b.readUInt32LE(at + 4);
    if (id === 'fmt ') { chans = b.readUInt16LE(at + 10); rate = b.readUInt32LE(at + 12); bits = b.readUInt16LE(at + 22); }
    if (id === 'data') { data = b.subarray(at + 8, Math.min(b.length, at + 8 + size)); break; }
    at += 8 + size + (size % 2);
  }
  if (!data || bits !== 16) throw new Error(`${file}: expected 16-bit PCM`);
  const out = new Float32Array(Math.floor(data.length / 2 / chans));
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2 * chans) / 32768;
  return { rate, samples: out };
}

const takes = {};
for (const file of files) {
  const { rate, samples } = readWav(path.join(VO, file));
  if (rate !== 48000) console.log(`// ${file}: ${rate} Hz; the score wants 48000 (ffmpeg -i in.wav -ar 48000 -c:a pcm_s16le out.wav)`);
  // loudness in 10 ms windows; voiced = within 38 dB of the loudest window and above -48 dBFS
  const hop = Math.round(rate * 0.01), level = [];
  for (let i = 0; i + hop <= samples.length; i += hop) { let s = 0; for (let k = i; k < i + hop; k++) s += samples[k] * samples[k]; level.push(10 * Math.log10(s / hop + 1e-12)); }
  const top = Math.max(...level), floor = Math.max(top - 38, -48);
  const runs = [];
  level.forEach((l, i) => { if (l > floor) { const last = runs[runs.length - 1]; if (last && i - last[1] <= 16) last[1] = i; else runs.push([i, i]); } }); // gaps under 0.16 s are inside a phrase
  const phrases = runs.filter(([a, z]) => z - a >= 6).map(([a, z]) => [+Math.max(0, a * 0.01 - 0.03).toFixed(2), +Math.min(samples.length / rate, (z + 1) * 0.01 + 0.08).toFixed(2)]);
  if (!phrases.length) { console.log(`// ${file}: silent`); continue; }
  const from = phrases[0][0], to = phrases[phrases.length - 1][1];
  takes[file] = { length: +(samples.length / rate).toFixed(2), from, to, phrases };
  console.log(`${file}  ${takes[file].length} s  voiced ${from}..${to}  phrases ${phrases.map(([a, z]) => `${a}–${z}`).join('  ')}`);
  console.log(`  { file: '${file}', from: ${from}, to: ${to}, at: 0, feeling: '', says: '',\n    type: [${phrases.map(([a, z]) => `{ line: '', text: '', from: ${a}, to: ${z} }`).join(', ')}] },`);
}
writeFileSync(path.join(here, 'takes.json'), JSON.stringify(takes, null, 1));
