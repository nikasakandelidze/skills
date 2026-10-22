import { Camera, Copy, Download, Eye, ImagePlus, LayoutGrid, Plus, Redo2, Repeat2, RotateCw, Search, Settings, ShoppingBag, Trash2, Undo2, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CURRENT_VARIANT_ID } from '../defaultState'
import { arrange, LAYOUTS } from '../layouts'
import { CATEGORIES, SHOP } from '../shop'
import { activeItems, useStore, type CameraPreset } from '../store'
import { duplicate, FallbackIcon, remove, rotateBy, saveImage, selectedItem, SHAPE_ICONS, startSwap } from './actions'
import { useUi } from './uiStore'

interface Command {
  id: string
  group: string
  label: string
  icon: LucideIcon
  hint?: string
  keywords?: string
  run: () => void
}

const CAMERA: { id: CameraPreset; label: string }[] = [
  { id: 'dollhouse', label: 'Overview' },
  { id: 'top', label: 'From above' },
  { id: 'door', label: 'Standing at the door' },
  { id: 'desk', label: 'Sitting at the desk' },
  { id: 'bed', label: 'Lying in bed' },
]

function buildCommands(): Command[] {
  const s = useStore.getState()
  const ui = useUi.getState()
  const sel = selectedItem()
  const items = activeItems(s)
  const list: Command[] = [{ id: 'add-photo', group: 'Add', label: 'Add something from a photo…', icon: ImagePlus, keywords: 'image picture upload product poster', run: () => ui.openAdd() }]
  if (sel) {
    list.push(
      { id: 'sel-swap', group: sel.name, label: `Swap ${sel.name} for something else`, icon: Repeat2, keywords: 'replace', run: () => startSwap(sel) },
      { id: 'sel-dup', group: sel.name, label: 'Duplicate', icon: Copy, hint: '⌘D', run: () => duplicate(sel) },
      { id: 'sel-del', group: sel.name, label: 'Remove', icon: Trash2, hint: '⌫', keywords: 'delete', run: () => remove(sel) },
    )
    if (sel.place.type === 'floor') list.push({ id: 'sel-rot', group: sel.name, label: 'Turn 90°', icon: RotateCw, hint: 'R', keywords: 'rotate', run: () => rotateBy(sel, 90) })
  }
  list.push(
    ...CATEGORIES.filter((c) => SHOP.some((p) => p.category === c.id)).map((c) => ({ id: `shop-${c.id}`, group: 'Shop', label: `Browse ${c.label.toLowerCase()}`, icon: ShoppingBag, keywords: 'shop buy', run: () => ui.browse(c.id) })),
    ...LAYOUTS.map((l) => ({
      id: `layout-${l.id}`,
      group: 'Layouts',
      label: `Try layout: ${l.name}`,
      icon: LayoutGrid,
      keywords: 'arrange rearrange',
      run: () => s.applyLayout(l.name, arrange(s.room, items, l)),
    })),
    ...CAMERA.map((c) => ({ id: `cam-${c.id}`, group: 'Look', label: c.label, icon: Camera, keywords: 'view look camera', run: () => s.requestCamera(c.id) })),
    { id: 'idea-new', group: 'Ideas', label: 'New version from what I see', icon: Plus, keywords: 'variant copy', run: () => s.addVariant() },
    ...s.variants
      .filter((v) => v.id !== s.activeVariantId)
      .map((v) => ({ id: `idea-${v.id}`, group: 'Ideas', label: `Open ${v.id === CURRENT_VARIANT_ID ? 'My room now' : v.name}`, icon: Eye, keywords: 'switch idea', run: () => s.setActiveVariant(v.id) })),
    ...items.map((i) => ({ id: `go-${i.id}`, group: 'In the room', label: i.name, icon: SHAPE_ICONS[i.shape] ?? FallbackIcon, keywords: 'select find', run: () => s.select(i.id) })),
    ...SHOP.map((p) => ({ id: `p-${p.id}`, group: 'Products', label: p.name, icon: ShoppingBag, hint: p.price, run: () => ui.openProduct(p.id) })),
    { id: 'undo', group: 'Edit', label: 'Undo', icon: Undo2, hint: '⌘Z', run: () => s.undo() },
    { id: 'redo', group: 'Edit', label: 'Redo', icon: Redo2, hint: '⇧⌘Z', run: () => s.redo() },
    { id: 'image', group: 'Edit', label: 'Save a picture of the 3D view', icon: Download, keywords: 'screenshot export png', run: saveImage },
    { id: 'room', group: 'Edit', label: 'Room size and colours', icon: Settings, keywords: 'settings measurements dimensions', run: () => ui.setSettingsOpen(true) },
  )
  return list
}

/** Linear-style command menu: type to find any action, item or view. */
export function CommandMenu() {
  const open = useUi((s) => s.commandOpen)
  const setOpen = useUi((s) => s.setCommandOpen)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo(() => (open ? buildCommands() : []), [open])
  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const pool = words.length ? commands : commands.filter((c) => !['Products', 'In the room'].includes(c.group))
    return pool.filter((c) => {
      const hay = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
    }
  }, [open])
  useEffect(() => setIndex(0), [query])
  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.on')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null
  const run = (c: Command) => {
    setOpen(false)
    c.run()
  }
  let lastGroup = ''
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="cmdk" role="dialog" aria-label="Command menu">
        <div className="cmdk-input">
          <Search size={16} />
          <input
            autoFocus
            placeholder="Type a command, or something in the room…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setIndex((i) => Math.min(filtered.length - 1, i + 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setIndex((i) => Math.max(0, i - 1)))
              if (e.key === 'Enter' && filtered[index]) run(filtered[index])
              if (e.key === 'Escape') setOpen(false)
            }}
          />
        </div>
        <div className="cmdk-list" ref={listRef}>
          {filtered.length === 0 && <div className="cmdk-empty">Nothing matches “{query}”</div>}
          {filtered.map((c, i) => {
            const header = c.group !== lastGroup ? <div className="cmdk-group">{c.group}</div> : null
            lastGroup = c.group
            const Icon = c.icon
            return (
              <div key={c.id}>
                {header}
                <button className={`cmdk-item${i === index ? ' on' : ''}`} onMouseMove={() => setIndex(i)} onClick={() => run(c)}>
                  <Icon size={15} />
                  <span className="label">{c.label}</span>
                  {c.hint && <span className="hint">{c.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="cmdk-foot faint" style={{ padding: '8px 14px', fontSize: 12 }}>
          ↑ ↓ to move · Enter to choose · Esc to close

        </div>
      </div>
    </div>
  )
}
