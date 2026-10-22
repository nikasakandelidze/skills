import {
  aabb,
  clampFloor,
  clampWall,
  footprint,
  isWallItem,
  overlapDepth,
  rotatedRect,
  verticalRange,
  wallLength,
  WALLS,
} from './geometry'
import { isSoft, isWallShape } from './shapes'
import type { CatalogEntry, Item, Placement, Room, Size, WallId, WallShape } from './types'

export function newId(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'item'
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`
}

function defaultElev(shape: WallShape, size: Size, room: Room, style?: string) {
  if (style?.startsWith('lean')) return 0
  switch (shape) {
    case 'curtain':
      return 0
    case 'radiator':
      return 12
    case 'ac':
      return Math.max(0, room.height - size.h - 12)
    case 'wallShelf':
      return 140
    case 'mirror':
      return Math.max(0, 160 - size.h / 2 - 20)
    default:
      // Eye level: centre of the picture at about 150 cm.
      return Math.max(0, Math.round(150 - size.h / 2))
  }
}

function collides(room: Room, candidate: Item, others: Item[]) {
  if (isSoft(candidate.shape)) return false
  const poly = footprint(room, candidate)
  const [c0, c1] = verticalRange(candidate)
  return others.some((o) => {
    if (o.hidden || isSoft(o.shape)) return false
    const [o0, o1] = verticalRange(o)
    if (Math.min(c1, o1) - Math.max(c0, o0) <= 0) return false
    return overlapDepth(poly, footprint(room, o)) > 0.5
  })
}

function wallItemFree(room: Room, candidate: Item, others: Item[]) {
  const p = candidate.place
  if (p.type !== 'wall') return true
  const onOpening = room.openings.some((o) => {
    if (o.wall !== p.wall || candidate.shape === 'curtain') return false
    const along = Math.min(p.along + candidate.size.w / 2, o.along + o.width / 2) - Math.max(p.along - candidate.size.w / 2, o.along - o.width / 2)
    const vert = Math.min(p.elev + candidate.size.h, o.sill + o.height) - Math.max(p.elev, o.sill)
    return along > 0 && vert > 0
  })
  return !onOpening && !collides(room, candidate, others)
}

/** Finds a sensible free spot for something new: next to the selection, or near the middle of the room. */
export function placeNew(room: Room, entry: Omit<CatalogEntry, 'id'>, items: Item[], near?: Item | null): Placement {
  const base: Item = { ...entry, id: '__candidate', place: { type: 'floor', x: 0, z: 0, rot: 0 } }

  if (isWallShape(entry.shape)) {
    const nearWall = near?.place.type === 'wall' ? near.place.wall : undefined
    const walls: WallId[] = nearWall ? [nearWall, ...WALLS.filter((w) => w !== nearWall)] : ['north', 'south', 'east', 'west']
    const elev = defaultElev(entry.shape, entry.size, room, entry.style)
    for (const wall of walls) {
      const L = wallLength(room, wall)
      const start = near?.place.type === 'wall' && near.place.wall === wall ? near.place.along : L / 2
      for (let step = 0; step < L / 5; step++) {
        const offset = (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * 5
        const { along, elev: e } = clampWall(room, entry.size, wall, start + offset, elev)
        const candidate = { ...base, place: { type: 'wall' as const, wall, along, elev: e } }
        if (wallItemFree(room, candidate, items)) return candidate.place
      }
    }
    return { type: 'wall', wall: 'north', ...clampWall(room, entry.size, 'north', room.width / 2, elev) }
  }

  const floorItems = items.filter((i) => !isWallItem(i))
  const cx = near?.place.type === 'floor' ? near.place.x : room.width / 2
  const cz = near?.place.type === 'floor' ? near.place.z : room.depth / 2
  const candidates: [number, number][] = []
  for (let x = 0; x <= room.width; x += 10) for (let z = 0; z <= room.depth; z += 10) candidates.push([x, z])
  candidates.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz))
  for (const [x, z] of candidates) {
    const probe: Item = { ...base, place: { type: 'floor', x, z, rot: 0 } }
    const c = clampFloor(room, probe, x, z)
    const candidate: Item = { ...base, place: { type: 'floor', x: c.x, z: c.z, rot: 0 } }
    if (!collides(room, candidate, floorItems)) return candidate.place
  }
  return { type: 'floor', x: Math.round(room.width / 2), z: Math.round(room.depth / 2), rot: 0 }
}

/** Puts a new thing exactly where an existing one stands, e.g. swapping the chair for one found online. */
export function placeLike(room: Room, entry: Omit<CatalogEntry, 'id'>, old: Item): Placement | null {
  const wallNew = isWallShape(entry.shape)
  const p = old.place
  if (wallNew !== (p.type === 'wall')) return null
  if (p.type === 'wall') {
    // Keep the centre height when swapping pictures of different sizes.
    const centre = p.elev + old.size.h / 2
    return { type: 'wall', wall: p.wall, ...clampWall(room, entry.size, p.wall, p.along, Math.round(centre - entry.size.h / 2)) }
  }
  // Stay flush with whichever walls the old item was pushed against (a bed keeps its headboard on the wall).
  const probe: Item = { ...entry, id: '__probe', place: { ...p } }
  const oldBox = aabb(footprint(room, old))
  const newBox = aabb(rotatedRect(0, 0, entry.size.w, entry.size.d, p.rot))
  let { x, z } = p
  const westFlush = oldBox.minX < 2
  const eastFlush = room.width - oldBox.maxX < 2
  const northFlush = oldBox.minZ < 2
  const southFlush = room.depth - oldBox.maxZ < 2
  if (westFlush && !eastFlush) x = -newBox.minX
  if (eastFlush && !westFlush) x = room.width - newBox.maxX
  if (northFlush && !southFlush) z = -newBox.minZ
  if (southFlush && !northFlush) z = room.depth - newBox.maxZ
  return { ...p, ...clampFloor(room, probe, x, z) }
}
