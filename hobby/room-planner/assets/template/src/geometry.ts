import { isSoft, isWallShape } from './shapes'
import type { Item, Opening, Room, Size, WallId } from './types'

export type Vec2 = [number, number]

export const WALLS: WallId[] = ['north', 'east', 'south', 'west']

export const WALL_LABELS: Record<WallId, string> = {
  north: 'North wall (desk wall)',
  east: 'East wall (door)',
  south: 'South wall (bookshelf)',
  west: 'West wall (bed side)',
}

/** Distance within which a dragged item snaps flush against a wall. */
const SNAP = 6

export function normRot(rot: number) {
  return ((Math.round(rot) % 360) + 360) % 360
}

export function wallLength(room: Room, wall: WallId) {
  return wall === 'north' || wall === 'south' ? room.width : room.depth
}

/**
 * A wall's local frame: `origin` is its left end (seen from inside the room), `dir` runs
 * along it to the right, `normal` points into the room.
 */
export function wallFrame(room: Room, wall: WallId): { origin: Vec2; dir: Vec2; normal: Vec2; length: number } {
  const { width: W, depth: D } = room
  switch (wall) {
    case 'north':
      return { origin: [0, 0], dir: [1, 0], normal: [0, 1], length: W }
    case 'east':
      return { origin: [W, 0], dir: [0, 1], normal: [-1, 0], length: D }
    case 'south':
      return { origin: [W, D], dir: [-1, 0], normal: [0, -1], length: W }
    case 'west':
      return { origin: [0, D], dir: [0, -1], normal: [1, 0], length: D }
  }
}

export function wallPoint(room: Room, wall: WallId, along: number, out = 0): Vec2 {
  const f = wallFrame(room, wall)
  return [f.origin[0] + f.dir[0] * along + f.normal[0] * out, f.origin[1] + f.dir[1] * along + f.normal[1] * out]
}

/** three.js Y rotation that turns an object's local +Z (its front) to face into the room from this wall. */
export const WALL_ROT_Y: Record<WallId, number> = {
  north: 0,
  east: -Math.PI / 2,
  south: Math.PI,
  west: Math.PI / 2,
}

export function rotatedRect(cx: number, cz: number, w: number, d: number, rotDeg: number): Vec2[] {
  const t = (rotDeg * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return (
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ] as Vec2[]
  ).map(([lx, lz]) => [cx + lx * c - lz * s, cz + lx * s + lz * c])
}

/** The item's outline on the floor plan. */
export function footprint(room: Room, item: Item): Vec2[] {
  const { w, d } = item.size
  const p = item.place
  if (p.type === 'floor') return rotatedRect(p.x, p.z, w, d, p.rot)
  const a = p.along - w / 2
  const b = p.along + w / 2
  return [wallPoint(room, p.wall, a, 0), wallPoint(room, p.wall, b, 0), wallPoint(room, p.wall, b, d), wallPoint(room, p.wall, a, d)]
}

export function aabb(poly: Vec2[]) {
  const xs = poly.map((p) => p[0])
  const zs = poly.map((p) => p[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

export function verticalRange(item: Item): [number, number] {
  return item.place.type === 'floor' ? [0, item.size.h] : [item.place.elev, item.place.elev + item.size.h]
}

/** Penetration depth of two convex polygons (separating axis test); 0 when they don't overlap. */
export function overlapDepth(a: Vec2[], b: Vec2[]): number {
  let min = Infinity
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i]
      const p2 = poly[(i + 1) % poly.length]
      const nx = -(p2[1] - p1[1])
      const nz = p2[0] - p1[0]
      const len = Math.hypot(nx, nz) || 1
      const ax = nx / len
      const az = nz / len
      const project = (poly: Vec2[]) => {
        const vals = poly.map((p) => p[0] * ax + p[1] * az)
        return [Math.min(...vals), Math.max(...vals)]
      }
      const [aMin, aMax] = project(a)
      const [bMin, bMax] = project(b)
      const o = Math.min(aMax, bMax) - Math.max(aMin, bMin)
      if (o <= 0) return 0
      min = Math.min(min, o)
    }
  }
  return min
}

export function wallDistances(room: Room, item: Item) {
  const box = aabb(footprint(room, item))
  return { west: box.minX, east: room.width - box.maxX, north: box.minZ, south: room.depth - box.maxZ }
}

/** Keeps a floor item inside the room and snaps it flush to walls it's dragged close to. */
export function clampFloor(room: Room, item: Item, x: number, z: number) {
  if (item.place.type !== 'floor') return { x, z }
  const box = aabb(rotatedRect(0, 0, item.size.w, item.size.d, item.place.rot))
  const halfW = (box.maxX - box.minX) / 2
  const halfD = (box.maxZ - box.minZ) / 2
  const fit = (v: number, half: number, max: number) => {
    if (half * 2 >= max) return max / 2
    let out = Math.min(Math.max(v, half), max - half)
    if (out - half < SNAP) out = half
    if (max - half - out < SNAP) out = max - half
    return out
  }
  return { x: Math.round(fit(x, halfW, room.width)), z: Math.round(fit(z, halfD, room.depth)) }
}

export function clampWall(room: Room, size: Size, wall: WallId, along: number, elev: number) {
  const L = wallLength(room, wall)
  const a = size.w >= L ? L / 2 : Math.min(Math.max(along, size.w / 2), L - size.w / 2)
  const e = Math.min(Math.max(elev, 0), Math.max(0, room.height - size.h))
  return { along: Math.round(a), elev: Math.round(e) }
}

/** Closest wall to a plan point, and how far along it the point sits. */
export function nearestWall(room: Room, x: number, z: number): { wall: WallId; along: number } {
  const candidates: { wall: WallId; dist: number; along: number }[] = [
    { wall: 'north', dist: Math.abs(z), along: x },
    { wall: 'south', dist: Math.abs(room.depth - z), along: room.width - x },
    { wall: 'west', dist: Math.abs(x), along: room.depth - z },
    { wall: 'east', dist: Math.abs(room.width - x), along: z },
  ]
  candidates.sort((a, b) => a.dist - b.dist)
  return candidates[0]
}

export interface WallPiece {
  from: number
  to: number
  y0: number
  y1: number
  color: string
  /** Covered by a wall finish (the brown panelling) rather than the plain wall colour. */
  finish: boolean
}

/** Splits a wall into solid boxes around its openings, each with a single finish colour. */
export function wallPieces(room: Room, wall: WallId): WallPiece[] {
  const L = wallLength(room, wall)
  const H = room.height
  const finishes = room.finishes.filter((f) => f.wall === wall)
  const openings = room.openings.filter((o) => o.wall === wall)
  const cuts = new Set<number>([0, L])
  const clamp = (v: number) => Math.min(Math.max(v, 0), L)
  finishes.forEach((f) => (cuts.add(clamp(f.from)), cuts.add(clamp(f.to))))
  openings.forEach((o) => (cuts.add(clamp(o.along - o.width / 2)), cuts.add(clamp(o.along + o.width / 2))))
  const sorted = [...cuts].sort((a, b) => a - b)
  const pieces: WallPiece[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i]
    const to = sorted[i + 1]
    if (to - from < 0.1) continue
    const mid = (from + to) / 2
    const finish = finishes.find((f) => mid > f.from && mid < f.to)
    const color = finish?.color ?? room.wallColor
    const opening = openings.find((o) => mid > o.along - o.width / 2 && mid < o.along + o.width / 2)
    if (!opening) {
      pieces.push({ from, to, y0: 0, y1: H, color, finish: !!finish })
      continue
    }
    if (opening.sill > 0) pieces.push({ from, to, y0: 0, y1: opening.sill, color, finish: !!finish })
    const top = opening.sill + opening.height
    if (top < H) pieces.push({ from, to, y0: top, y1: H, color, finish: !!finish })
  }
  return pieces
}

export interface FitIssue {
  severity: 'error' | 'warn'
  message: string
  otherId?: string
}

function openingZone(room: Room, o: Opening, depth: number): Vec2[] {
  const a = o.along - o.width / 2
  const b = o.along + o.width / 2
  return [wallPoint(room, o.wall, a, 0), wallPoint(room, o.wall, b, 0), wallPoint(room, o.wall, b, depth), wallPoint(room, o.wall, a, depth)]
}

/** Everything that doesn't fit: overlaps, sticking out of the room, blocking the door or a window. */
export function fitIssues(room: Room, items: Item[]): Map<string, FitIssue[]> {
  const issues = new Map<string, FitIssue[]>()
  const add = (id: string, issue: FitIssue) => issues.set(id, [...(issues.get(id) ?? []), issue])
  const visible = items.filter((i) => !i.hidden)
  const polys = new Map(visible.map((i) => [i.id, footprint(room, i)]))

  for (const item of visible) {
    const poly = polys.get(item.id)!
    const p = item.place
    if (p.type === 'floor') {
      const box = aabb(poly)
      const over = Math.max(-box.minX, -box.minZ, box.maxX - room.width, box.maxZ - room.depth)
      if (over > 0.5) add(item.id, { severity: 'error', message: `Sticks out of the room by ${Math.round(over)} cm` })
      if (item.size.h > room.height) add(item.id, { severity: 'error', message: `Taller than the ceiling (${room.height} cm)` })
      if (!isSoft(item.shape)) {
        for (const o of room.openings) {
          // A wide door is a double door: each leaf sweeps half the width.
          const swing = o.width > 100 ? o.width / 2 : o.width
          if (o.kind === 'door' && overlapDepth(poly, openingZone(room, o, swing)) > 1) {
            add(item.id, { severity: 'warn', message: `In the way of the ${o.label?.toLowerCase() ?? 'door'}` })
          }
          if (o.kind === 'window' && item.size.h > o.sill + 10 && overlapDepth(poly, openingZone(room, o, 25)) > 1) {
            add(item.id, { severity: 'warn', message: `Blocks part of the ${o.label?.toLowerCase() ?? 'window'}` })
          }
        }
      }
    } else {
      const L = wallLength(room, p.wall)
      if (p.along - item.size.w / 2 < -0.5 || p.along + item.size.w / 2 > L + 0.5)
        add(item.id, { severity: 'error', message: 'Runs past the end of the wall' })
      if (p.elev + item.size.h > room.height + 0.5) add(item.id, { severity: 'error', message: 'Goes above the ceiling' })
      if (item.shape !== 'curtain' && item.shape !== 'radiator') {
        for (const o of room.openings.filter((o) => o.wall === p.wall)) {
          const alongOverlap = Math.min(p.along + item.size.w / 2, o.along + o.width / 2) - Math.max(p.along - item.size.w / 2, o.along - o.width / 2)
          const vertOverlap = Math.min(p.elev + item.size.h, o.sill + o.height) - Math.max(p.elev, o.sill)
          if (alongOverlap > 1 && vertOverlap > 1) add(item.id, { severity: 'error', message: `Hangs over the ${o.label?.toLowerCase() ?? 'opening'}` })
        }
      }
    }
  }

  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i]
      const b = visible[j]
      if (isSoft(a.shape) || isSoft(b.shape)) continue
      const [a0, a1] = verticalRange(a)
      const [b0, b1] = verticalRange(b)
      if (Math.min(a1, b1) - Math.max(a0, b0) <= 0.5) continue
      const depth = overlapDepth(polys.get(a.id)!, polys.get(b.id)!)
      if (depth <= 0.5) continue
      const cm = Math.max(1, Math.round(depth))
      add(a.id, { severity: 'error', message: `Overlaps ${b.name} by ${cm} cm`, otherId: b.id })
      add(b.id, { severity: 'error', message: `Overlaps ${a.name} by ${cm} cm`, otherId: a.id })
    }
  }
  return issues
}

export function isWallItem(item: Item) {
  return item.place.type === 'wall' || isWallShape(item.shape)
}
