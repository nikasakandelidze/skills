import { Camera, Check, ChevronDown, Compass, Pencil, Plus, Redo2, Settings2, ShoppingBag, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CURRENT_VARIANT_ID } from '../defaultState'
import { useStore } from '../store'
import { saveImage } from './actions'
import { useUi } from './uiStore'

const ideaName = (id: string, name: string) => (id === CURRENT_VARIANT_ID ? 'My room now' : name)

/** One dropdown for switching between versions of the room, instead of a row of tabs. */
function IdeasMenu() {
  const variants = useStore((s) => s.variants)
  const activeId = useStore((s) => s.activeVariantId)
  const setActive = useStore((s) => s.setActiveVariant)
  const addVariant = useStore((s) => s.addVariant)
  const rename = useStore((s) => s.renameVariant)
  const remove = useStore((s) => s.deleteVariant)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const active = variants.find((v) => v.id === activeId)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button className="menu-trigger" onClick={() => setOpen(!open)}>
        <span className={`idea-dot${activeId === CURRENT_VARIANT_ID ? ' real' : ''}`} />
        <span className="trunc">{active ? ideaName(active.id, active.name) : ''}</span>
        <ChevronDown size={15} className="faint" />
      </button>
      {open && (
        <div className="menu-pop">
          <div className="menu-label">Versions of your room</div>
          {variants.map((v) =>
            editing === v.id ? (
              <div key={v.id} className="menu-item">
                <input
                  autoFocus
                  className="field"
                  style={{ height: 30 }}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (draft.trim() && draft !== v.name) rename(v.id, draft.trim())
                    setEditing(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              </div>
            ) : (
              <div key={v.id} className={`menu-item${v.id === activeId ? ' on' : ''}`} role="button" tabIndex={0} onClick={() => (setActive(v.id), setOpen(false))}>
                <span className="menu-check">{v.id === activeId && <Check size={14} />}</span>
                <span className="label">{ideaName(v.id, v.name)}</span>
                {v.id !== CURRENT_VARIANT_ID && (
                  <span className="menu-actions">
                    <button
                      className="icon-btn sm"
                      title="Rename"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDraft(v.name)
                        setEditing(v.id)
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="icon-btn sm"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete “${v.name}”? You can undo this.`)) remove(v.id)
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>
            ),
          )}
          <div className="menu-sep" />
          <button className="menu-item" onClick={() => (addVariant(), setOpen(false))}>
            <span className="menu-check">
              <Plus size={14} />
            </span>
            <span className="label">New version from this one</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const mode = useUi((s) => s.mode)
  const setMode = useUi((s) => s.setMode)
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  return (
    <header className="topbar">
      <div className="top-left">
        <span className="brand-logo" />
        <IdeasMenu />
      </div>
      <div className="seg mode-switch" role="tablist">
        <button className={mode === 'explore' ? 'on' : ''} onClick={() => setMode('explore')}>
          <Compass size={15} /> Explore
        </button>
        <button className={mode === 'shop' ? 'on' : ''} onClick={() => setMode('shop')}>
          <ShoppingBag size={15} /> Shop
        </button>
      </div>
      <div className="top-right">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo">
          <Undo2 size={17} />
        </button>
        <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo">
          <Redo2 size={17} />
        </button>
        <button className="icon-btn" onClick={saveImage} title="Save a picture">
          <Camera size={17} />
        </button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Room size and colours">
          <Settings2 size={17} />
        </button>
      </div>
    </header>
  )
}
