import { LayoutGrid, Loader2, Shuffle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { generateLayouts, type AutoLayout } from '../autoLayout'
import { CURRENT_VARIANT_ID } from '../defaultState'
import { footprint, wallPoint } from '../geometry'
import { arrange, LAYOUTS } from '../layouts'
import { isSoft } from '../shapes'
import { useActiveItems, useStore } from '../store'
import type { Item, Room } from '../types'
import { useUi } from './uiStore'

/** A tiny floor plan, for the layout cards. */
export function MiniPlan({ room, items }: { room: Room; items: Item[] }) {
  const pad = 12
  return (
    <svg viewBox={`${-pad} ${-pad} ${room.width + pad * 2} ${room.depth + pad * 2}`} aria-hidden>
      <rect x={-6} y={-6} width={room.width + 12} height={room.depth + 12} fill="#4a4540" rx={4} />
      <rect x={0} y={0} width={room.width} height={room.depth} fill="#f3eadc" />
      {room.openings.map((o) => {
        const a = wallPoint(room, o.wall, o.along - o.width / 2, -3)
        const b = wallPoint(room, o.wall, o.along + o.width / 2, -3)
        return <line key={o.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={o.kind === 'door' ? '#c9a27a' : '#bcd6ec'} strokeWidth={7} />
      })}
      {items
        .filter((i) => !i.hidden && i.place.type === 'floor')
        .sort((a, b) => Number(!isSoft(a.shape)) - Number(!isSoft(b.shape)))
        .map((i) => (
          <polygon key={i.id} points={footprint(room, i).map((p) => p.join(',')).join(' ')} fill={i.color} fillOpacity={isSoft(i.shape) ? 0.45 : 0.9} stroke="rgba(0,0,0,.3)" strokeWidth={2} />
        ))}
    </svg>
  )
}

interface Option {
  id: string
  title: string
  note: string
  items: Item[]
}

function Card({ option, room, on, onPick }: { option: Option; room: Room; on: boolean; onPick: () => void }) {
  return (
    <button className={`lay-card${on ? ' on' : ''}`} onClick={onPick} title={option.title}>
      <MiniPlan room={room} items={option.items} />
      <b>{option.title}</b>
      <span>{option.note}</span>
    </button>
  )
}

/** Bottom drawer in Explore: a row of layouts to flip through. */
export function LayoutsDock() {
  const open = useUi((s) => s.layoutsOpen)
  const setOpen = useUi((s) => s.setLayoutsOpen)
  const room = useStore((s) => s.room)
  const activeId = useStore((s) => s.activeVariantId)
  const active = useStore((s) => s.variants.find((v) => v.id === s.activeVariantId))
  const base = useStore((s) => s.variants.find((v) => v.id === CURRENT_VARIANT_ID)?.items ?? [])
  const applyLayout = useStore((s) => s.applyLayout)
  const setActive = useStore((s) => s.setActiveVariant)
  const items = useActiveItems()
  // Rearrange whatever you're looking at, including new things you're trying.
  const source = items

  const [seed, setSeed] = useState(1)
  const [busy, setBusy] = useState(false)
  const [auto, setAuto] = useState<AutoLayout[]>([])
  const key = useMemo(() => JSON.stringify([room.width, room.depth, room.openings, source.map((i) => [i.id, i.size, i.hidden])]), [room, source])

  useEffect(() => {
    if (!open) return
    let live = true
    setBusy(true)
    generateLayouts(room, source, seed, 4, 70).then((found) => {
      if (!live) return
      setAuto(found)
      setBusy(false)
    })
    return () => {
      live = false
    }
    // Only when the furniture or room changes, or for a fresh shuffle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, seed])

  const classics: Option[] = useMemo(
    () => LAYOUTS.map((l) => ({ id: l.id, title: l.name, note: l.description, items: arrange(room, source, l) })),
    [room, source],
  )
  const suggestions: Option[] = auto.map((a) => ({ id: a.id, title: a.title, note: a.perks.slice(0, 2).join(' · ') || 'A different take', items: a.items }))

  if (!open)
    return (
      <button className="dock-button glass" onClick={() => setOpen(true)}>
        <LayoutGrid size={16} /> Layouts
      </button>
    )

  return (
    <div className="dock glass">
      <div className="dock-head">
        <b>Try a different layout</b>
        <span className="muted">Your furniture, rearranged. Pick one to see it; your room as it is now stays safe.</span>
        <button className="btn sm" disabled={busy} onClick={() => setSeed((s) => s + 1)}>
          {busy ? <Loader2 size={14} className="spin" /> : <Shuffle size={14} />} More ideas
        </button>
        <button className="icon-btn" onClick={() => setOpen(false)} title="Close">
          <X size={17} />
        </button>
      </div>
      <div className="dock-row">
        <Card option={{ id: 'now', title: 'As it is now', note: 'Your room today', items: base }} room={room} on={activeId === CURRENT_VARIANT_ID} onPick={() => setActive(CURRENT_VARIANT_ID)} />
        {busy && suggestions.length === 0
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="lay-card ghost">
                <Loader2 size={18} className="spin" />
              </div>
            ))
          : suggestions.map((o) => <Card key={o.id} option={o} room={room} on={active?.source === 'layout' && active.name === o.title} onPick={() => applyLayout(o.title, o.items)} />)}
        <div className="dock-divider" />
        {classics.map((o) => (
          <Card key={o.id} option={o} room={room} on={active?.source === 'layout' && active.name === o.title} onPick={() => applyLayout(o.title, o.items)} />
        ))}
      </div>
    </div>
  )
}
