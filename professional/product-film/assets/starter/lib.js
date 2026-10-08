'use strict';
// The shared parts of a film: the frame, the maths, the camera, the type, and the small things that draw
// (typing with a caret, words that come up one by one, the character's breathing body).

const { DUR, T, TEXT, SAY, BLINKS, VOICE } = window.TIMELINE;
// 16:9 for launch pages and X; for a vertical cut (Reels, TikTok, Shorts) set 1080 × 1920 and re-frame the shots.
const W = 1920, H = 1080, FPS = 60, FRAMES = Math.round(DUR * FPS), SIM_HZ = 240, SUB = SIM_HZ / FPS;
const NS = 'http://www.w3.org/2000/svg';
const INK = '#000', PAPER = '#fff', GREY = '#8a8a8a', MUTED = '#a3a3a3', FAINT = '#bdbdbd', LIGHT = '#e7e7e7', EDGE = '#e2e2e2';

// ---------- maths ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const span = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const smoother = (u) => { u = clamp(u); return u * u * u * (u * (u * 6 - 15) + 10); };
const easeInOut = (u) => { u = clamp(u); return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2; };
const easeOut = (u) => 1 - (1 - clamp(u)) ** 3;
/** One seeded random stream. Seed ONE stream per film and draw from it: neighbouring seeds give the same first value. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
}
/** One step of a damped spring. Fine for small things (gaze, a nod); never for a camera chasing something fast. */
function spring(value, velocity, target, dt, stiffness = 170, damping = 14) {
  const v = velocity + (stiffness * (target - value) - damping * velocity) * dt;
  return [value + v * dt, v];
}
const count = (list, now) => { let n = 0; while (n < list.length && list[n] <= now) n++; return n; };
const n1 = (v) => v.toFixed(1), n2 = (v) => v.toFixed(2), n3 = (v) => v.toFixed(3);

// ---------- the camera: a flat lens that only pans and zooms ----------
/** The smoothest move between two views (van Wijk & Nuij, as d3.interpolateZoom): it rises in scale and comes down
 *  again so the centre moves at a steady speed on screen. A view is [cx, cy, width of world shown]. */
function zoomPath([x0, y0, w0], [x1, y1, w1]) {
  const rho = Math.SQRT2, dx = x1 - x0, dy = y1 - y0, d2 = dx * dx + dy * dy;
  if (d2 < 1e-6) { const S = Math.log(w1 / w0) / rho; return (u) => [x0 + u * dx, y0 + u * dy, w0 * Math.exp(rho * u * S)]; }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (2 * w0 * 2 * d1), b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (2 * w1 * 2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1), S = (r1 - r0) / rho;
  return (u) => {
    const s = u * S, k = (w0 / (2 * d1)) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return [x0 + k * dx, y0 + k * dy, (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0)];
  };
}
/** The camera from a list of shots { t, c: [x, y], w, cut?, ease? }: holds between equal shots, a smooth zoom move
 *  between different ones (eased in and out), a hard cut where a shot says `cut`. Exact: no springs, no lag. */
function camera(shots) {
  const moves = shots.slice(1).map((s, i) => zoomPath([...shots[i].c, shots[i].w], [...s.c, s.w]));
  return (t) => {
    let i = 0;
    while (i < shots.length - 1 && shots[i + 1].t <= t) i++;
    if (i === shots.length - 1) return [...shots[i].c, shots[i].w];
    const a = shots[i], b = shots[i + 1];
    if (b.cut) return [...a.c, a.w];
    return moves[i]((b.ease ?? easeInOut)(span(t, a.t, b.t)));
  };
}
/** The world group's transform for a view: the view's centre in the middle of the frame, its width filling it. */
const viewMatrix = ([cx, cy, w]) => { const k = W / w; return `matrix(${n3(k)} 0 0 ${n3(k)} ${n1(W / 2 - cx * k)} ${n1(H / 2 - cy * k)})`; };

// ---------- the character's body: a breathing blob (a closed curve through 9 points) ----------
/** The blob's points: each breathes by up to `amp` (a fraction) of the radius, with its own phase. */
function blobPoints(t, amp, seed, n = 9, r = 17.4, c = 20) {
  const rand = rng(seed);
  const phase = Array.from({ length: n }, () => [rand() * Math.PI * 2, rand() * Math.PI * 2]);
  return phase.map(([a, b], i) => {
    const ang = (i / n) * Math.PI * 2;
    const k = 1 + amp * (0.62 * Math.sin(t * 1.3 + a) + 0.38 * Math.sin(t * 2.3 + b));
    return [c + Math.cos(ang) * r * k, c + Math.sin(ang) * r * k];
  });
}
/** A closed Catmull-Rom curve through `pts`, as cubics. */
function closedPath(pts) {
  const n = pts.length, at = (i) => pts[(i + n) % n];
  let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return `${d}Z`;
}

// ---------- type: [family, weight, size, tracking in em] ----------
const FONT = {
  date: ['Geist', 500, 34, 0.01], line: ['Manrope', 600, 66, -0.02], say: ['Geist', 600, 46, -0.01],
  tagline: ['Manrope', 700, 72, -0.035], url: ['Geist', 500, 30, 0.03],
};
const FACES = ['600 20px Manrope', '700 20px Manrope', '500 20px Geist', '600 20px Geist'];
const face = ([family, weight, size, track]) => ({ 'font-family': family, 'font-weight': weight, 'font-size': size, 'letter-spacing': `${track}em` });
/** When each character of a line appears, typed by hand: a breath at commas and stops. */
function typed(text, start, per = 0.052, pause = 0.22) {
  const at = [];
  let t = start;
  for (const ch of text) { t += ',.?!:'.includes(ch) ? pause : per; at.push(t); }
  return { text, start, end: t, at, shown: (now) => count(at, now) };
}
/** A line typed while a voice says it (typed = said): each phrase's characters spread over the time it is heard.
 *  `parts` are { text, at, until } in film seconds; the line is their texts joined by spaces. */
function typedSaid(parts) {
  const text = parts.map((p) => p.text.trim()).join(' '), at = [];
  parts.forEach((p, i) => { const s = (i ? ' ' : '') + p.text.trim(); for (let k = 0; k < s.length; k++) at.push(p.at + ((k + 1) / s.length) * (p.until - p.at)); });
  return { text, start: parts[0].at, end: parts[parts.length - 1].until, at, shown: (now) => count(at, now) };
}
/** When each word of a spoken line comes up: in turn through each phrase, while it is heard. */
function saidWords(parts, fade) {
  return parts.flatMap((p) => {
    const n = (p.text.match(/\S+/g) || []).length, step = n > 1 ? Math.max(0.05, (p.until - p.at - fade) / (n - 1)) : 0;
    return Array.from({ length: n }, (_, i) => p.at + i * step);
  });
}

// ---------- svg ----------
const svg = document.getElementById('svg'), world = document.getElementById('world'), over = document.getElementById('over'), defs = document.getElementById('defs');
svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
document.getElementById('paper').setAttribute('width', W); document.getElementById('paper').setAttribute('height', H);
Object.assign(document.getElementById('film').style, { width: `${W}px`, height: `${H}px` });
function el(name, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const show = (node, on) => node.setAttribute('display', on ? 'inline' : 'none');
const g = (parent, attrs = {}) => el('g', attrs, parent);
const rrect = (x, y, w, h, r) => `M${n1(x + r)} ${n1(y)}H${n1(x + w - r)}A${r} ${r} 0 0 1 ${n1(x + w)} ${n1(y + r)}V${n1(y + h - r)}A${r} ${r} 0 0 1 ${n1(x + w - r)} ${n1(y + h)}H${n1(x + r)}A${r} ${r} 0 0 1 ${n1(x)} ${n1(y + h - r)}V${n1(y + r)}A${r} ${r} 0 0 1 ${n1(x + r)} ${n1(y)}Z`;
/** Things to do once the fonts are in: measuring text. Text measures 0 while it (or a parent) is display:none. */
const fits = [];
const meter = el('g', { opacity: 0 }, svg);
/** The width of a line of text in a font, measured once the fonts are in (read `.w`). */
function measure(text, font) {
  const n = el('text', { style: 'white-space: pre', ...face(font) }, meter);
  n.textContent = text;
  const m = { w: 0 };
  fits.push(() => { m.w = n.getComputedTextLength(); });
  return m;
}

/** A row of words that fade up one after another (how the character and transcripts speak); placed once measured. */
function wordRow(parent, text, x, y, font, attrs = {}, anchor = 'start') {
  const parts = text.match(/\S+\s*/g);
  const row = { parts, x, y, anchor, width: 0, offs: [], nodes: parts.map((p) => { const n = el('text', { x, y, style: 'white-space: pre', ...face(font), ...attrs }, parent); n.textContent = p; return n; }) };
  fits.push(() => {
    let acc = 0;
    row.offs = row.nodes.map((n) => { const o = acc; acc += n.getComputedTextLength(); return o; });
    const last = row.nodes[row.nodes.length - 1];
    row.width = acc - (last.getComputedTextLength() - last.getSubStringLength(0, parts[parts.length - 1].trimEnd().length));
    row.nodes.forEach((n, i) => n.setAttribute('x', n1((anchor === 'middle' ? row.x - row.width / 2 : row.x) + row.offs[i])));
  });
  return row;
}
/** Fade the words of a row up in turn from `start` (or at `start[i]` each, when a voice paces them), each rising
 *  `rise` units as it comes; `gain` fades the whole row. */
function fadeWords(row, t, start, stagger, dur = 0.45, rise = 12, gain = 1) {
  row.nodes.forEach((n, i) => {
    const s = Array.isArray(start) ? start[i] : start + i * stagger, u = smooth(span(t, s, s + dur)), a = u * gain;
    show(n, a > 0.002);
    n.setAttribute('opacity', n3(a));
    n.setAttribute('transform', `translate(0 ${n1(rise * (1 - u))})`);
  });
}

/** A line the person types: the text behind a caret that is solid while typing and blinks only when typing rests. */
function typer(parent, ty, x, y, font, { fill = INK, window: win = null } = {}) {
  const P = { ty, x, y, win: win ?? [ty.start - 0.3, ty.end + 1.4] };
  P.text = el('text', { x, y, fill, style: 'white-space: pre', ...face(font) }, parent);
  P.shown = el('tspan', {}, P.text);
  P.rest = el('tspan', { 'fill-opacity': 0 }, P.text);
  P.caret = el('rect', { width: Math.max(4, font[2] * 0.075), y: y - font[2] * 0.85, height: font[2] * 1.12, fill }, parent);
  /** Where the caret is now, in the parent's units (for the character to look at). */
  P.caretX = (t) => { const n = ty.shown(t); return P.x + (n ? P.text.getSubStringLength(0, n) : 0) + 3; };
  P.update = (t, fade = 1) => {
    const n = ty.shown(t);
    P.shown.textContent = ty.text.slice(0, n); P.rest.textContent = ty.text.slice(n);
    show(P.text, n > 0);
    P.text.setAttribute('opacity', n3(fade));
    const typing = t >= P.win[0] && t < P.win[1];
    const idle = n === 0 ? t - P.win[0] : t - ty.at[n - 1];
    const on = typing && fade > 0.5 && (idle < 0.4 || Math.floor((idle - 0.4) / 0.5) % 2 === 1);
    show(P.caret, on);
    if (on) P.caret.setAttribute('x', n1(P.caretX(t)));
  };
  return P;
}
