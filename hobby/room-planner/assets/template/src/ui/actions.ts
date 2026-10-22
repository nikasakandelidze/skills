import {
  AirVent,
  Armchair,
  BedDouble,
  Blinds,
  Box,
  Camera,
  Flower2,
  Frame,
  Heater,
  Image,
  LampFloor,
  Library,
  Monitor,
  Package,
  Presentation,
  RectangleHorizontal,
  RectangleVertical,
  Sofa,
  Square,
  type LucideIcon,
} from 'lucide-react'
import { clampFloor, normRot } from '../geometry'
import { categoryOf, ensureIdea } from '../shop'
import { activeItems, useStore } from '../store'
import { canvasHandle } from '../three/handles'
import type { CatalogEntry, Item, Shape } from '../types'
import { useUi } from './uiStore'

// Things you can do to the room, shared by the item toolbar, the detail panel, the command menu
// and keyboard shortcuts so they behave the same everywhere.

export const SHAPE_ICONS: Record<Shape, LucideIcon> = {
  bed: BedDouble,
  desk: Monitor,
  officeChair: Armchair,
  chair: Armchair,
  sofa: Sofa,
  bookshelf: Library,
  floorLamp: LampFloor,
  tripod: Camera,
  lightStand: Camera,
  foldingChair: Armchair,
  table: Square,
  box: Package,
  rug: RectangleHorizontal,
  plant: Flower2,
  cutout: Image,
  poster: Frame,
  ac: AirVent,
  whiteboard: Presentation,
  curtain: Blinds,
  radiator: Heater,
  wallShelf: RectangleHorizontal,
  mirror: RectangleVertical,
}

export const FallbackIcon = Box

const current = () => {
  const s = useStore.getState()
  return activeItems(s).find((i) => i.id === s.selectedId) ?? null
}

export function rotateBy(item: Item, delta: number) {
  if (item.place.type !== 'floor') return
  const s = useStore.getState()
  s.checkpoint(`rotate-${item.id}`)
  const turned: Item = { ...item, place: { ...item.place, rot: normRot(item.place.rot + delta) } }
  s.setPlace(item.id, { ...turned.place, ...clampFloor(s.room, turned, item.place.x, item.place.z) } as Item['place'])
}

export function duplicate(item: Item) {
  useStore.getState().duplicateItem(item.id)
  useUi.getState().notify(`Duplicated ${item.name}`, true)
}

export function remove(item: Item) {
  useStore.getState().removeItem(item.id)
  useUi.getState().notify(`Removed ${item.name}`, true)
}

export function hide(item: Item) {
  const s = useStore.getState()
  s.checkpoint()
  s.updateItem(item.id, { hidden: true })
  s.select(null)
  useUi.getState().notify(`Hid ${item.name}. Show it again from the sidebar.`, true)
}

export function toggleLock(item: Item) {
  const s = useStore.getState()
  s.checkpoint()
  s.updateItem(item.id, { locked: !item.locked })
}

/** Shows shop alternatives for this thing; picking one replaces it. */
export function startSwap(item: Item) {
  const cat = categoryOf(item)
  useUi.getState().browse(cat ?? 'all')
}

/** Adds something (into an idea, never the real room) and says so. */
export function place(entry: Omit<CatalogEntry, 'id'> & { id?: string }) {
  ensureIdea('New things')
  useStore.getState().addFrom(entry)
  useUi.getState().notify(`Added ${entry.name}`, true)
  return true
}

export function saveImage() {
  const canvas = canvasHandle.current
  if (!canvas) return
  const s = useStore.getState()
  const idea = s.variants.find((v) => v.id === s.activeVariantId)?.name ?? ''
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `${`${s.room.name} ${idea}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
  a.click()
}

export function undo() {
  useStore.getState().undo()
  useUi.getState().dismissToast()
}

export { activeItems, current as selectedItem }
