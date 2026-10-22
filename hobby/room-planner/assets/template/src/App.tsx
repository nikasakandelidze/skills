import { useEffect } from 'react'
import { clampFloor, clampWall } from './geometry'
import { PlanView } from './plan/PlanView'
import { activeItems, useStore, type CameraPreset } from './store'
import { Scene } from './three/Scene'
import { duplicate, remove, rotateBy } from './ui/actions'
import { AddDialog } from './ui/AddDialog'
import { CommandMenu } from './ui/CommandMenu'
import { LayoutsDock } from './ui/LayoutsDock'
import { DropAndPaste, isTyping, Toast } from './ui/Overlays'
import { RoomSettingsDialog } from './ui/RoomTab'
import { ShopPanel } from './ui/ShopPanel'
import { TopBar } from './ui/TopBar'
import { useUi } from './ui/uiStore'

const VIEWS: { id: CameraPreset; label: string }[] = [
  { id: 'dollhouse', label: 'Whole room' },
  { id: 'door', label: 'Door' },
  { id: 'bed', label: 'Bed' },
  { id: 'desk', label: 'Desk' },
]

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      const ui = useUi.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'k') {
        e.preventDefault()
        return ui.setCommandOpen(!ui.commandOpen)
      }
      if (ui.commandOpen || ui.add.open || ui.settingsOpen || isTyping(e.target)) return
      if (mod && key === 'z') {
        e.preventDefault()
        return e.shiftKey ? s.redo() : s.undo()
      }
      if (mod && key === 'y') {
        e.preventDefault()
        return s.redo()
      }
      const item = activeItems(s).find((i) => i.id === s.selectedId)
      if (e.key === 'Escape') {
        if (item) return s.select(null)
        if (ui.layoutsOpen) return ui.setLayoutsOpen(false)
        return
      }
      if (!item) return
      if (mod && key === 'd') {
        e.preventDefault()
        return duplicate(item)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        return remove(item)
      }
      if (item.locked) return
      if (key === 'r' && !mod) return rotateBy(item, e.shiftKey ? -90 : 90)
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const dir = arrows[e.key]
      if (!dir) return
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      s.checkpoint(`nudge-${item.id}`)
      const p = item.place
      if (p.type === 'floor') s.setPlace(item.id, { ...p, ...clampFloor(s.room, item, p.x + dir[0] * step, p.z + dir[1] * step) })
      else s.setPlace(item.id, { ...p, ...clampWall(s.room, item.size, p.wall, p.along + dir[0] * step, p.elev - dir[1] * step) })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function ViewButtons() {
  const preset = useStore((s) => s.camera.preset)
  const requestCamera = useStore((s) => s.requestCamera)
  return (
    <div className="seg glass views">
      {VIEWS.map((v) => (
        <button key={v.id} className={v.id === preset ? 'on' : ''} onClick={() => requestCamera(v.id)}>
          {v.label}
        </button>
      ))}
    </div>
  )
}

export function App() {
  const loaded = useStore((s) => s.loaded)
  const mode = useUi((s) => s.mode)
  useShortcuts()

  if (!loaded) return <div className="loading">Loading your room…</div>

  // The 3D view keeps its place in the tree in both screens, so switching screens doesn't reload it.
  return (
    <div className="app">
      <TopBar />
      <div className="workspace" data-mode={mode}>
        {mode === 'shop' && <ShopPanel />}
        <section className="stage-3d">
          <Scene />
          <ViewButtons />
          {mode === 'explore' && <LayoutsDock />}
        </section>
        {mode === 'explore' && (
          <section className="stage-plan">
            <PlanView />
          </section>
        )}
      </div>
      <RoomSettingsDialog />
      <CommandMenu />
      <AddDialog />
      <Toast />
      <DropAndPaste />
    </div>
  )
}
