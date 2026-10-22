import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { boxUV, cachedGeometry } from './materials'

// Soft and curved shapes the furniture needs beyond boxes and cylinders. All in metres, cached by size.

const k = (...v: number[]) => v.map((n) => n.toFixed(3)).join(':')

function smoothed(geo: THREE.BufferGeometry, dims: [number, number, number]) {
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  const merged = mergeVertices(geo, 1e-4)
  merged.computeVertexNormals()
  return boxUV(merged, dims)
}

/**
 * A plump pillow: a superellipsoid that is nearly square seen from above and round in section,
 * so it's thickest in the middle and soft all the way round the seam.
 */
export function pillowGeometry(w: number, h: number, d: number, squareness = 4) {
  return cachedGeometry(`pillow:${k(w, h, d, squareness)}`, () => {
    const g = new THREE.SphereGeometry(1, 64, 32)
    const p = g.attributes.position
    const sq = squareness
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const horizontal = (Math.abs(x) ** sq + Math.abs(z) ** sq) ** (1 / sq)
      const r = (horizontal ** 2 + y * y) ** 0.5 || 1
      // Pull the corners out a little so they poke like a real pillow's.
      const corner = 1 + 0.06 * Math.abs(x * z)
      p.setXYZ(i, ((x / r) * w * corner) / 2, (y / r) * (h / 2) * (1 - 0.35 * horizontal ** 6), ((z / r) * d * corner) / 2)
    }
    g.computeVertexNormals()
    return boxUV(g, [w, h, d])
  })
}

/** A seat or back cushion: like a box with soft, rounded, slightly bulging faces. */
export function cushionGeometry(w: number, h: number, d: number, bulge = 0.12) {
  return cachedGeometry(`cushion:${k(w, h, d, bulge)}`, () => {
    const g = new THREE.BoxGeometry(1, 1, 1, 14, 6, 12)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * 2
      let y = p.getY(i) * 2
      let z = p.getZ(i) * 2
      // Round the box towards a superellipsoid, then bulge the middle of each face.
      const len = (Math.abs(x) ** 6 + Math.abs(y) ** 6 + Math.abs(z) ** 6) ** (1 / 6) || 1
      x /= len
      y /= len
      z /= len
      const b = 1 + bulge * (1 - x * x) * (1 - z * z)
      p.setXYZ(i, (x / 2) * w, (y / 2) * h * b, (z / 2) * d)
    }
    return smoothed(g, [w, h, d])
  })
}

function rumple(seed: number) {
  let s = seed
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  const waves = Array.from({ length: 7 }, () => ({ a: rand() * Math.PI * 2, f: 5 + rand() * 9, p: rand() * 6.28, amp: 0.004 + rand() * 0.009 }))
  return (x: number, z: number) => waves.reduce((sum, w) => sum + Math.sin((x * Math.cos(w.a) + z * Math.sin(w.a)) * w.f + w.p) * w.amp, 0)
}

/**
 * A duvet thrown over the foot end of a bed: a soft slab with real thickness, wrinkled on top,
 * rolling over the mattress sides and foot and hanging down. `mw`/`md` is the mattress top it lies
 * on; it covers `cover` of the length. Origin at the mattress foot edge, on the mattress top.
 */
export function duvetGeometry(mw: number, md: number, cover: number, drop: number, seed = 1) {
  return cachedGeometry(`duvet:${k(mw, md, cover, drop, seed)}`, () => {
    const over = 0.2
    const len = md * cover
    const w = mw + over * 2
    const d = len + over
    const thick = 0.07
    const g = new THREE.BoxGeometry(w, thick, d, 80, 2, 64)
    const p = g.attributes.position
    const wr = rumple(seed)
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i) + thick / 2 // 0 underside, thick on top
      const z = p.getZ(i) + d / 2 // 0 at the head-side edge, `len` at the mattress foot
      const outX = Math.max(0, Math.abs(x) - mw / 2)
      const outZ = Math.max(0, z - len)
      const out = Math.hypot(outX, outZ)
      // Roll over the mattress edge, then hang; the hanging part thins out like fabric does.
      const fall = out < 0.05 ? (out * out) / 0.1 : out - 0.025
      const sag = Math.min(fall * 1.7, drop)
      const lift = y * (out > 0.05 ? 0.45 : 1)
      const head = z < 0.12 ? Math.sin((z / 0.12) * (Math.PI / 2)) : 1 // tapered head-side edge
      const pull = out > 0 ? Math.min(out, 0.07) * 0.75 : 0
      p.setXYZ(
        i,
        x - Math.sign(x) * pull * (outX / (out || 1)),
        lift * head + 0.004 + wr(x, z) * (out > 0 ? 0.5 : 1) - sag,
        z - len - pull * (outZ / (out || 1)),
      )
    }
    return smoothed(g, [w, thick, d])
  })
}

/** A panel curved around a vertical axis in front of it (radius R), like a chair back wrapping round you. */
export function bentPanelGeometry(w: number, h: number, t: number, R: number) {
  return cachedGeometry(`bent:${k(w, h, t, R)}`, () => {
    const g = new THREE.BoxGeometry(w, h, t, 24, 4, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const a = x / R
      p.setXYZ(i, (R - z) * Math.sin(a), p.getY(i), R - (R - z) * Math.cos(a))
    }
    return smoothed(g, [w, h, t])
  })
}

/** Upholstered headboard: rounded top corners and padded, bevelled edges. Origin at bottom centre, front face at z = 0. */
export function headboardGeometry(w: number, h: number, t: number, corner: number) {
  return cachedGeometry(`headboard:${k(w, h, t, corner)}`, () => {
    const pad = Math.min(0.025, t / 3)
    const r = Math.min(corner, w / 2 - pad, h - pad * 2)
    const hw = w / 2 - pad
    const top = h - pad
    const s = new THREE.Shape()
    s.moveTo(-hw, pad)
    s.lineTo(hw, pad)
    s.lineTo(hw, top - r)
    s.quadraticCurveTo(hw, top, hw - r, top)
    s.lineTo(-hw + r, top)
    s.quadraticCurveTo(-hw, top, -hw, top - r)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: t - pad * 2, bevelEnabled: true, bevelThickness: pad, bevelSize: pad, bevelSegments: 5, curveSegments: 16 })
    g.translate(0, 0, -t + pad)
    g.computeVertexNormals()
    return boxUV(g, [w, h, t])
  })
}

/** A lamp shade: an egg-shaped dome, open at the bottom. Rim at y = 0, top at y = h; front faces point outwards. */
export function shadeGeometry(r: number, h: number) {
  return cachedGeometry(`shade:${k(r, h)}`, () => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 24; i++) {
      // From the rim up to the narrow top (lathe profiles go bottom to top for outward normals).
      const a = ((24 - i) / 24) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.max(0.006, Math.sin(a) * r), Math.cos(a) * h))
    }
    return new THREE.LatheGeometry(pts, 40)
  })
}

export function tubeAlong(points: [number, number, number][], r: number) {
  return cachedGeometry(`tube:${points.flat().map((n) => n.toFixed(3)).join(',')}:${r}`, () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 48, r, 6, false)
  })
}
