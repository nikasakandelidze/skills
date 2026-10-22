import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CURRENT_VARIANT_ID } from '../defaultState'
import {
  aabb,
  clampFloor,
  clampWall,
  fitIssues,
  footprint,
  nearestWall,
  normRot,
  wallDistances,
  wallFrame,
  wallLength,
  wallPoint,
  type Vec2,
} from '../geometry'
import { isSoft } from '../shapes'
import { useActiveItems, useStore } from '../store'
import type { Item, Room, WallId } from '../types'

const SELECT = '#5e6ad2'
const ERROR = '#e5484d'
const WALL = '#3f3a36'

const pts = (poly: Vec2[]) => poly.map((p) => p.join(',')).join(' ')

function luminance(hex: string) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

type Drag =
  | { kind: 'move'; id: string; start: Vec2; origin: Item; moved: boolean }
  | { kind: 'rotate'; id: string; origin: Item; moved: boolean }

/** Small drawings inside an item's rectangle so the plan reads at a glance. Local coords, front = +y. */
function Glyph({ item }: { item: Item }) {
  const { w, d } = item.size
  const line = luminance(item.color) > 0.55 ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.35)'
  const sw = Math.max(1, Math.min(w, d) / 60)
  switch (item.shape) {
    case 'bed': {
      const pw = Math.min(w * 0.36, 60)
      return (
        <g>
          <rect x={-w / 2 + 4} y={-d / 2 + 8} width={w - 8} height={d - 10} rx={4} fill={item.color2 ?? '#e9edf2'} />
          {[-1, 1].map((s) => (
            <rect key={s} x={s * w * 0.22 - pw / 2} y={-d / 2 + 12} width={pw} height={30} rx={6} fill="#f6f7f9" stroke="rgba(0,0,0,.12)" strokeWidth={1} />
          ))}
          <rect x={-w / 2 + 2} y={d * 0.02} width={w - 4} height={d / 2 - 6} rx={6} fill="#ddd3c6" stroke="rgba(0,0,0,.08)" strokeWidth={1} />
        </g>
      )
    }
    case 'sofa': {
      const arm = Math.min(20, w * 0.16)
      return (
        <g fill="none" stroke={line} strokeWidth={sw}>
          <line x1={-w / 2 + arm} x2={w / 2 - arm} y1={-d / 2 + Math.min(24, d * 0.26)} y2={-d / 2 + Math.min(24, d * 0.26)} />
          <line x1={-w / 2 + arm} x2={-w / 2 + arm} y1={-d / 2} y2={d / 2} />
          <line x1={w / 2 - arm} x2={w / 2 - arm} y1={-d / 2} y2={d / 2} />
        </g>
      )
    }
    case 'officeChair':
    case 'chair':
    case 'foldingChair':
      return <line x1={-w * 0.38} x2={w * 0.38} y1={-d / 2 + 7} y2={-d / 2 + 7} stroke={line} strokeWidth={sw * 2.5} strokeLinecap="round" />
    case 'bookshelf':
      return (
        <g stroke={line} strokeWidth={sw}>
          <line x1={-w / 2 + 2} x2={w / 2 - 2} y1={-d / 2 + 3} y2={-d / 2 + 3} />
          <line x1={0} x2={0} y1={-d / 2 + 3} y2={d / 2 - 2} />
        </g>
      )
    case 'desk':
    case 'table':
      return <rect x={-w / 2 + 4} y={-d / 2 + 4} width={w - 8} height={d - 8} rx={2} fill="none" stroke={line} strokeWidth={sw} />
    case 'floorLamp':
    case 'tripod':
    case 'lightStand':
      return (
        <g stroke={line} strokeWidth={sw * 1.5}>
          {[0, 120, 240].map((a) => {
            const r = (a * Math.PI) / 180
            return <line key={a} x1={0} y1={0} x2={Math.sin(r) * w * 0.45} y2={Math.cos(r) * d * 0.45} />
          })}
          <circle r={Math.min(w, d) * 0.12} fill={line} stroke="none" />
        </g>
      )
    case 'rug':
      return <rect x={-w / 2 + 6} y={-d / 2 + 6} width={w - 12} height={d - 12} fill="none" stroke={line} strokeWidth={sw} strokeDasharray="6 4" />
    default:
      return null
  }
}

function RoomShell({ room }: { room: Room }) {
  const { width: W, depth: D, wallThickness: T } = room
  return (
    <g>
      <rect x={-T} y={-T} width={W + 2 * T} height={T} fill={WALL} />
      <rect x={-T} y={D} width={W + 2 * T} height={T} fill={WALL} />
      <rect x={-T} y={-T} width={T} height={D + 2 * T} fill={WALL} />
      <rect x={W} y={-T} width={T} height={D + 2 * T} fill={WALL} />
      {room.finishes.map((f, i) => (
        <polygon key={i} points={pts([wallPoint(room, f.wall, f.from, 0), wallPoint(room, f.wall, f.to, 0), wallPoint(room, f.wall, f.to, 4), wallPoint(room, f.wall, f.from, 4)])} fill={f.color} />
      ))}
      {room.openings.map((o) => {
        const a = o.along - o.width / 2
        const b = o.along + o.width / 2
        const poly = [wallPoint(room, o.wall, a, 0), wallPoint(room, o.wall, b, 0), wallPoint(room, o.wall, b, -T), wallPoint(room, o.wall, a, -T)]
        const m1 = wallPoint(room, o.wall, a, -T / 2)
        const m2 = wallPoint(room, o.wall, b, -T / 2)
        if (o.kind === 'window')
          return (
            <g key={o.id}>
              <polygon points={pts(poly)} fill="#e6f0f8" stroke={WALL} strokeWidth={1.2} />
              <line x1={m1[0]} y1={m1[1]} x2={m2[0]} y2={m2[1]} stroke={WALL} strokeWidth={1.2} />
            </g>
          )
        const leaves = o.width > 100 ? 2 : 1
        return (
          <g key={o.id}>
            <polygon points={pts(poly)} fill="#f5ead9" />
            {Array.from({ length: leaves }, (_, i) => {
              const s = wallPoint(room, o.wall, a + (o.width / leaves) * i + 2, -T * 0.3)
              const e = wallPoint(room, o.wall, a + (o.width / leaves) * (i + 1) - 2, -T * 0.3)
              return <line key={i} x1={s[0]} y1={s[1]} x2={e[0]} y2={e[1]} stroke="#7a3b22" strokeWidth={3} strokeLinecap="round" />
            })}
          </g>
        )
      })}
    </g>
  )
}

function DimLine({ from, to, label, fs }: { from: Vec2; to: Vec2; label: string; fs: number }) {
  const mx = (from[0] + to[0]) / 2
  const mz = (from[1] + to[1]) / 2
  const vertical = Math.abs(from[0] - to[0]) < Math.abs(from[1] - to[1])
  return (
    <g pointerEvents="none">
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={SELECT} strokeWidth={fs * 0.12} strokeDasharray={`${fs * 0.4} ${fs * 0.3}`} />
      <g transform={`translate(${mx} ${mz})`}>
        <rect x={vertical ? fs * 0.3 : -fs * 1.6} y={vertical ? -fs * 0.65 : -fs * 1.55} width={fs * 3.2} height={fs * 1.25} rx={fs * 0.3} fill="white" stroke={SELECT} strokeWidth={fs * 0.08} />
        <text x={vertical ? fs * 1.9 : 0} y={vertical ? fs * 0.3 : -fs * 0.6} fontSize={fs} textAnchor="middle" fill={SELECT} fontWeight={600}>
          {label}
        </text>
      </g>
    </g>
  )
}

export function PlanView() {
  const room = useStore((s) => s.room)
  const items = useActiveItems()
  const selectedId = useStore((s) => s.selectedId)
  const baseItems = useStore((s) => (s.compare && s.activeVariantId !== CURRENT_VARIANT_ID ? s.variants.find((v) => v.id === CURRENT_VARIANT_ID)?.items : undefined))
  const issues = useMemo(() => fitIssues(room, items), [room, items])
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [scale, setScale] = useState(1)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const T = room.wallThickness
  const pad = 46
  const vb = { x: -T - pad, y: -T - pad, w: room.width + 2 * (T + pad), h: room.depth + 2 * (T + pad) }

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / vb.w, el.clientHeight / vb.h)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [vb.w, vb.h])

  /** Font size in cm that renders at `px` screen pixels. */
  const fs = (px: number) => px / (scale || 1)

  const toPlan = (e: { clientX: number; clientY: number }): Vec2 => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return [p.x, p.y]
  }

  const startMove = (e: ReactPointerEvent, item: Item) => {
    if (e.button !== 0) return
    e.stopPropagation()
    useStore.getState().select(item.id)
    if (item.locked) return
    svgRef.current?.setPointerCapture(e.pointerId)
    drag.current = { kind: 'move', id: item.id, start: toPlan(e), origin: item, moved: false }
  }

  const startRotate = (e: ReactPointerEvent, item: Item) => {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    drag.current = { kind: 'rotate', id: item.id, origin: item, moved: false }
  }

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const store = useStore.getState()
    const [px, pz] = toPlan(e)
    if (!d.moved) {
      store.checkpoint()
      d.moved = true
    }
    const o = d.origin
    if (d.kind === 'rotate' && o.place.type === 'floor') {
      const raw = (Math.atan2(-(px - o.place.x), pz - o.place.z) * 180) / Math.PI
      const rot = normRot(e.shiftKey ? raw : Math.round(raw / 15) * 15)
      const turned: Item = { ...o, place: { ...o.place, rot } }
      store.setPlace(o.id, { ...turned.place, ...clampFloor(room, turned, o.place.x, o.place.z) } as Item['place'])
      return
    }
    if (d.kind !== 'move') return
    const dx = px - d.start[0]
    const dz = pz - d.start[1]
    if (o.place.type === 'floor') {
      const c = clampFloor(room, o, o.place.x + dx, o.place.z + dz)
      store.setPlace(o.id, { ...o.place, ...c })
    } else {
      // Wall items slide along walls and hop to whichever wall the pointer is nearest.
      const startCentre = wallPoint(room, o.place.wall, o.place.along)
      const target: Vec2 = [startCentre[0] + dx, startCentre[1] + dz]
      const near = nearestWall(room, target[0], target[1])
      const c = clampWall(room, o.size, near.wall, near.along, o.place.elev)
      store.setPlace(o.id, { type: 'wall', wall: near.wall, ...c })
    }
  }

  const endDrag = () => {
    drag.current = null
  }

  const selected = items.find((i) => i.id === selectedId) ?? null
  const ordered = [...items.filter((i) => !i.hidden)].sort((a, b) => {
    const rank = (i: Item) => (i.shape === 'rug' ? 0 : i.place.type === 'wall' ? 2 : 1) + (i.id === selectedId ? 10 : 0)
    return rank(a) - rank(b)
  })

  const renderItem = (item: Item) => {
    const issue = issues.get(item.id)
    const error = issue?.some((i) => i.severity === 'error')
    const isSel = item.id === selectedId
    const stroke = isSel ? SELECT : error ? ERROR : 'rgba(0,0,0,.45)'
    const strokeWidth = isSel ? fs(2) : error ? fs(1.5) : fs(0.8)
    const dash = error && !isSel ? `${fs(4)} ${fs(3)}` : undefined
    const common = {
      onPointerDown: (e: ReactPointerEvent) => startMove(e, item),
      onPointerEnter: () => setHoverId(item.id),
      onPointerLeave: () => setHoverId((h) => (h === item.id ? null : h)),
      style: { cursor: item.locked ? 'pointer' : 'grab' },
    }
    if (item.place.type === 'wall') {
      // Draw thin wall items at least 5 cm thick so they can be grabbed.
      const depth = Math.max(item.size.d, 5)
      const { wall, along } = item.place
      const a = along - item.size.w / 2
      const b = along + item.size.w / 2
      const poly = [wallPoint(room, wall, a, 0), wallPoint(room, wall, b, 0), wallPoint(room, wall, b, depth), wallPoint(room, wall, a, depth)]
      return (
        <g key={item.id} {...common}>
          <polygon points={pts(poly)} fill={item.color} fillOpacity={item.shape === 'curtain' ? 0.75 : 0.95} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={item.shape === 'curtain' && !isSel ? `${fs(3)} ${fs(2)}` : dash} />
          <title>{`${item.name} — ${item.size.w}×${item.size.h} cm`}</title>
        </g>
      )
    }
    const { x, z, rot } = item.place
    const { w, d } = item.size
    return (
      <g key={item.id} transform={`translate(${x} ${z}) rotate(${rot})`} {...common}>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={Math.min(5, w / 8, d / 8)} fill={item.color} fillOpacity={isSoft(item.shape) ? 0.55 : 0.92} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
        <Glyph item={item} />
        <title>{`${item.name} — ${item.size.w}×${item.size.d}×${item.size.h} cm`}</title>
      </g>
    )
  }

  const label = (item: Item) => {
    if (item.place.type === 'wall') {
      if (item.id !== selectedId && item.id !== hoverId) return null
      const [lx, lz] = wallPoint(room, item.place.wall, item.place.along, Math.max(item.size.d, 5) + fs(12))
      return (
        <text key={`l-${item.id}`} x={lx} y={lz} fontSize={fs(10.5)} textAnchor="middle" className="plan-label" fill="#1c1917" pointerEvents="none">
          {item.name}
        </text>
      )
    }
    const box = aabb(footprint(room, item))
    const widthPx = (box.maxX - box.minX) * scale
    const show = item.id === selectedId || item.id === hoverId || (widthPx > 46 && (box.maxZ - box.minZ) * scale > 18)
    if (!show) return null
    const sizeLine = item.id === selectedId ? `${item.size.w} × ${item.size.d}` : null
    // Long shop names get shortened to what fits inside the item.
    const maxChars = Math.max(6, Math.floor(widthPx / 6.4))
    const name = item.name.length > maxChars ? `${item.name.slice(0, maxChars - 1).trimEnd()}…` : item.name
    const dark = luminance(item.color) < 0.5 && !isSoft(item.shape) && item.shape !== 'bed'
    const { x, z } = item.place
    return (
      <g key={`l-${item.id}`} className={dark ? 'plan-label dark' : 'plan-label'} pointerEvents="none" textAnchor="middle">
        <text x={x} y={z + fs(sizeLine ? -2 : 4)} fontSize={fs(10.5)}>
          {name}
        </text>
        {sizeLine && (
          <text x={x} y={z + fs(11)} fontSize={fs(9.5)} className="plan-sub">
            {sizeLine}
          </text>
        )}
      </g>
    )
  }

  const selectionDecor = () => {
    if (!selected) return null
    const f = fs(10)
    if (selected.place.type === 'wall') {
      const { wall, along } = selected.place
      const L = wallLength(room, wall)
      const a = along - selected.size.w / 2
      const b = along + selected.size.w / 2
      const off = Math.max(selected.size.d, 5) + fs(4)
      return (
        <g>
          {a > 1 && <DimLine from={wallPoint(room, wall, 0, off)} to={wallPoint(room, wall, a, off)} label={`${Math.round(a)}`} fs={f} />}
          {L - b > 1 && <DimLine from={wallPoint(room, wall, b, off)} to={wallPoint(room, wall, L, off)} label={`${Math.round(L - b)}`} fs={f} />}
        </g>
      )
    }
    const dist = wallDistances(room, selected)
    const box = aabb(footprint(room, selected))
    const cx = (box.minX + box.maxX) / 2
    const cz = (box.minZ + box.maxZ) / 2
    const { x, z, rot } = selected.place
    const r = (rot * Math.PI) / 180
    const reach = selected.size.d / 2 + fs(22)
    const hx = x - Math.sin(r) * reach
    const hz = z + Math.cos(r) * reach
    return (
      <g>
        {dist.west > 1 && <DimLine from={[0, cz]} to={[box.minX, cz]} label={`${Math.round(dist.west)}`} fs={f} />}
        {dist.east > 1 && <DimLine from={[box.maxX, cz]} to={[room.width, cz]} label={`${Math.round(dist.east)}`} fs={f} />}
        {dist.north > 1 && <DimLine from={[cx, 0]} to={[cx, box.minZ]} label={`${Math.round(dist.north)}`} fs={f} />}
        {dist.south > 1 && <DimLine from={[cx, box.maxZ]} to={[cx, room.depth]} label={`${Math.round(dist.south)}`} fs={f} />}
        {!selected.locked && (
          <g onPointerDown={(e) => startRotate(e, selected)} style={{ cursor: 'grab' }}>
            <line x1={x} y1={z} x2={hx} y2={hz} stroke={SELECT} strokeWidth={fs(1.2)} pointerEvents="none" />
            <circle cx={hx} cy={hz} r={fs(7)} fill="white" stroke={SELECT} strokeWidth={fs(2)} />
            <path
              d={`M ${hx - fs(3)} ${hz - fs(1)} A ${fs(3)} ${fs(3)} 0 1 1 ${hx + fs(1)} ${hz + fs(3)}`}
              fill="none"
              stroke={SELECT}
              strokeWidth={fs(1.3)}
              pointerEvents="none"
            />
            <title>Drag to rotate (hold Shift for free rotation)</title>
          </g>
        )}
      </g>
    )
  }

  const gridLines = []
  for (let gx = 50; gx < room.width; gx += 50) gridLines.push(<line key={`x${gx}`} x1={gx} x2={gx} y1={0} y2={room.depth} strokeWidth={gx % 100 === 0 ? 0.7 : 0.35} />)
  for (let gz = 50; gz < room.depth; gz += 50) gridLines.push(<line key={`z${gz}`} y1={gz} y2={gz} x1={0} x2={room.width} strokeWidth={gz % 100 === 0 ? 0.7 : 0.35} />)

  const wallLabel = (wall: WallId) => {
    const f = wallFrame(room, wall)
    const [x, z] = wallPoint(room, wall, f.length / 2, -T - fs(14))
    const rotate = wall === 'east' ? 90 : wall === 'west' ? -90 : 0
    return (
      <text key={wall} x={x} y={z} fontSize={fs(10)} textAnchor="middle" dominantBaseline="middle" fill="#78716c" transform={`rotate(${rotate} ${x} ${z})`} pointerEvents="none">
        {wall === 'north' || wall === 'south' ? `${room.width} cm` : `${room.depth} cm`}
      </text>
    )
  }

  return (
    <svg
      ref={svgRef}
      className="plan-svg"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      onPointerDown={(e) => e.button === 0 && useStore.getState().select(null)}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <rect x={0} y={0} width={room.width} height={room.depth} fill="#f4e9da" />
      <g stroke="#d9c7ae">{gridLines}</g>
      <RoomShell room={room} />
      {(['north', 'west'] as WallId[]).map(wallLabel)}
      {baseItems?.filter((i) => !i.hidden).map((i) => (
        <polygon key={`ghost-${i.id}`} points={pts(footprint(room, i))} fill="none" stroke="#78716c" strokeWidth={fs(1.2)} strokeDasharray={`${fs(4)} ${fs(3)}`} pointerEvents="none" />
      ))}
      {ordered.map(renderItem)}
      {ordered.map(label)}
      {selectionDecor()}
      <g transform={`translate(${room.width + T + fs(14)} ${-T - fs(20)})`} pointerEvents="none">
        <path d={`M 0 ${-fs(9)} L ${fs(5)} ${fs(5)} L 0 ${fs(2)} L ${-fs(5)} ${fs(5)} Z`} fill="#57534e" />
        <text y={fs(17)} fontSize={fs(9)} textAnchor="middle" fill="#57534e" fontWeight={700}>
          N
        </text>
      </g>
    </svg>
  )
}
