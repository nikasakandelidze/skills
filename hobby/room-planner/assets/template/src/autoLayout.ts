import { aabb, clampFloor, fitIssues, footprint, overlapDepth, verticalRange, wallLength, wallPoint, WALLS, type Vec2 } from './geometry'
import { defaultRoom } from './defaultState'
import { categoryOf } from './shop'
import { isSoft } from './shapes'
import type { FloorPlacement, Item, Room, WallId } from './types'

// Automatic layouts: try many random-but-sensible arrangements of the furniture you have, score
// each one like a person would (can I walk from the door to the bed and desk? how much open
// floor is left? is the desk near daylight? is anything blocking a window?), and keep the best
// few that are actually different from each other.

export interface AutoLayout {
  id: string
  title: string
  perks: string[]
  score: number
  items: Item[]
}

/** "poster wall", "door wall"…: the room's own names if it has them, else named after what's on the wall. */
function wallName(room: Room, wall: WallId) {
  const named = room.wallNames?.[wall] ?? defaultRoom.wallNames?.[wall]
  if (named) return named
  const on = room.openings.filter((o) => o.wall === wall)
  if (on.some((o) => o.kind === 'door')) return 'door wall'
  if (on.some((o) => o.kind === 'window')) return 'window wall'
  return `${wall} wall`
}

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function doorZones(room: Room): Vec2[][] {
  return room.openings
    .filter((o) => o.kind === 'door')
    .map((o) => {
      const depth = o.width > 100 ? o.width / 2 : o.width
      return [wallPoint(room, o.wall, o.along - o.width / 2, 0), wallPoint(room, o.wall, o.along + o.width / 2, 0), wallPoint(room, o.wall, o.along + o.width / 2, depth), wallPoint(room, o.wall, o.along - o.width / 2, depth)]
    })
}

function clashes(room: Room, item: Item, others: Item[], doors: Vec2[][]) {
  const poly = footprint(room, item)
  const box = aabb(poly)
  if (box.minX < -0.5 || box.minZ < -0.5 || box.maxX > room.width + 0.5 || box.maxZ > room.depth + 0.5) return true
  if (isSoft(item.shape)) return false
  if (doors.some((z) => overlapDepth(poly, z) > 1)) return true
  const [a0, a1] = verticalRange(item)
  return others.some((o) => {
    if (o.id === item.id || o.hidden || isSoft(o.shape)) return false
    const [b0, b1] = verticalRange(o)
    if (Math.min(a1, b1) - Math.max(a0, b0) <= 0.5) return false
    return overlapDepth(poly, footprint(room, o)) > 0.5
  })
}

function fit(room: Room, item: Item, p: FloorPlacement): FloorPlacement {
  return { ...p, ...clampFloor(room, { ...item, place: p }, p.x, p.z) }
}

/** Nearest free spot within ~1 m, or null. */
function settle(room: Room, item: Item, want: FloorPlacement, placed: Item[], doors: Vec2[][]): FloorPlacement | null {
  for (let r = 0; r <= 100; r += 10) {
    const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 12)
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2
      const p = fit(room, item, { ...want, x: want.x + Math.cos(a) * r, z: want.z + Math.sin(a) * r })
      if (!clashes(room, { ...item, place: p }, placed, doors)) return p
    }
  }
  return null
}

const ROT: Record<WallId, number> = { north: 0, east: 90, south: 180, west: 270 }

/** Back against `wall`, at a random spot along it. */
function onWall(room: Room, item: Item, wall: WallId, rand: () => number, gap = 0): FloorPlacement {
  const L = wallLength(room, wall)
  const along = item.size.w / 2 + rand() * Math.max(0, L - item.size.w)
  const [x, z] = wallPoint(room, wall, along, item.size.d / 2 + gap)
  return fit(room, item, { type: 'floor', x, z, rot: ROT[wall] })
}

function inFront(room: Room, target: Item, item: Item, gap: number): FloorPlacement | null {
  if (target.place.type !== 'floor') return null
  const r = (target.place.rot * Math.PI) / 180
  const reach = target.size.d / 2 + gap + item.size.d / 2
  return fit(room, item, { type: 'floor', x: target.place.x - Math.sin(r) * reach, z: target.place.z + Math.cos(r) * reach, rot: (target.place.rot + 180) % 360 })
}

function beside(room: Room, target: Item, item: Item, side: 1 | -1): FloorPlacement | null {
  if (target.place.type !== 'floor') return null
  const r = (target.place.rot * Math.PI) / 180
  // Along the target's width, level with its back.
  const along = side * (target.size.w / 2 + item.size.w / 2 + 4)
  const back = -target.size.d / 2 + item.size.d / 2
  const x = target.place.x + along * Math.cos(r) - back * Math.sin(r)
  const z = target.place.z + along * Math.sin(r) + back * Math.cos(r)
  return fit(room, item, { type: 'floor', x, z, rot: target.place.rot })
}

function wallOf(room: Room, item: Item): WallId | null {
  const b = aabb(footprint(room, item))
  const gaps: [WallId, number][] = [
    ['north', b.minZ],
    ['south', room.depth - b.maxZ],
    ['west', b.minX],
    ['east', room.width - b.maxX],
  ]
  gaps.sort((a, b) => a[1] - b[1])
  return gaps[0][1] < 8 ? gaps[0][0] : null
}

/** Free floor, reachability from the door, daylight at the desk, windows kept clear. */
function score(room: Room, items: Item[]) {
  const cell = 10
  const cols = Math.ceil(room.width / cell)
  const rows = Math.ceil(room.depth / cell)
  const solid = items.filter((i) => !i.hidden && i.place.type === 'floor' && !isSoft(i.shape)).map((i) => footprint(room, i))
  const inside = (p: Vec2, poly: Vec2[]) => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i]
      const [xj, zj] = poly[j]
      if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c
    }
    return c
  }
  // Blocked cells, grown by ~25 cm so a "walkable" path has shoulder room.
  const blocked = new Uint8Array(cols * rows)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p: Vec2 = [(c + 0.5) * cell, (r + 0.5) * cell]
      if (solid.some((poly) => inside(p, poly))) blocked[r * cols + c] = 1
    }
  const free = blocked.reduce((n, b) => n + (b ? 0 : 1), 0) / blocked.length
  const grown = new Uint8Array(blocked)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (blocked[r * cols + c])
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr
            const cc = c + dc
            if (rr >= 0 && cc >= 0 && rr < rows && cc < cols && dr * dr + dc * dc <= 5) grown[rr * cols + cc] = 1
          }
  // Walk from the door.
  const door = room.openings.find((o) => o.kind === 'door')
  const reach = new Uint8Array(cols * rows)
  if (door) {
    const [sx, sz] = wallPoint(room, door.wall, door.along, 35)
    const start = Math.min(rows - 1, Math.floor(sz / cell)) * cols + Math.min(cols - 1, Math.floor(sx / cell))
    const queue = [start]
    reach[start] = 1
    while (queue.length) {
      const i = queue.pop()!
      const r = Math.floor(i / cols)
      const c = i % cols
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const rr = r + dr
        const cc = c + dc
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue
        const n = rr * cols + cc
        if (reach[n] || grown[n]) continue
        reach[n] = 1
        queue.push(n)
      }
    }
  }
  const reachable = (item?: Item) => {
    if (!item || item.place.type !== 'floor' || !door) return true
    const b = aabb(footprint(room, item))
    for (let r = Math.max(0, Math.floor((b.minZ - 45) / cell)); r <= Math.min(rows - 1, Math.floor((b.maxZ + 45) / cell)); r++)
      for (let c = Math.max(0, Math.floor((b.minX - 45) / cell)); c <= Math.min(cols - 1, Math.floor((b.maxX + 45) / cell)); c++) if (reach[r * cols + c]) return true
    return false
  }
  const find = (cat: string) => items.find((i) => !i.hidden && i.place.type === 'floor' && categoryOf(i) === cat)
  const bed = find('bed')
  const desk = find('desk')
  const sofa = find('sofa') ?? find('armchair')

  let total = free * 60
  const perks: string[] = []
  for (const it of [bed, desk, sofa]) total += reachable(it) ? 10 : -25
  const errors = [...fitIssues(room, items).values()].flat().filter((i) => i.severity === 'error').length
  total -= errors * 40
  const windows = room.openings.filter((o) => o.kind === 'window')
  if (desk && desk.place.type === 'floor') {
    const dp = desk.place
    const near = windows.some((o) => {
      const [wx, wz] = wallPoint(room, o.wall, o.along, 0)
      return Math.hypot(wx - dp.x, wz - dp.z) < o.width / 2 + desk.size.d + 60
    })
    if (near) {
      total += 10
      perks.push('Desk in daylight')
    }
  }
  const blocksWindow = [...fitIssues(room, items).values()].flat().filter((i) => /window/.test(i.message)).length
  total -= blocksWindow * 8
  if (!blocksWindow) perks.push('Windows clear')
  if (free > 0.6) perks.push('Lots of open floor')
  return { total, perks, free }
}

/** Builds one candidate arrangement. */
function arrangeRandom(room: Room, items: Item[], rand: () => number): Item[] | null {
  const doors = doorZones(room)
  const result = items.map((i) => ({ ...i }))
  const movable = result.filter((i) => i.place.type === 'floor' && !i.hidden && !i.fixture)
  const placed: Item[] = result.filter((i) => i.place.type === 'wall' || i.hidden || i.fixture)
  const done = new Set<string>()
  const put = (item: Item, want: FloorPlacement | null) => {
    if (!want) return false
    const p = settle(room, item, want, placed, doors)
    if (!p) return false
    item.place = p
    placed.push(item)
    done.add(item.id)
    return true
  }
  const pickWall = (item: Item, prefer?: WallId[]) => {
    const fits = WALLS.filter((w) => wallLength(room, w) >= item.size.w + 10)
    const pool = prefer?.filter((w) => fits.includes(w)).length && rand() < 0.6 ? prefer.filter((w) => fits.includes(w)) : fits
    return pool[Math.floor(rand() * pool.length)]
  }
  const of = (cat: string) => movable.filter((i) => categoryOf(i) === cat)
  const windowWalls = room.openings.filter((o) => o.kind === 'window').map((o) => o.wall)

  // Biggest first: they decide the room.
  for (const bed of of('bed')) {
    let ok = false
    for (let t = 0; t < 6 && !ok; t++) ok = put(bed, onWall(room, bed, pickWall(bed), rand))
    if (!ok) return null
    for (const [n, side] of of('nightstand').map((n, i) => [n, i % 2 ? 1 : -1] as const)) put(n, beside(room, bed, n, side))
  }
  for (const desk of of('desk')) {
    let ok = false
    for (let t = 0; t < 6 && !ok; t++) ok = put(desk, onWall(room, desk, pickWall(desk, windowWalls), rand))
    if (!ok) return null
    const chair = movable
      .filter((i) => categoryOf(i) === 'officeChair' && !done.has(i.id))
      .sort((a, b) => Math.abs(a.size.h - 120) - Math.abs(b.size.h - 120))[0]
    if (chair) put(chair, inFront(room, desk, chair, 6))
  }
  const big = movable
    .filter((i) => !done.has(i.id) && !isSoft(i.shape) && ['sofa', 'armchair', 'bookshelf', 'wardrobe', 'dresser'].includes(categoryOf(i) ?? ''))
    .sort((a, b) => b.size.w * b.size.d - a.size.w * a.size.d)
  for (const item of big) {
    let ok = false
    for (let t = 0; t < 8 && !ok; t++) ok = put(item, onWall(room, item, pickWall(item), rand))
    if (!ok) return null
  }
  // Lamps next to somewhere you sit or sleep; everything else along the walls.
  for (const item of movable.filter((i) => !done.has(i.id) && !isSoft(i.shape))) {
    let want: FloorPlacement | null = null
    if (categoryOf(item) === 'floorLamp') {
      const host = placed.filter((p) => ['bed', 'sofa', 'armchair', 'desk'].includes(categoryOf(p) ?? ''))[Math.floor(rand() * 3)]
      if (host) want = beside(room, host, item, rand() < 0.5 ? 1 : -1)
    }
    let ok = false
    for (let t = 0; t < 8 && !ok; t++) ok = put(item, want && t === 0 ? want : onWall(room, item, pickWall(item), rand))
    if (!ok) return null
  }
  // Rugs go where there's the most floor, usually by the sofa or beside the bed.
  for (const rug of movable.filter((i) => !done.has(i.id))) {
    const host = placed.find((p) => ['sofa', 'armchair', 'bed'].includes(categoryOf(p) ?? ''))
    const want = host ? inFront(room, host, rug, -rug.size.d * 0.25) : fit(room, rug, { type: 'floor', x: room.width / 2, z: room.depth / 2, rot: 0 })
    rug.place = want ?? rug.place
  }
  return result
}

function describe(room: Room, items: Item[]) {
  const find = (cat: string) => items.find((i) => !i.hidden && i.place.type === 'floor' && categoryOf(i) === cat)
  const bed = find('bed')
  const desk = find('desk')
  const sofa = find('sofa') ?? find('armchair')
  const bw = bed ? wallOf(room, bed) : null
  const dw = desk ? wallOf(room, desk) : null
  const sw = sofa ? wallOf(room, sofa) : null
  const parts: string[] = []
  if (bed) parts.push(bw ? `Bed on the ${wallName(room, bw)}` : 'Bed out in the room')
  if (desk) parts.push(dw && dw === bw ? 'desk beside it' : dw ? `desk on the ${wallName(room, dw)}` : 'desk in the middle')
  const extra = sofa && sw ? `${sofa.shape === 'sofa' && sofa.size.w < 115 ? 'armchair' : 'sofa'} on the ${wallName(room, sw)}` : ''
  const title = parts.join(', ')
  return { title: title ? title[0].toUpperCase() + title.slice(1) : 'A new arrangement', extra, signature: `${bw}|${dw}|${sw}` }
}

/**
 * Generates `count` good, different layouts. Works in small batches so the page stays responsive;
 * `onProgress` gets 0..1.
 */
export async function generateLayouts(room: Room, items: Item[], seed: number, count = 4, tries = 70, onProgress?: (p: number) => void): Promise<AutoLayout[]> {
  const rand = rng(seed)
  const found: (AutoLayout & { signature: string })[] = []
  for (let i = 0; i < tries; i++) {
    const arranged = arrangeRandom(room, items, rand)
    if (arranged) {
      const { total, perks } = score(room, arranged)
      const { title, extra, signature } = describe(room, arranged)
      found.push({ id: `auto-${seed}-${i}`, title, perks: extra ? [extra[0].toUpperCase() + extra.slice(1), ...perks] : perks, score: total, items: arranged, signature })
    }
    if (i % 6 === 5) {
      onProgress?.(i / tries)
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  found.sort((a, b) => b.score - a.score)
  const picked: AutoLayout[] = []
  const seen = new Set<string>()
  for (const f of found) {
    if (seen.has(f.signature)) continue
    seen.add(f.signature)
    picked.push(f)
    if (picked.length === count) break
  }
  onProgress?.(1)
  return picked
}
