'use strict';
// The picture as a pure function of time. `build` makes every node once; `simulate` runs the whole film once at
// 240 Hz (springs, anything with memory) and keeps one state per frame; `render(frame)` sets every attribute for
// that frame from the clock and that state alone. Frame 1,000 always looks the same, rendered on its own.
//
// This starter film: a page, a line you type, the character gliding in to say one thing, a pull back to the end
// line. Replace the world, keep the shape of the file.

const { WS, WF } = window.TIMELINE.tools;

// ---------- the voice, if there is one: what is typed follows what is said ----------
const voiced = VOICE.flatMap((v) => (v.type ?? []).map((p) => ({ ...p, at: v.at + (p.from - v.from), until: v.at + (p.to - v.from) })));
const partsOf = (name) => voiced.filter((p) => p.line === name);

// ---------- the camera: shots { t, c: [x, y], w (world width shown), cut?, ease? } ----------
const cam = camera([
  { t: 0, c: [960, 540], w: 2350 },
  { t: T.typed + 0.2, c: [960, 545], w: 1980 },        // a slow push while you type (slow: there is text to read)
  { t: T.pull[0], c: [960, 545], w: 1980 },            // hold while it speaks
  { t: T.pull[1], c: [960, 430], w: 4300 },            // pull back for the end line
]);

// ---------- the world ----------
const PAGE = { x: 330, y: 250, w: 1260, h: 580, r: 28 };
const LINE = { x: 400, y: 520 }, SAYAT = { x: 400, y: 640 };
const HERO = { r: 64, from: [2260, 600], rest: [1500, PAGE.y + PAGE.h - 8] };

const page = g(world);
el('path', { d: rrect(PAGE.x, PAGE.y, PAGE.w, PAGE.h, PAGE.r), fill: PAPER, stroke: INK, 'stroke-width': 3 }, page);
const date = el('text', { x: LINE.x, y: PAGE.y + 92, fill: GREY, ...face(FONT.date) }, page);
date.textContent = TEXT.date;

const lineParts = partsOf('line');
const lineTy = lineParts.length ? typedSaid(lineParts) : typed(TEXT.line, T.type, 0.062, 0.26);
const line = typer(page, lineTy, LINE.x, LINE.y, FONT.line);
const lineW = measure(TEXT.line, FONT.line);

const sayParts = partsOf('say');
const sayRow = wordRow(page, SAY.hello, SAYAT.x, SAYAT.y, FONT.say, { fill: INK });
const sayAt = sayParts.length ? saidWords(sayParts, WF) : sayRow.parts.map((_, i) => T.say + i * WS);   // when each word comes up

// the character: a breathing ink body and two white eyes (tall pills when idle)
const hero = g(world);
const body = el('path', { fill: INK }, hero);
const eyes = [0, 1].map(() => el('rect', { fill: PAPER }, hero));

// screen space: the end line keeps its size whatever the lens does
const tagRow = wordRow(over, TEXT.tagline, W / 2, H - 210, FONT.tagline, { fill: INK }, 'middle');
const urlRow = wordRow(over, TEXT.url, W / 2, H - 140, FONT.url, { fill: GREY }, 'middle');
const veil = el('rect', { width: W, height: H, fill: PAPER, opacity: 0 }, over);

// ---------- motion ----------
/** Where the character is: off the frame, then one long eased glide with a gentle arc (it never hops). */
function heroAt(t) {
  const u = smoother(span(t, ...T.glide));
  return [lerp(HERO.from[0], HERO.rest[0], u), lerp(HERO.from[1], HERO.rest[1], u) - Math.sin(Math.PI * u) * 80];
}
/** How shut its eyes are (0 open, 1 shut): a quick close and a slower open at each blink. */
const blinkAt = (t) => BLINKS.reduce((m, b) => Math.max(m, t < b ? 0 : t < b + 0.07 ? (t - b) / 0.07 : clamp(1 - (t - b - 0.07) / 0.13)), 0);

let film = null;
/** Run the film once at 240 Hz and keep one state per frame. Only things with memory (springs) belong here. */
function simulate() {
  const out = [], dt = 1 / SIM_HZ;
  let gx = 0, gy = 0, vx = 0, vy = 0;
  for (let n = 0; n < FRAMES * SUB; n++) {
    const t = n / SIM_HZ, [x, y] = heroAt(t);
    // what it looks at: the caret while you type, its own words while it speaks, then you (the lens)
    const caret = [LINE.x + lineW.w * (lineTy.shown(t) / TEXT.line.length), LINE.y - 24];
    const look = t < sayAt[0] ? caret : t < T.sayOut ? [SAYAT.x + sayRow.width * 0.6, SAYAT.y] : [x, y + 400];
    const dx = look[0] - x, dy = look[1] - y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 500);
    [gx, vx] = spring(gx, vx, (dx / d) * k, dt, 90, 13);
    [gy, vy] = spring(gy, vy, (dy / d) * k, dt, 90, 13);
    if (n % SUB === 0) out.push({ x, y, gx, gy });
  }
  return out;
}

// ---------- drawing a frame ----------
function render(f) {
  const t = f / FPS, s = film[Math.min(film.length - 1, Math.round(f))];
  world.setAttribute('transform', viewMatrix(cam(t)));

  page.setAttribute('opacity', n3(smooth(span(t, ...T.pageIn))));
  line.update(t);
  fadeWords(sayRow, t, sayAt, 0, WF, 10);

  const on = t >= T.glide[0] - 0.1;
  show(hero, on);
  if (on) {
    const R = HERO.r, k = R / 17.4;
    body.setAttribute('d', closedPath(blobPoints(t, 0.035, 7)));
    body.setAttribute('transform', `translate(${n1(s.x)} ${n1(s.y)}) scale(${n3(k)}) translate(-20 -20)`);
    const shut = blinkAt(t), ew = 0.17 * R, eh = 0.42 * R * (1 - 0.88 * shut);
    eyes.forEach((e, i) => {
      const cx = s.x + (i ? 1 : -1) * 0.3 * R + s.gx * 0.13 * R, cy = s.y - 0.06 * R + s.gy * 0.1 * R;
      Object.entries({ x: n1(cx - ew / 2), y: n1(cy - eh / 2), width: n1(ew), height: n1(eh), rx: n1(Math.min(ew, eh) / 2) }).forEach(([a, v]) => e.setAttribute(a, v));
    });
  }

  fadeWords(tagRow, t, T.tag, 0.12, 0.6, 14);
  fadeWords(urlRow, t, T.url, 0.05, 0.6, 8);
  veil.setAttribute('opacity', n3(smooth(span(t, DUR - 0.5, DUR))));
}

// ---------- what happens when, for the score (node render.mjs events → audio/events.json) ----------
function collectEvents() {
  const r2 = (v) => +v.toFixed(3);
  return {
    keys: lineTy.at.filter((_, i) => TEXT.line[i] !== ' ').map(r2),
    words: sayAt.map(r2),
    glide: T.glide.map(r2),
    blinks: BLINKS.map(r2),
    tag: tagRow.parts.map((_, i) => r2(T.tag + i * 0.12)),
    url: r2(T.url),
  };
}

/** Numbers to check before rendering (node render.mjs eval "CHECK()"): does each line finish before the next beat,
 *  and does each finished line get time to be read? */
window.CHECK = () => ({
  dur: DUR,
  typedEnds: +lineTy.end.toFixed(2), glideStarts: T.glide[0], lineHold: +(T.glide[0] - lineTy.end).toFixed(2),
  saidEnds: +(sayAt[sayAt.length - 1] + WF).toFixed(2), sayHold: +(T.pull[0] - (sayAt[sayAt.length - 1] + WF)).toFixed(2),
  tagHold: +(DUR - 0.5 - (T.tag + (tagRow.parts.length - 1) * 0.12 + 0.6)).toFixed(2),
});

// ---------- playing it ----------
window.seek = (f) => { render(f); return f; };
window.FILM = { W, H, FPS, DUR, FRAMES, T };
window.FILM_READY = Promise.all(FACES.map((f) => document.fonts.load(f))).then(() => {
  for (const fit of fits) fit();
  film = simulate();
  window.FILM.events = collectEvents();
  render(0);
  return true;
});

if (!document.documentElement.classList.contains('render')) {
  const bar = document.getElementById('bar');
  bar.max = FRAMES - 1;
  let playing = true, at = Number(new URLSearchParams(location.search).get('t') ?? 0) * FPS, last = performance.now();
  const tick = (now) => {
    if (playing) { at = (at + ((now - last) / 1000) * FPS) % FRAMES; bar.value = Math.floor(at); render(at); }
    last = now;
    requestAnimationFrame(tick);
  };
  bar.addEventListener('input', () => { playing = false; at = Number(bar.value); render(at); });
  window.addEventListener('keydown', (e) => { if (e.key === ' ') { playing = !playing; e.preventDefault(); } });
  window.FILM_READY.then(() => requestAnimationFrame(tick));
}
