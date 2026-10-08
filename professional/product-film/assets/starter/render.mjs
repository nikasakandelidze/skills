// Renders scene.html with a headless Chrome over the DevTools protocol, frame by frame.
//   node render.mjs video [out.mp4]          the whole film, piped into ffmpeg (default: <folder>.silent.mp4)
//   node render.mjs still <dir> <seconds>... single frames as PNG, for checking by eye
//   node render.mjs events                    what happens when, for the sound (audio/events.json)
//   node render.mjs eval "<js>"               evaluate something in the film (e.g. "CHECK()") and print it
// Chrome: $CHROME, else the newest headless shell Playwright installed, else Google Chrome.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const NAME = path.basename(here);
const CACHE = `${process.env.HOME}/Library/Caches/ms-playwright`;
const shells = existsSync(CACHE) ? readdirSync(CACHE).filter((d) => d.startsWith('chromium_headless_shell-')).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])) : [];
const CHROME = process.env.CHROME
  || shells.flatMap((d) => ['mac-arm64', 'mac-x64', 'linux64'].map((p) => `${CACHE}/${d}/chrome-headless-shell-${p}/chrome-headless-shell`)).find((f) => existsSync(f))
  || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((f) => existsSync(f));
if (!CHROME) throw new Error('No Chrome found: set CHROME, or run `npx playwright install chromium-headless-shell`');
const [mode = 'video', ...rest] = process.argv.slice(2);

const profile = mkdtempSync(path.join(tmpdir(), 'film-'));
const chrome = spawn(CHROME, ['--headless', '--remote-debugging-port=0', '--hide-scrollbars', '--mute-audio', '--window-size=1920,1920',
  '--force-device-scale-factor=1', '--allow-file-access-from-files', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const quit = () => { chrome.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch { /* still in use */ } };

try {
  const browser = await new Promise((resolve, reject) => {
    let log = '';
    chrome.stderr.on('data', (d) => { log += d; const m = log.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
    setTimeout(() => reject(new Error(`Chrome did not start:\n${log}`)), 20_000);
  });
  const targets = await (await fetch(`http://127.0.0.1:${new URL(browser).port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('no connection to Chrome')); });
  const waiting = new Map();
  let ids = 0;
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (!msg.id || !waiting.has(msg.id)) return;
    const { resolve, reject } = waiting.get(msg.id);
    waiting.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++ids; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  // name the failing expression: a "serialization" error usually means a DOM node got into a returned value
  const run = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }).catch((e) => { throw new Error(`${e.message} (evaluating: ${expression.slice(0, 80)})`); });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };

  await send('Page.enable');
  await send('Page.navigate', { url: `${pathToFileURL(path.join(here, 'scene.html')).href}#render` });
  for (let i = 0; i < 200 && !(await run('typeof window.seek === "function"')); i++) await new Promise((r) => setTimeout(r, 100));
  await run('window.FILM_READY');
  const film = await run('({ W: window.FILM.W, H: window.FILM.H, FPS: window.FILM.FPS, FRAMES: window.FILM.FRAMES })');
  await send('Emulation.setDeviceMetricsOverride', { width: film.W, height: film.H, deviceScaleFactor: 1, mobile: false });
  const frame = async (f) => {
    await run(`window.seek(${f})`);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: film.W, height: film.H, scale: 1 } });
    return Buffer.from(shot.data, 'base64');
  };

  if (mode === 'events') {
    mkdirSync(path.join(here, 'audio'), { recursive: true });
    writeFileSync(path.join(here, 'audio/events.json'), await run('JSON.stringify(window.FILM.events)'));
    console.log('wrote audio/events.json');
  } else if (mode === 'eval') {
    console.log(JSON.stringify(await run(rest[0]), null, 1));
  } else if (mode === 'still') {
    const [dir, ...times] = rest;
    mkdirSync(dir, { recursive: true });
    for (const t of times) {
      const f = Math.min(film.FRAMES - 1, Math.round(Number(t) * film.FPS));
      writeFileSync(path.join(dir, `t${Number(t).toFixed(2).padStart(6, '0')}.png`), await frame(f));
    }
    console.log(`${times.length} stills in ${dir}`);
  } else {
    const out = path.resolve(rest[0] ?? path.join(here, `${NAME}.silent.mp4`));
    const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(film.FPS), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code ? reject(new Error(`ffmpeg exited with ${code}`)) : resolve())));
    const started = Date.now();
    for (let f = 0; f < film.FRAMES; f++) {
      if (!ffmpeg.stdin.write(await frame(f))) await new Promise((r) => ffmpeg.stdin.once('drain', r));
      if (f % 300 === 299) console.log(`${f + 1}/${film.FRAMES} frames, ${((Date.now() - started) / 1000).toFixed(0)} s`);
    }
    ffmpeg.stdin.end();
    await done;
    console.log(`wrote ${out}`);
  }
  ws.close();
} finally {
  quit();
}
