import { defaultRoom } from './defaultState'
import { isWallShape } from './shapes'
import { SHOP } from './shop'
import { Scene } from './three/Scene'
import type { Item, Room } from './types'

/**
 * Every shop product in one big room, read-only: open the app with ?showroom to check how the
 * 3D models look. Nothing here is saved.
 */
export function Showroom() {
  const width = 1300
  const items: Item[] = []
  let x = 40
  let z = 60
  let rowDepth = 0
  for (const p of SHOP.filter((p) => !isWallShape(p.shape))) {
    if (x + p.size.w > width - 40) {
      x = 40
      z += rowDepth + 50
      rowDepth = 0
    }
    items.push({ ...p, id: p.id, place: { type: 'floor', x: x + p.size.w / 2, z: z + p.size.d / 2, rot: 0 } })
    x += p.size.w + 40
    rowDepth = Math.max(rowDepth, p.size.d)
  }
  const room: Room = { ...defaultRoom, name: 'Showroom', width, depth: z + rowDepth + 60, finishes: [], openings: [] }
  let along = 30
  let wall: 'north' | 'east' = 'north'
  for (const p of SHOP.filter((p) => isWallShape(p.shape))) {
    if (wall === 'north' && along + p.size.w > width - 30) {
      wall = 'east'
      along = 30
    }
    const lean = p.style?.startsWith('lean') || p.shape === 'curtain'
    items.push({ ...p, id: p.id, place: { type: 'wall', wall, along: along + p.size.w / 2, elev: lean ? 0 : Math.max(0, 150 - p.size.h / 2) } })
    along += p.size.w + 25
  }
  if (import.meta.env.DEV) (window as unknown as { showroom: Item[] }).showroom = items
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Scene preview={{ room, items }} />
    </div>
  )
}
