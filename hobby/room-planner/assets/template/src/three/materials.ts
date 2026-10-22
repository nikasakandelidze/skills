import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Procedural PBR materials. Every texture is drawn on a canvas once and shared. UVs are in metres
// (see boxUV), so a texture's `repeat` is "tiles per metre" and patterns keep their real scale on
// parts of any size.

const textures = new Map<string, THREE.Texture>()
const materials = new Map<string, THREE.Material>()

function once<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = textures.get(key) as T | undefined
  if (!t) {
    t = make()
    textures.set(key, t)
  }
  return t
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** Tileable value noise in [0, 1]. */
function noise(size: number, cells: number, seed: number): Float32Array {
  const rand = rng(seed)
  const lattice = Array.from({ length: cells * cells }, rand)
  const out = new Float32Array(size * size)
  const smooth = (t: number) => t * t * (3 - 2 * t)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells
      const gy = (y / size) * cells
      const x0 = Math.floor(gx)
      const y0 = Math.floor(gy)
      const fx = smooth(gx - x0)
      const fy = smooth(gy - y0)
      const at = (i: number, j: number) => lattice[((j + cells) % cells) * cells + ((i + cells) % cells)]
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
      out[y * size + x] = a + (b - a) * fy
    }
  }
  return out
}

function fbm(size: number, baseCells: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size)
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const n = noise(size, baseCells * 2 ** o, seed + o * 101)
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp
    total += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function wrap(tex: THREE.Texture, repeatU: number, repeatV = repeatU, srgb = false) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatU, repeatV)
  tex.anisotropy = 8
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Turns a tileable height field into a tangent-space normal map. */
function normalFromHeight(h: Float32Array, w: number, hgt: number, strength: number) {
  const [c, ctx] = canvasOf(w, hgt)
  const img = ctx.createImageData(w, hgt)
  const at = (x: number, y: number) => h[((y + hgt) % hgt) * w + ((x + w) % w)]
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = (1 / len) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(c)
}

function grayFrom(values: Float32Array, w: number, h: number, lo: number, hi: number) {
  const [c, ctx] = canvasOf(w, h)
  const img = ctx.createImageData(w, h)
  for (let i = 0; i < values.length; i++) {
    const v = (lo + (hi - lo) * values[i]) * 255
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(c)
}

// ---------- texture recipes ----------

/** Plain-weave cloth: alternating warp and weft threads. */
function weave(period: number) {
  const size = period * 32
  const n = noise(size, 16, 3)
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / period)
      const cy = Math.floor(y / period)
      const fx = (x % period) / period
      const fy = (y % period) / period
      const warp = (cx + cy) % 2 === 0
      h[y * size + x] = (warp ? Math.sin(Math.PI * fx) : Math.sin(Math.PI * fy)) * 0.8 + n[y * size + x] * 0.2
    }
  }
  return { h, size }
}

const weaveNormal = (period: number, repeat: number) =>
  once(`weave-n-${period}-${repeat}`, () => {
    const { h, size } = weave(period)
    return wrap(normalFromHeight(h, size, size, 2.2), repeat)
  })

/** Soft blotches so large plain surfaces aren't perfectly uniform. */
const mottle = (repeat: number, lo = 0.86) =>
  once(`mottle-${repeat}-${lo}`, () => wrap(grayFrom(fbm(256, 4, 4, 9), 256, 256, lo, 1), repeat, repeat, true))

const roughnessNoise = (repeat: number, lo: number, hi: number) =>
  once(`rough-${repeat}-${lo}-${hi}`, () => wrap(grayFrom(fbm(256, 8, 4, 21), 256, 256, lo, hi), repeat))

/** Pebbled leather grain. */
const leatherNormal = () =>
  once('leather-n', () => {
    const size = 256
    const h = new Float32Array(size * size)
    const rand = rng(5)
    for (let k = 0; k < 1400; k++) {
      const cx = rand() * size
      const cy = rand() * size
      const r = 2 + rand() * 5
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const d = Math.hypot(x - cx, y - cy) / r
          if (d >= 1) continue
          const i = ((y + size) % size) * size + ((x + size) % size)
          h[i] = Math.max(h[i], Math.sqrt(1 - d * d))
        }
      }
    }
    return wrap(normalFromHeight(h, size, size, 1.6), 14)
  })

/** Wood with grain running along U. Colour is baked in. */
function woodMap(base: string) {
  return once(`wood-${base}`, () => {
    const w = 1024
    const h = 256
    const [c, ctx] = canvasOf(w, h)
    const img = ctx.createImageData(w, h)
    const col = new THREE.Color(base)
    const warp = noise(256, 8, 77)
    const fine = noise(256, 64, 78)
    const rand = rng(31)
    const pores = Array.from({ length: 900 }, () => [rand() * w, rand() * h, 6 + rand() * 30] as const)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wx = Math.floor((x / w) * 256) % 256
        const wy = Math.floor((y / h) * 256) % 256
        const bend = warp[wy * 256 + wx] * 14
        const ring = Math.sin(((y + bend) / h) * Math.PI * 2 * 9) * 0.5 + 0.5
        const streak = fine[wy * 256 + ((Math.floor(x / 4) % 256) + 256) % 256]
        const v = 0.86 + ring * 0.12 + (streak - 0.5) * 0.1
        const i = (y * w + x) * 4
        img.data[i] = Math.min(255, col.r * 255 * v * 1.02)
        img.data[i + 1] = Math.min(255, col.g * 255 * v)
        img.data[i + 2] = Math.min(255, col.b * 255 * v * 0.97)
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#000'
    for (const [px, py, len] of pores) ctx.fillRect(px, py, len, 1)
    // Gamma-encode: canvas pixels are treated as sRGB.
    const tex = new THREE.CanvasTexture(c)
    // 1 m of grain along U, 0.25 m across.
    return wrap(tex, 1, 4, true)
  })
}

/** See-through chair mesh: opaque threads around small holes. */
const meshAlpha = () =>
  once('mesh-alpha', () => {
    const size = 64
    const [c, ctx] = canvasOf(size, size)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#3a3a3a'
    const p = 8
    for (let y = 0; y < size; y += p) for (let x = 0; x < size; x += p) ctx.fillRect(x + 2, y + 2, p - 4, p - 4)
    return wrap(new THREE.CanvasTexture(c), 60)
  })

/** Linen-like wallpaper texture: uneven horizontal and vertical fibres. */
const linenNormal = () =>
  once('linen-n', () => {
    const size = 512
    const rand = rng(12)
    const rows = Array.from({ length: size }, rand)
    const cols = Array.from({ length: size }, rand)
    const n = noise(size, 64, 13)
    const h = new Float32Array(size * size)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = rows[y] * 0.45 + cols[x] * 0.35 + n[y * size + x] * 0.2
    return wrap(normalFromHeight(h, size, size, 0.9), 2.5)
  })

/** Short dense pile for rugs and the textile wall covering. */
const pileNormal = () =>
  once('pile-n', () => {
    const size = 256
    const h = fbm(size, 64, 2, 41)
    return wrap(normalFromHeight(h, size, size, 3), 10)
  })

/** A leaf silhouette (alpha) with a centre vein (colour). */
export const leafTextures = () => ({
  alpha: once('leaf-a', () => {
    const [c, ctx] = canvasOf(128, 256)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 128, 256)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(64, 250)
    ctx.bezierCurveTo(-10, 170, 10, 40, 64, 4)
    ctx.bezierCurveTo(118, 40, 138, 170, 64, 250)
    ctx.fill()
    return new THREE.CanvasTexture(c)
  }),
  map: once('leaf-c', () => {
    const [c, ctx] = canvasOf(128, 256)
    const g = ctx.createLinearGradient(0, 0, 128, 0)
    g.addColorStop(0, '#c9d9c0')
    g.addColorStop(0.5, '#ffffff')
    g.addColorStop(1, '#c9d9c0')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 256)
    ctx.strokeStyle = 'rgba(240,255,220,.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(64, 250)
    ctx.lineTo(64, 10)
    ctx.stroke()
    ctx.lineWidth = 1.5
    for (let y = 40; y < 230; y += 22) {
      ctx.beginPath()
      ctx.moveTo(64, y + 14)
      ctx.quadraticCurveTo(40, y + 4, 20, y - 10)
      ctx.moveTo(64, y + 14)
      ctx.quadraticCurveTo(88, y + 4, 108, y - 10)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }),
})

// ---------- floor ----------

function shade(hex: string, amount: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)))
  return `#${c.getHexString()}`
}

/** Oak strip parquet, 12.5 cm strips: colour, gap normals and roughness from the same layout. 2 m per tile. */
export function parquet(color: string) {
  const key = `parquet-${color}`
  const cachedMap = textures.get(key)
  if (cachedMap) return { map: cachedMap, normalMap: textures.get(`${key}-n`)!, roughnessMap: textures.get(`${key}-r`)! }
  const size = 1024
  const [c, ctx] = canvasOf(size, size)
  const heights = new Float32Array(size * size).fill(1)
  const rough = new Float32Array(size * size).fill(0.5)
  const rand = rng(7)
  const strips = 16
  const sw = size / strips
  const grain = noise(256, 32, 99)
  for (let col = 0; col < strips; col++) {
    let y = -Math.floor(rand() * size * 0.5)
    while (y < size) {
      const len = Math.floor(size * (0.28 + rand() * 0.4))
      const tone = (rand() - 0.5) * 0.1
      const grad = ctx.createLinearGradient(col * sw, 0, (col + 1) * sw, 0)
      grad.addColorStop(0, shade(color, tone - 0.015))
      grad.addColorStop(0.5, shade(color, tone + 0.01))
      grad.addColorStop(1, shade(color, tone - 0.02))
      for (const yy of [y, y + size]) {
        ctx.fillStyle = grad
        ctx.fillRect(col * sw, yy, sw, len)
      }
      const r = 0.35 + rand() * 0.25
      for (let py = Math.max(0, y); py < Math.min(size, y + len); py++) {
        for (let px = col * sw; px < (col + 1) * sw; px++) {
          rough[py * size + px] = r + grain[(py % 256) * 256 + (px % 256)] * 0.15
          // Slightly bevelled strip edges and end joints.
          const ex = Math.min(px - col * sw, (col + 1) * sw - 1 - px)
          const ey = Math.min(py - y, y + len - 1 - py)
          const e = Math.min(ex, ey)
          if (e < 2) heights[py * size + px] = e * 0.4
        }
      }
      y += len
    }
  }
  ctx.globalAlpha = 0.06
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#000' : '#fff'
    ctx.fillRect(Math.floor(rand() * strips) * sw + rand() * sw, rand() * size, 1 + rand() * 1.5, 20 + rand() * 120)
  }
  ctx.globalAlpha = 1
  const map = wrap(new THREE.CanvasTexture(c), 0.5, 0.5, true)
  const normalMap = wrap(normalFromHeight(heights, size, size, 1.2), 0.5)
  const roughnessMap = wrap(grayFrom(rough, size, size, 0, 1), 0.5)
  textures.set(key, map)
  textures.set(`${key}-n`, normalMap)
  textures.set(`${key}-r`, roughnessMap)
  return { map, normalMap, roughnessMap }
}

// ---------- materials ----------

export type MatKind =
  | 'fabric'
  | 'upholstery'
  | 'leather'
  | 'wood'
  | 'laminate'
  | 'metal'
  | 'chrome'
  | 'paintedMetal'
  | 'plastic'
  | 'gloss'
  | 'mesh'
  | 'rubber'
  | 'paper'
  | 'ceramic'
  | 'glass'
  | 'wallpaper'
  | 'textileWall'
  | 'rug'
  | 'soil'
  | 'emissive'
  | 'cloth'
  | 'innerGloss'
  | 'leaf'
  | 'velvet'
  | 'boucle'
  | 'sheer'
  | 'semiSheer'

export function material(kind: MatKind, color: string): THREE.Material {
  const key = `${kind}:${color}`
  const hit = materials.get(key)
  if (hit) return hit
  const c = new THREE.Color(color)
  const sheen = c.clone().lerp(new THREE.Color('#ffffff'), 0.35)
  let m: THREE.Material
  switch (kind) {
    case 'fabric':
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(3, 0.96), normalMap: weaveNormal(6, 30), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.95, sheen: 0.6, sheenRoughness: 0.75, sheenColor: sheen })
      break
    case 'upholstery':
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(2), normalMap: weaveNormal(8, 16), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.98, sheen: 0.8, sheenRoughness: 0.6, sheenColor: sheen })
      break
    case 'leather':
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(2, 0.9), normalMap: leatherNormal(), normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.5, roughnessMap: roughnessNoise(3, 0.75, 1), clearcoat: 0.35, clearcoatRoughness: 0.45, sheen: 0.25, sheenColor: sheen })
      break
    case 'wood':
      m = new THREE.MeshPhysicalMaterial({ map: woodMap(color), roughness: 0.55, roughnessMap: roughnessNoise(4, 0.8, 1), clearcoat: 0.25, clearcoatRoughness: 0.35 })
      break
    case 'laminate':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, roughnessMap: roughnessNoise(5, 0.75, 1), clearcoat: 0.1, clearcoatRoughness: 0.5 })
      break
    case 'metal':
      m = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.38, roughnessMap: roughnessNoise(8, 0.8, 1) })
      break
    case 'chrome':
      m = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.12 })
      break
    case 'paintedMetal':
      m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 })
      break
    case 'plastic':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, roughnessMap: roughnessNoise(6, 0.85, 1), clearcoat: 0.08 })
      break
    case 'gloss':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.15 })
      break
    case 'mesh':
      m = new THREE.MeshStandardMaterial({ color, alphaMap: meshAlpha(), transparent: true, side: THREE.DoubleSide, roughness: 0.85, depthWrite: true })
      break
    case 'rubber':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
      break
    case 'paper':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, map: mottle(6, 0.92) })
      break
    case 'ceramic':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, map: mottle(4, 0.9) })
      break
    case 'glass':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false })
      break
    case 'wallpaper':
      m = new THREE.MeshStandardMaterial({ color, map: mottle(1.2, 0.93), normalMap: linenNormal(), normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.92 })
      break
    case 'textileWall':
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(1, 0.9), normalMap: pileNormal(), normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.95, sheen: 0.5, sheenRoughness: 0.8, sheenColor: sheen })
      break
    case 'rug':
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(2, 0.82), normalMap: pileNormal(), normalScale: new THREE.Vector2(1, 1), roughness: 1, sheen: 1, sheenRoughness: 0.9, sheenColor: sheen })
      break
    case 'soil':
      m = new THREE.MeshStandardMaterial({ color, roughness: 1, normalMap: pileNormal() })
      break
    case 'emissive':
      m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, toneMapped: true })
      break
    case 'cloth':
      // Thin single-surface fabric seen from both sides: duvets, curtains.
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(2, 0.97), normalMap: weaveNormal(6, 30), normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.95, sheen: 0.7, sheenRoughness: 0.7, sheenColor: sheen, side: THREE.DoubleSide })
      break
    case 'innerGloss':
      m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, side: THREE.BackSide, emissive: color, emissiveIntensity: 0.25 })
      break
    case 'velvet':
      // Velvet: dark in the folds, a soft bright sheen where light grazes it.
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(2, 0.92), normalMap: pileNormal(), normalScale: new THREE.Vector2(0.15, 0.15), roughness: 0.75, sheen: 1, sheenRoughness: 0.32, sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.55) })
      break
    case 'boucle':
      // Teddy / bouclé: deep, fuzzy, matte loops.
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(4, 0.88), normalMap: pileNormal(), normalScale: new THREE.Vector2(1.6, 1.6), roughness: 1, sheen: 0.8, sheenRoughness: 0.9, sheenColor: sheen })
      break
    case 'sheer':
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(2, 0.95), normalMap: weaveNormal(6, 30), normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.9, sheen: 0.5, sheenColor: sheen, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
      break
    case 'semiSheer':
      m = new THREE.MeshPhysicalMaterial({ color, map: mottle(2, 0.95), normalMap: weaveNormal(6, 30), normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.92, sheen: 0.6, sheenColor: sheen, transparent: true, opacity: 0.86, side: THREE.DoubleSide })
      break
    case 'leaf': {
      const { alpha, map } = leafTextures()
      m = new THREE.MeshStandardMaterial({ color: '#ffffff', map, alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 })
      break
    }
  }
  materials.set(key, m)
  return m
}

// ---------- geometry ----------

const geometries = new Map<string, THREE.BufferGeometry>()

/**
 * Box-projected UVs in metres. Each face takes the two axes it spans; the axis along the part's
 * longest side becomes U, so wood grain runs the length of a board.
 */
export function boxUV(geo: THREE.BufferGeometry, dims: [number, number, number]) {
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i))
    const ay = Math.abs(nor.getY(i))
    const az = Math.abs(nor.getZ(i))
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)]
    let axes: [number, number]
    if (ax >= ay && ax >= az) axes = [2, 1]
    else if (ay >= az) axes = [0, 2]
    else axes = [0, 1]
    if (dims[axes[1]] > dims[axes[0]]) axes = [axes[1], axes[0]]
    uv[i * 2] = p[axes[0]]
    uv[i * 2 + 1] = p[axes[1]]
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

export function boxGeometry(w: number, h: number, d: number, radius = 0): THREE.BufferGeometry {
  const r = Math.max(0, Math.min(radius, Math.min(w, h, d) / 2 - 0.0005))
  const key = `box:${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}:${r.toFixed(4)}`
  let g = geometries.get(key)
  if (!g) {
    g = r > 0.001 ? new RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d)
    boxUV(g, [w, h, d])
    geometries.set(key, g)
  }
  return g
}

export function cachedGeometry(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key)
  if (!g) {
    g = make()
    geometries.set(key, g)
  }
  return g
}
