import { create } from 'zustand'
import { CURRENT_VARIANT_ID, defaultState } from './defaultState'
import { aabb, clampFloor, clampWall, footprint, wallLength } from './geometry'
import { newId, placeLike, placeNew } from './placement'
import type { CatalogEntry, Item, Placement, PlannerState, Room, Variant, WallId } from './types'

type Snapshot = { room: Room; variants: Variant[] }

export type SaveStatus = 'loading' | 'saving' | 'saved' | 'local' | 'error'
export type CameraPreset = 'dollhouse' | 'top' | 'door' | 'desk' | 'bed'

interface Store extends PlannerState {
  loaded: boolean
  saveStatus: SaveStatus
  catalog: CatalogEntry[]
  selectedId: string | null
  compare: boolean
  camera: { preset: CameraPreset; nonce: number }
  past: Snapshot[]
  future: Snapshot[]

  hydrate: (state: PlannerState) => void
  setSaveStatus: (status: SaveStatus) => void
  setCatalog: (catalog: CatalogEntry[]) => void
  select: (id: string | null) => void
  /** Records an undo step. Repeated calls with the same key in quick succession count as one step. */
  checkpoint: (key?: string) => void
  undo: () => void
  redo: () => void

  updateItem: (id: string, patch: Partial<Item>) => void
  setPlace: (id: string, place: Placement) => void
  addFrom: (entry: Omit<CatalogEntry, 'id'> & { id?: string }) => void
  swapWith: (id: string, entry: Omit<CatalogEntry, 'id'> & { id?: string }) => boolean
  duplicateItem: (id: string) => void
  removeItem: (id: string) => void
  updateRoom: (patch: Partial<Room>) => void
  /** Changes the room size, carrying along whatever sits against the walls that move. */
  resizeRoom: (dims: Partial<Pick<Room, 'width' | 'depth' | 'height'>>) => void

  addVariant: () => void
  /** Opens a new idea with these items (e.g. a rearranged layout). */
  createIdea: (name: string, items: Item[]) => void
  /** Shows a layout: reuses the idea a previous layout opened, so trying several doesn't pile up ideas. */
  applyLayout: (name: string, items: Item[]) => void
  renameVariant: (id: string, name: string) => void
  deleteVariant: (id: string) => void
  setActiveVariant: (id: string) => void
  setCompare: (on: boolean) => void
  requestCamera: (preset: CameraPreset) => void
  resetAll: () => void
}

let lastCheckpoint = { key: '', at: 0 }

export const useStore = create<Store>()((set, get) => {
  const mapItems = (fn: (items: Item[]) => Item[]) =>
    set((s) => ({ variants: s.variants.map((v) => (v.id === s.activeVariantId ? { ...v, items: fn(v.items) } : v)) }))

  const itemFromEntry = (entry: Omit<CatalogEntry, 'id'> & { id?: string }, place: Placement): Item => {
    const { id: catalogId, ...rest } = entry
    const { group: _group, ...clean } = rest as typeof rest & { group?: string }
    return { ...clean, id: newId(entry.name), place, catalogId }
  }

  return {
    ...defaultState(),
    loaded: false,
    saveStatus: 'loading',
    catalog: [],
    selectedId: null,
    compare: false,
    camera: { preset: 'dollhouse', nonce: 0 },
    past: [],
    future: [],

    hydrate: (state) =>
      set((s) => ({
        room: state.room,
        variants: state.variants,
        activeVariantId: state.variants.some((v) => v.id === state.activeVariantId) ? state.activeVariantId : state.variants[0].id,
        loaded: true,
        selectedId: state.variants.some((v) => v.items.some((i) => i.id === s.selectedId)) ? s.selectedId : null,
      })),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    setCatalog: (catalog) => set({ catalog }),
    select: (selectedId) => set({ selectedId }),

    checkpoint: (key) => {
      const now = Date.now()
      if (key && key === lastCheckpoint.key && now - lastCheckpoint.at < 1500) {
        lastCheckpoint.at = now
        return
      }
      lastCheckpoint = { key: key ?? '', at: now }
      set((s) => ({ past: [...s.past.slice(-99), { room: s.room, variants: s.variants }], future: [] }))
    },
    undo: () => {
      const { past, future, room, variants } = get()
      const prev = past.at(-1)
      if (!prev) return
      lastCheckpoint = { key: '', at: 0 }
      set((s) => ({
        ...prev,
        past: past.slice(0, -1),
        future: [{ room, variants }, ...future],
        activeVariantId: prev.variants.some((v) => v.id === s.activeVariantId) ? s.activeVariantId : CURRENT_VARIANT_ID,
      }))
    },
    redo: () => {
      const { past, future, room, variants } = get()
      const next = future[0]
      if (!next) return
      lastCheckpoint = { key: '', at: 0 }
      set((s) => ({
        ...next,
        past: [...past, { room, variants }],
        future: future.slice(1),
        activeVariantId: next.variants.some((v) => v.id === s.activeVariantId) ? s.activeVariantId : CURRENT_VARIANT_ID,
      }))
    },

    updateItem: (id, patch) => mapItems((items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    setPlace: (id, place) => mapItems((items) => items.map((i) => (i.id === id ? { ...i, place } : i))),

    addFrom: (entry) => {
      const s = get()
      const items = activeItems(s)
      const near = items.find((i) => i.id === s.selectedId) ?? null
      const item = itemFromEntry(entry, placeNew(s.room, entry, items, near))
      s.checkpoint()
      mapItems((items) => [...items, item])
      set({ selectedId: item.id })
    },
    swapWith: (id, entry) => {
      const s = get()
      const old = activeItems(s).find((i) => i.id === id)
      if (!old) return false
      const place = placeLike(s.room, entry, old)
      if (!place) return false
      const item = itemFromEntry(entry, place)
      s.checkpoint()
      mapItems((items) => items.map((i) => (i.id === id ? item : i)))
      set({ selectedId: item.id })
      return true
    },
    duplicateItem: (id) => {
      const s = get()
      const items = activeItems(s)
      const src = items.find((i) => i.id === id)
      if (!src) return
      const { id: _id, place: _place, ...entry } = src
      const copy: Item = { ...src, id: newId(src.name), name: `${src.name} copy`, fixture: false, locked: false, place: placeNew(s.room, entry, items, src) }
      s.checkpoint()
      mapItems((items) => [...items, copy])
      set({ selectedId: copy.id })
    },
    removeItem: (id) => {
      get().checkpoint()
      mapItems((items) => items.filter((i) => i.id !== id))
      set((s) => ({ selectedId: s.selectedId === id ? null : s.selectedId }))
    },
    updateRoom: (patch) => set((s) => ({ room: { ...s.room, ...patch } })),
    resizeRoom: (dims) =>
      set((s) => {
        const old = s.room
        const room: Room = { ...old, ...dims }
        const delta = (wall: WallId) => wallLength(room, wall) - wallLength(old, wall)
        // Things in the far half of a wall keep their distance to the far end (the door stays by the corner).
        const shift = (wall: WallId, along: number) => (along > wallLength(old, wall) / 2 ? along + delta(wall) : along)
        room.finishes = old.finishes.map((f) => ({ ...f, from: shift(f.wall, f.from), to: shift(f.wall, f.to) }))
        room.openings = old.openings.map((o) => ({ ...o, along: shift(o.wall, o.along) }))
        const moveItem = (item: Item): Item => {
          const p = item.place
          if (p.type === 'wall') return { ...item, place: { ...p, ...clampWall(room, item.size, p.wall, shift(p.wall, p.along), p.elev) } }
          const box = aabb(footprint(old, item))
          const x = p.x + (old.width - box.maxX < 2 ? room.width - old.width : 0)
          const z = p.z + (old.depth - box.maxZ < 2 ? room.depth - old.depth : 0)
          return { ...item, place: { ...p, ...clampFloor(room, item, x, z) } }
        }
        return { room, variants: s.variants.map((v) => ({ ...v, items: v.items.map(moveItem) })) }
      }),

    addVariant: () => {
      const s = get()
      const src = s.variants.find((v) => v.id === s.activeVariantId)!
      const n = s.variants.length
      const variant: Variant = { id: newId(`idea-${n}`), name: `Idea ${n}`, items: structuredClone(src.items) }
      s.checkpoint()
      set({ variants: [...s.variants, variant], activeVariantId: variant.id })
    },
    createIdea: (name, items) => {
      const s = get()
      const variant: Variant = { id: newId(name), name, items }
      s.checkpoint()
      set({ variants: [...s.variants, variant], activeVariantId: variant.id, selectedId: null })
    },
    applyLayout: (name, items) => {
      const s = get()
      s.checkpoint()
      const active = s.variants.find((v) => v.id === s.activeVariantId)
      if (active?.source === 'layout') {
        set({ variants: s.variants.map((v) => (v.id === active.id ? { ...v, name, items } : v)), selectedId: null })
        return
      }
      const variant: Variant = { id: newId(name), name, items, source: 'layout' }
      set({ variants: [...s.variants, variant], activeVariantId: variant.id, selectedId: null })
    },
    renameVariant: (id, name) => {
      get().checkpoint()
      // A renamed layout idea is one the person wants to keep: stop reusing it for previews.
      set((s) => ({ variants: s.variants.map((v) => (v.id === id ? { ...v, name, source: undefined } : v)) }))
    },
    deleteVariant: (id) => {
      if (id === CURRENT_VARIANT_ID) return
      get().checkpoint()
      set((s) => ({
        variants: s.variants.filter((v) => v.id !== id),
        activeVariantId: s.activeVariantId === id ? CURRENT_VARIANT_ID : s.activeVariantId,
      }))
    },
    setActiveVariant: (activeVariantId) =>
      set((s) => ({
        activeVariantId,
        selectedId: s.variants.find((v) => v.id === activeVariantId)?.items.some((i) => i.id === s.selectedId) ? s.selectedId : null,
      })),
    setCompare: (compare) => set({ compare }),
    requestCamera: (preset) => set((s) => ({ camera: { preset, nonce: s.camera.nonce + 1 } })),
    resetAll: () => {
      get().checkpoint()
      const fresh = defaultState()
      set({ room: fresh.room, variants: fresh.variants, activeVariantId: fresh.activeVariantId, selectedId: null })
    },
  }
})

export function activeItems(s: Pick<PlannerState, 'variants' | 'activeVariantId'>): Item[] {
  return s.variants.find((v) => v.id === s.activeVariantId)?.items ?? []
}

export function useActiveItems() {
  return useStore((s) => activeItems(s))
}

export function useSelectedItem() {
  return useStore((s) => activeItems(s).find((i) => i.id === s.selectedId) ?? null)
}
