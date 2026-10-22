import { create } from 'zustand'
import type { Category } from '../types'

/** The two screens: look around and rearrange, or shop for new things. */
export type Mode = 'explore' | 'shop'
export type ShopFilter = Category | 'all' | 'finds'

interface Toast {
  id: number
  text: string
  undo?: boolean
}

interface Ui {
  mode: Mode
  shopFilter: ShopFilter
  shopQuery: string
  /** Product open in the shop's detail view. */
  productId: string | null
  layoutsOpen: boolean
  settingsOpen: boolean
  commandOpen: boolean
  /** "Add from a photo" dialog; `photo` pre-fills it. */
  add: { open: boolean; photo: string | null }
  toast: Toast | null
  setMode: (mode: Mode) => void
  browse: (filter: ShopFilter) => void
  setQuery: (q: string) => void
  openProduct: (id: string | null) => void
  setLayoutsOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  openAdd: (opts?: { photo?: string | null }) => void
  closeAdd: () => void
  notify: (text: string, undo?: boolean) => void
  dismissToast: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUi = create<Ui>()((set) => ({
  mode: 'explore',
  shopFilter: 'all',
  shopQuery: '',
  productId: null,
  layoutsOpen: false,
  settingsOpen: false,
  commandOpen: false,
  add: { open: false, photo: null },
  toast: null,
  setMode: (mode) => set({ mode, layoutsOpen: false }),
  browse: (shopFilter) => set({ mode: 'shop', shopFilter, productId: null }),
  setQuery: (shopQuery) => set({ shopQuery, productId: null }),
  openProduct: (productId) => set({ mode: 'shop', productId }),
  setLayoutsOpen: (layoutsOpen) => set({ layoutsOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  openAdd: (opts) => set({ add: { open: true, photo: opts?.photo ?? null }, commandOpen: false }),
  closeAdd: () => set({ add: { open: false, photo: null } }),
  notify: (text, undo) => {
    clearTimeout(toastTimer)
    set({ toast: { id: Date.now(), text, undo } })
    toastTimer = setTimeout(() => set({ toast: null }), 4000)
  },
  dismissToast: () => set({ toast: null }),
}))
