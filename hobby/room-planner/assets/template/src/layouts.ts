import { aabb, clampFloor, footprint, overlapDepth, rotatedRect, verticalRange, wallPoint, type Vec2 } from './geometry'
import { categoryOf } from './shop'
import { isSoft } from './shapes'
import type { FloorPlacement, Item, Room, WallId } from './types'

// Ready-made arrangements of the furniture you have. Each layout is a few rules ("desk under the
// east window"), worked out against the room's real size; anything that would bump into something
// else, stick out or block the door gets nudged to the nearest free spot.

type Placed = Record<string, Item | undefined>
type Rule = { key: string; pick: (items: Item[]) => Item | undefined; at: (room: Room, item: Item, placed: Placed) => FloorPlacement | null }

export interface Layout {
  id: string
  name: string
  description: string
  rules: Rule[]
}

const floorItems = (items: Item[]) => items.filter((i) => i.place.type === 'floor' && !i.hidden && !i.fixture)
const first = (cat: string) => (items: Item[]) => floorItems(items).find((i) => categoryOf(i) === cat)
const deskChair = (items: Item[]) => {
  const chairs = floorItems(items).filter((i) => categoryOf(i) === 'officeChair')
  const desk = first('desk')(items)
  if (!desk || desk.place.type !== 'floor' || chairs.length < 2) return chairs[0]
  const d = desk.place
  return [...chairs].sort((a, b) => dist(a, d) - dist(b, d))[0]
}
const otherChair = (items: Item[]) => {
  const main = deskChair(items)
  return floorItems(items).find((i) => categoryOf(i) === 'officeChair' && i.id !== main?.id)
}
const dist = (i: Item, p: { x: number; z: number }) => (i.place.type === 'floor' ? Math.hypot(i.place.x - p.x, i.place.z - p.z) : Infinity)

/** Back against a wall, facing into the room; `along` is the centre, measured like wall items. */
function againstWall(room: Room, item: Item, wall: WallId, along: number, gap = 0): FloorPlacement {
  const { d } = item.size
  const rot = { north: 0, east: 90, south: 180, west: 270 }[wall]
  const [x, z] = wallPoint(room, wall, along, d / 2 + gap)
  return clampTo(room, item, { type: 'floor', x, z, rot })
}

function clampTo(room: Room, item: Item, p: FloorPlacement): FloorPlacement {
  const c = clampFloor(room, { ...item, place: p }, p.x, p.z)
  return { ...p, ...c }
}

/** In front of an item (its front side), `gap` cm away, facing it. */
function facing(room: Room, target: Item | undefined, item: Item, gap: number): FloorPlacement | null {
  if (!target || target.place.type !== 'floor') return null
  const r = (target.place.rot * Math.PI) / 180
  const fx = -Math.sin(r)
  const fz = Math.cos(r)
  const reach = target.size.d / 2 + gap + item.size.d / 2
  return clampTo(room, item, { type: 'floor', x: target.place.x + fx * reach, z: target.place.z + fz * reach, rot: (target.place.rot + 180) % 360 })
}

/** The room's widest window: where the most daylight comes in. */
const mainWindow = (room: Room) => room.openings.filter((o) => o.kind === 'window').sort((x, y) => y.width - x.width)[0]

export const LAYOUTS: Layout[] = [
  {
    id: 'desk-window',
    name: 'Desk by the window',
    description: 'Work in daylight: the desk moves under the window, facing out.',
    rules: [
      {
        key: 'desk',
        pick: first('desk'),
        at: (room, desk) => {
          const win = mainWindow(room)
          return win ? againstWall(room, desk, win.wall, win.along) : null
        },
      },
      { key: 'chair', pick: deskChair, at: (room, chair, placed) => facing(room, placed.desk, chair, 12) },
    ],
  },
  {
    id: 'bed-long-wall',
    name: 'Bed along the wall',
    description: 'Bed turned to run along the north wall, opening up the middle of the room.',
    rules: [
      {
        key: 'bed',
        pick: first('bed'),
        at: (room, bed) => {
          const p: FloorPlacement = { type: 'floor', x: 0, z: 0, rot: 270 }
          const box = aabb(rotatedRect(0, 0, bed.size.w, bed.size.d, 270))
          return clampTo(room, bed, { ...p, x: -box.minX, z: -box.minZ })
        },
      },
      {
        key: 'lamp',
        pick: first('floorLamp'),
        at: (room, lamp, placed) => {
          if (!placed.bed) return null
          const box = aabb(footprint(room, placed.bed))
          return clampTo(room, lamp, { type: 'floor', x: lamp.size.w / 2 + 2, z: box.maxZ + lamp.size.d / 2 + 4, rot: 0 })
        },
      },
      { key: 'desk', pick: first('desk'), at: (room, desk) => againstWall(room, desk, 'north', room.width - desk.size.w / 2 - 25) },
      { key: 'chair', pick: deskChair, at: (room, chair, placed) => facing(room, placed.desk, chair, 12) },
    ],
  },
  {
    id: 'bed-centre',
    name: 'Bed in the middle',
    description: 'Headboard centred on the back wall like a hotel room, desk along the side wall.',
    rules: [
      { key: 'bed', pick: first('bed'), at: (room, bed) => againstWall(room, bed, 'north', room.width / 2 - 10) },
      { key: 'desk', pick: first('desk'), at: (room, desk) => againstWall(room, desk, 'west', room.depth - desk.size.w / 2 - 15) },
      { key: 'chair', pick: deskChair, at: (room, chair, placed) => facing(room, placed.desk, chair, 10) },
      {
        key: 'lamp',
        pick: first('floorLamp'),
        at: (room, lamp, placed) => {
          if (!placed.bed) return null
          const box = aabb(footprint(room, placed.bed))
          return clampTo(room, lamp, { type: 'floor', x: box.maxX + lamp.size.w / 2 + 6, z: lamp.size.d / 2 + 4, rot: 90 })
        },
      },
    ],
  },
  {
    id: 'open-floor',
    name: 'Open floor',
    description: 'Everything pushed to the walls for the most free floor space.',
    rules: [
      { key: 'desk', pick: first('desk'), at: (room, desk) => againstWall(room, desk, 'north', room.width - desk.size.w / 2 - 70) },
      { key: 'chair', pick: deskChair, at: (room, chair, placed) => facing(room, placed.desk, chair, 8) },
      { key: 'sofa', pick: first('sofa'), at: (room, sofa) => againstWall(room, sofa, 'south', room.width / 2 - 40) },
      { key: 'other', pick: otherChair, at: (room, chair) => againstWall(room, chair, 'south', 40) },
    ],
  },
]

function doorZones(room: Room): Vec2[][] {
  return room.openings
    .filter((o) => o.kind === 'door')
    .map((o) => {
      const depth = o.width > 100 ? o.width / 2 : o.width
      const a = o.along - o.width / 2
      const b = o.along + o.width / 2
      return [wallPoint(room, o.wall, a, 0), wallPoint(room, o.wall, b, 0), wallPoint(room, o.wall, b, depth), wallPoint(room, o.wall, a, depth)]
    })
}

function blocked(room: Room, item: Item, others: Item[], doors: Vec2[][]) {
  const poly = footprint(room, item)
  const box = aabb(poly)
  if (box.minX < -0.5 || box.minZ < -0.5 || box.maxX > room.width + 0.5 || box.maxZ > room.depth + 0.5) return true
  if (isSoft(item.shape)) return false
  if (doors.some((zone) => overlapDepth(poly, zone) > 1)) return true
  const [a0, a1] = verticalRange(item)
  return others.some((o) => {
    if (o.hidden || isSoft(o.shape) || o.id === item.id) return false
    const [b0, b1] = verticalRange(o)
    if (Math.min(a1, b1) - Math.max(a0, b0) <= 0.5) return false
    return overlapDepth(poly, footprint(room, o)) > 0.5
  })
}

/** Nearest free spot to `place`, searching outwards in 5 cm steps. */
function settle(room: Room, item: Item, place: FloorPlacement, fixed: Item[], doors: Vec2[][]): FloorPlacement {
  for (let r = 0; r <= 160; r += 5) {
    const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 5)
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2
      const p = clampTo(room, item, { ...place, x: place.x + Math.cos(a) * r, z: place.z + Math.sin(a) * r })
      if (!blocked(room, { ...item, place: p }, fixed, doors)) return p
    }
  }
  return place
}

/** Applies a layout to a copy of the items and returns the rearranged list. */
export function arrange(room: Room, items: Item[], layout: Layout): Item[] {
  const doors = doorZones(room)
  const result = items.map((i) => ({ ...i }))
  const byId = new Map(result.map((i) => [i.id, i]))
  const fixed: Item[] = result.filter((i) => i.place.type === 'wall' || i.hidden)
  const placed: Placed = {}
  const taken = new Set<string>()
  for (const rule of layout.rules) {
    const target = rule.pick(result.filter((i) => !taken.has(i.id)))
    if (!target) continue
    const item = byId.get(target.id)!
    const want = rule.at(room, item, placed)
    if (!want) continue
    item.place = settle(room, item, want, fixed, doors)
    fixed.push(item)
    placed[rule.key] = item
    taken.add(item.id)
  }
  for (const item of result) {
    if (fixed.includes(item) || item.place.type !== 'floor') continue
    item.place = settle(room, item, item.place, fixed, doors)
    fixed.push(item)
  }
  return result
}
