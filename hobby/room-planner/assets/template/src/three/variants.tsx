import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Item } from '../types'
import { bentPanelGeometry, cushionGeometry, duvetGeometry, pillowGeometry, tubeAlong } from './geometries'
import { cachedGeometry, material, type MatKind } from './materials'
import { Art, Ball, Cyl, lerp3, Part, Rod, rng, Shape, type V3 } from './parts'

// Looks for the real products in the shop: each takes its style from the product photo
// (a panel bed, an arc lamp, a barrel chair…). Same conventions as models.tsx: metres, floor
// models centred on their footprint with the front facing +z, wall models hanging from z = 0.

const WOOD_LEG = '#b98a5c'
const DARK = '#1f1f1f'

export function sizeM(item: Item) {
  return { w: item.size.w / 100, d: item.size.d / 100, h: item.size.h / 100 }
}

/** The main soft surface: fabric, velvet, bouclé or leather. */
export function softMat(item: Item, fallback: MatKind = 'upholstery'): MatKind {
  switch (item.finish) {
    case 'velvet':
      return 'velvet'
    case 'boucle':
      return 'boucle'
    case 'leather':
      return 'leather'
    case 'fabric':
      return 'upholstery'
    default:
      return fallback
  }
}

/** Hard surfaces: real wood grain, or a smooth painted/laminate finish. */
export function hardMat(item: Item, fallback: MatKind = 'wood'): MatKind {
  if (item.finish === 'painted') return 'laminate'
  if (item.finish === 'metal') return 'paintedMetal'
  if (item.finish === 'wood') return 'wood'
  return fallback
}

// ---------------------------------------------------------------- beds

/** Mattress, two pillows and a duvet, for any bed frame. */
function Bedding({ mw, md, bottom, z0, sheet }: { mw: number; md: number; bottom: number; z0: number; sheet: string }) {
  const mattH = 0.24
  const top = bottom + mattH
  return (
    <group>
      <Shape geometry={cushionGeometry(mw, mattH, md, 0.03)} mat="fabric" color={sheet} pos={[0, bottom + mattH / 2, z0 + md / 2]} />
      {[-1, 1].map((sx) => (
        <Shape key={sx} geometry={pillowGeometry(Math.min(0.66, mw * 0.45), 0.17, 0.44)} mat="fabric" color="#eef1f5" pos={[sx * mw * 0.245, top + 0.1, z0 + 0.26]} rot={[-0.28, sx * 0.05, sx * 0.02]} />
      ))}
      <Shape geometry={duvetGeometry(mw, md, 0.58, mattH + 0.04, 7)} mat="fabric" color="#e4ddd2" pos={[0, top, z0 + md]} />
    </group>
  )
}

export function BedVariant({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const sheet = item.color2 ?? '#e9edf2'
  const style = item.style
  if (style === 'wood') {
    // Oak bed with storage drawers along the side and a low panel headboard.
    const baseTop = 0.36
    const headT = 0.05
    const mat = hardMat(item)
    return (
      <group>
        <Part size={[w - 0.04, 0.05, d - 0.08]} mat="plastic" color={DARK} pos={[0, 0.025, 0.02]} />
        <Part size={[w, baseTop - 0.05, d - headT]} radius={0.006} mat={mat} color={item.color} pos={[0, 0.05 + (baseTop - 0.05) / 2, headT / 2]} />
        {[0, 1, 2].map((i) => {
          const len = (d - headT - 0.1) / 3
          const z = -d / 2 + headT + 0.05 + len * (i + 0.5)
          return (
            <group key={i} position={[w / 2 + 0.001, 0.05 + (baseTop - 0.05) / 2, z]}>
              <Part size={[0.002, baseTop - 0.1, len - 0.01]} mat="plastic" color="#5a4430" pos={[0, 0, 0]} shadow={false} />
              <Part size={[0.012, 0.012, 0.12]} radius={0.004} mat="metal" color="#9a9a9a" pos={[0.008, 0.06, 0]} />
            </group>
          )
        })}
        <Part size={[w, h - 0.05, headT]} radius={0.01} mat={mat} color={item.color} pos={[0, 0.05 + (h - 0.05) / 2, -d / 2 + headT / 2]} />
        <Bedding mw={w - 0.06} md={d - headT - 0.05} bottom={baseTop - 0.02} z0={-d / 2 + headT + 0.01} sheet={sheet} />
      </group>
    )
  }
  if (style === 'panel') {
    // Traditional wooden bed: posts, raised panels, a crown on the headboard and a lower footboard.
    const mat = hardMat(item)
    const post = 0.075
    const footH = Math.min(0.62, h * 0.42)
    const darker = new THREE.Color(item.color).multiplyScalar(0.8).getStyle()
    return (
      <group>
        {[
          [-1, -1, h],
          [1, -1, h],
          [-1, 1, footH],
          [1, 1, footH],
        ].map(([sx, sz, ph], i) => (
          <group key={i} position={[sx * (w / 2 - post / 2), 0, sz * (d / 2 - post / 2)]}>
            <Part size={[post, ph - 0.03, post]} radius={0.006} mat={mat} color={item.color} pos={[0, 0.03 + (ph - 0.03) / 2, 0]} />
            <Ball r={0.045} mat={mat} color={darker} pos={[0, 0.025, 0]} scale={[1, 0.6, 1]} />
          </group>
        ))}
        <Part size={[w - 2 * post, h * 0.6, 0.035]} mat={mat} color={item.color} pos={[0, h * 0.62, -d / 2 + post / 2]} />
        {[-1, 1].map((sx) => (
          <Part key={sx} size={[(w - 2 * post) / 2 - 0.08, h * 0.42, 0.012]} radius={0.004} mat={mat} color={darker} pos={[sx * ((w - 2 * post) / 4), h * 0.6, -d / 2 + post / 2 + 0.022]} />
        ))}
        <Part size={[w + 0.06, 0.06, post + 0.05]} radius={0.01} mat={mat} color={item.color} pos={[0, h - 0.03, -d / 2 + post / 2]} />
        <Part size={[w - 2 * post, footH * 0.55, 0.035]} mat={mat} color={item.color} pos={[0, footH * 0.55, d / 2 - post / 2]} />
        {[-1, 1].map((sx) => (
          <Part key={sx} size={[0.04, 0.2, d - 2 * post]} mat={mat} color={item.color} pos={[sx * (w / 2 - 0.03), 0.32, 0]} />
        ))}
        <Bedding mw={w - 0.12} md={d - 2 * post - 0.02} bottom={0.38} z0={-d / 2 + post + 0.01} sheet={sheet} />
      </group>
    )
  }
  // 'cushioned': low upholstered platform with a deep, padded headboard.
  const mat = softMat(item)
  const baseTop = 0.3
  const headT = 0.24
  const headH = h - 0.04
  return (
    <group>
      <Part size={[w - 0.08, 0.04, d - 0.1]} mat="plastic" color={DARK} pos={[0, 0.02, 0]} />
      <Shape geometry={cushionGeometry(w, baseTop - 0.04, d - headT + 0.04, 0.04)} mat={mat} color={item.color} pos={[0, 0.04 + (baseTop - 0.04) / 2, headT / 2 - 0.02]} />
      <Part size={[w, headH, 0.08]} radius={0.03} mat={mat} color={item.color} pos={[0, 0.04 + headH / 2, -d / 2 + 0.04]} />
      {[0.42, 0.78].map((t) => (
        <Shape key={t} geometry={cushionGeometry(w - 0.04, headH * 0.36, 0.17, 0.2)} mat={mat} color={item.color} pos={[0, 0.04 + headH * t, -d / 2 + 0.15]} rot={[-0.06, 0, 0]} />
      ))}
      <Bedding mw={w - 0.1} md={d - headT - 0.04} bottom={baseTop - 0.03} z0={-d / 2 + headT} sheet={sheet} />
    </group>
  )
}

// ---------------------------------------------------------------- desks

export function DeskVariant({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const legColor = item.color2 ?? DARK
  const topMat = hardMat(item, 'laminate')
  if (item.style === 'classic') {
    // Farmhouse desk: painted turned legs, an apron with drawers, a wooden top.
    const base = item.color2 ?? '#efeee8'
    const apron = 0.13
    return (
      <group>
        <Part size={[w, 0.035, d]} radius={0.006} mat="wood" color={item.color} pos={[0, h - 0.0175, 0]} />
        <Part size={[w - 0.08, apron, d - 0.08]} mat="laminate" color={base} pos={[0, h - 0.035 - apron / 2, 0]} />
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * w * 0.24, h - 0.035 - apron / 2, d / 2 - 0.039]}>
            <Part size={[w * 0.38, apron - 0.03, 0.012]} radius={0.003} mat="laminate" color={base} />
            <Ball r={0.012} mat="metal" color="#b9b9b2" pos={[0, 0, 0.012]} />
          </group>
        ))}
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => {
            const x = sx * (w / 2 - 0.05)
            const z = sz * (d / 2 - 0.05)
            const legH = h - 0.035 - apron
            return (
              <group key={`${sx}${sz}`} position={[x, 0, z]}>
                <Cyl r={0.022} r2={0.03} h={legH * 0.55} mat="laminate" color={base} pos={[0, legH * 0.275, 0]} />
                <Ball r={0.034} mat="laminate" color={base} pos={[0, legH * 0.58, 0]} />
                <Part size={[0.06, legH * 0.38, 0.06]} mat="laminate" color={base} pos={[0, legH * 0.8, 0]} />
              </group>
            )
          }),
        )}
      </group>
    )
  }
  // 'drawers': wooden top over a drawer apron, on dark tubular metal legs.
  const apron = 0.12
  return (
    <group>
      <Part size={[w, 0.035, d]} radius={0.004} mat={topMat} color={item.color} pos={[0, h - 0.0175, 0]} />
      <Part size={[w - 0.06, apron, d - 0.08]} mat={topMat} color={item.color} pos={[0, h - 0.035 - apron / 2, 0]} />
      {[-1, 0, 1].map((i) => (
        <group key={i} position={[i * (w / 3), h - 0.035 - apron / 2, d / 2 - 0.039]}>
          <Part size={[w / 3 - 0.04, apron - 0.03, 0.006]} mat={topMat} color={item.color} />
          <Part size={[0.1, 0.012, 0.016]} radius={0.005} mat="metal" color={legColor} pos={[0, 0, 0.012]} />
        </group>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Part key={`${sx}${sz}`} size={[0.035, h - 0.035, 0.035]} radius={0.004} mat="paintedMetal" color={legColor} pos={[sx * (w / 2 - 0.03), (h - 0.035) / 2, sz * (d / 2 - 0.03)]} />),
      )}
      {[-1, 1].map((sx) => (
        <Part key={sx} size={[0.025, 0.025, d - 0.06]} mat="paintedMetal" color={legColor} pos={[sx * (w / 2 - 0.03), 0.12, 0]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- sofas and armchairs

function TaperedLegs({ w, d, h, color, inset = 0.07, splay = 0.08, count = 4 }: { w: number; d: number; h: number; color: string; inset?: number; splay?: number; count?: 4 | 6 }) {
  const xs = count === 6 ? [-1, 0, 1] : [-1, 1]
  return (
    <>
      {xs.flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Cyl key={`${sx}${sz}`} r={0.014} r2={0.022} h={h} mat="wood" color={color} pos={[sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset)]} rot={[sz * splay, 0, -sx * splay]} />
        )),
      )}
    </>
  )
}

export function SofaVariant({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const mat = softMat(item)
  const c = item.color
  const legColor = item.color2 ?? WOOD_LEG
  const style = item.style ?? ''

  if (style === 'wing') {
    const legH = 0.16
    const seat = 0.43
    return (
      <group>
        <TaperedLegs w={w * 0.8} d={d * 0.8} h={legH} color={legColor} />
        <Shape geometry={cushionGeometry(w * 0.86, seat - legH, d * 0.9, 0.06)} mat={mat} color={c} pos={[0, legH + (seat - legH) / 2, 0.02]} />
        <Shape geometry={cushionGeometry(w * 0.62, 0.12, d * 0.62, 0.16)} mat={mat} color={c} pos={[0, seat + 0.03, 0.1]} />
        <Shape geometry={bentPanelGeometry(w * 0.82, h - seat + 0.05, 0.14, 0.5)} mat={mat} color={c} pos={[0, seat + (h - seat) / 2 - 0.02, -d / 2 + 0.1]} rot={[-0.12, 0, 0]} />
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <Shape geometry={cushionGeometry(0.11, 0.2, d * 0.62, 0.12)} mat={mat} color={c} pos={[sx * (w / 2 - 0.08), seat + 0.1, 0.03]} />
            <Shape geometry={cushionGeometry(0.1, (h - seat) * 0.62, 0.3, 0.12)} mat={mat} color={c} pos={[sx * (w / 2 - 0.07), h - (h - seat) * 0.36, -d / 2 + 0.2]} rot={[0, sx * 0.35, 0]} />
          </group>
        ))}
      </group>
    )
  }
  if (style === 'highback-metal') {
    const legH = 0.24
    const seat = 0.45
    const backH = h - seat + 0.02
    return (
      <group>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <Rod key={`${sx}${sz}`} from={[sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.06)]} to={[sx * (w / 2 - 0.12), legH, sz * (d / 2 - 0.16)]} r={0.008} r2={0.012} mat="paintedMetal" color={legColor} />),
        )}
        <Shape geometry={cushionGeometry(w * 0.86, seat - legH, d * 0.78, 0.12)} mat={mat} color={c} pos={[0, legH + (seat - legH) / 2, 0.04]} />
        <group position={[0, seat - 0.04, -d / 2 + 0.12]} rotation={[-0.2, 0, 0]}>
          <Shape geometry={bentPanelGeometry(w * 0.92, backH, 0.1, 0.45)} mat={mat} color={c} pos={[0, backH / 2, 0]} />
          {[0.3, 0.5, 0.7, 0.88].map((t) => (
            <Shape key={t} geometry={bentPanelGeometry(w * 0.84, 0.006, 0.004, 0.45)} mat={mat} color={new THREE.Color(c).multiplyScalar(0.7).getStyle()} pos={[0, backH * t, 0.051]} />
          ))}
        </group>
      </group>
    )
  }
  if (style === 'frame-metal') {
    // Leather cushions slung in a thin black metal frame.
    const seat = 0.42
    const f = item.color2 ?? DARK
    return (
      <group>
        {[-1, 1].map((sx) => {
          const x = sx * (w / 2 - 0.02)
          return (
            <group key={sx}>
              <Rod from={[x, 0, d / 2 - 0.05]} to={[x, 0.6, d / 2 - 0.05]} r={0.012} mat="paintedMetal" color={f} />
              <Rod from={[x, 0, -d / 2 + 0.06]} to={[x, 0.6, -d / 2 + 0.06]} r={0.012} mat="paintedMetal" color={f} />
              <Rod from={[x, 0.6, d / 2 - 0.05]} to={[x, 0.6, -d / 2 + 0.06]} r={0.012} mat="paintedMetal" color={f} />
              <Rod from={[x, 0.02, d / 2 - 0.05]} to={[x, 0.02, -d / 2 + 0.06]} r={0.012} mat="paintedMetal" color={f} />
              <Shape geometry={cushionGeometry(0.05, 0.03, d - 0.14, 0.1)} mat="leather" color={c} pos={[x, 0.625, 0]} />
            </group>
          )
        })}
        <Shape geometry={cushionGeometry(w - 0.1, 0.12, d - 0.16, 0.14)} mat={mat} color={c} pos={[0, seat, 0.03]} />
        <Shape geometry={cushionGeometry(w - 0.1, h - seat - 0.02, 0.12, 0.14)} mat={mat} color={c} pos={[0, seat + (h - seat) / 2 + 0.03, -d / 2 + 0.12]} rot={[-0.2, 0, 0]} />
      </group>
    )
  }
  if (style === 'barrel') {
    // Round swivel barrel chair: one curved channel-tufted shell around a deep seat, on a low plinth.
    const seat = 0.44
    const R = Math.min(w, d) / 2 - 0.02
    const arc = Math.PI * 1.3
    const backH = h - 0.06
    const channels = 10
    const groove = new THREE.Color(c).multiplyScalar(0.72).getStyle()
    return (
      <group>
        <Cyl r={R * 0.55} h={0.05} mat="metal" color={item.color2 ?? '#b8954e'} pos={[0, 0.025, 0]} segments={40} />
        <Shape geometry={cushionGeometry(R * 1.75, seat - 0.05, R * 1.75, 0.06)} mat={mat} color={c} pos={[0, 0.05 + (seat - 0.05) / 2, 0]} />
        <Shape geometry={cushionGeometry(R * 1.4, 0.12, R * 1.35, 0.22)} mat={mat} color={c} pos={[0, seat + 0.03, 0.05]} />
        <Shape geometry={bentPanelGeometry(R * arc, backH - 0.05, 0.12, R)} mat={mat} color={c} pos={[0, 0.05 + (backH - 0.05) / 2, -R]} />
        {Array.from({ length: channels - 1 }, (_, i) => {
          const a = ((i + 1) / channels - 0.5) * arc
          const rr = R - 0.066
          return <Part key={i} size={[0.008, (backH - seat) * 0.9, 0.01]} mat={mat} color={groove} pos={[rr * Math.sin(a), seat + (backH - seat) * 0.5 + 0.02, -rr * Math.cos(a) + 0]} rot={[0, -a, 0]} shadow={false} />
        })}
      </group>
    )
  }
  // 'modern-wood' / 'modern-hidden': straight track arms, loose cushions; wooden legs or low feet.
  const hidden = style === 'modern-hidden'
  const legH = hidden ? 0.05 : 0.15
  const seatTop = Math.min(0.47, h * 0.58)
  const armW = Math.min(0.17, w * 0.1)
  const armTop = Math.min(seatTop + 0.17, h - 0.08)
  const backD = Math.min(0.22, d * 0.26)
  const cushions = w > 1.75 ? 3 : 2
  const innerW = w - 2 * armW
  const cw = innerW / cushions
  return (
    <group>
      {hidden ? (
        [-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Part key={`${sx}${sz}`} size={[0.05, legH, 0.05]} mat="plastic" color={item.color2 ?? DARK} pos={[sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.08)]} />))
      ) : (
        <TaperedLegs w={w} d={d} h={legH} color={legColor} count={w > 1.8 ? 6 : 4} />
      )}
      <Part size={[w, seatTop - legH - 0.13, d]} radius={0.03} mat={mat} color={c} pos={[0, legH + (seatTop - legH - 0.13) / 2, 0]} />
      {[-1, 1].map((sx) => (
        <Shape key={sx} geometry={cushionGeometry(armW, armTop - legH, d, 0.04)} mat={mat} color={c} pos={[sx * (w / 2 - armW / 2), legH + (armTop - legH) / 2, 0]} />
      ))}
      <Shape geometry={cushionGeometry(innerW + 0.02, h - legH - 0.02, backD, 0.06)} mat={mat} color={c} pos={[0, legH + (h - legH) / 2, -d / 2 + backD / 2]} />
      {Array.from({ length: cushions }, (_, i) => {
        const x = -innerW / 2 + cw * (i + 0.5)
        return (
          <group key={i}>
            <Shape geometry={cushionGeometry(cw - 0.01, 0.14, d - backD - 0.03, 0.12)} mat={mat} color={c} pos={[x, seatTop - 0.06, backD / 2 + 0.01]} />
            <Shape geometry={cushionGeometry(cw - 0.03, h - seatTop - 0.05, 0.16, 0.18)} mat={mat} color={c} pos={[x, seatTop + (h - seatTop) / 2 - 0.02, -d / 2 + backD + 0.06]} rot={[-0.16, 0, 0]} />
          </group>
        )
      })}
      {hidden &&
        [-1, 1].map((sx) => (
          <Shape key={sx} geometry={pillowGeometry(0.42, 0.13, 0.42)} mat="fabric" color="#c9b28a" pos={[sx * (innerW / 2 - 0.2), seatTop + 0.2, -d / 2 + backD + 0.16]} rot={[Math.PI / 2 - 0.3, 0, sx * 0.15]} />
        ))}
    </group>
  )
}

// ---------------------------------------------------------------- tables

export function TableVariant({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const mat = hardMat(item, 'wood')
  if (item.style === 'round-pedestal') {
    const r = Math.min(w, d) / 2
    return (
      <group>
        <Cyl r={r} h={0.03} mat={mat} color={item.color} pos={[0, h - 0.015, 0]} segments={48} />
        {[0, Math.PI / 2].map((a) => (
          <Part key={a} size={[r * 1.3, h - 0.03, 0.025]} mat={mat} color={item.color} pos={[0, (h - 0.03) / 2, 0]} rot={[0, a, 0]} />
        ))}
      </group>
    )
  }
  if (item.style === 'cabinet-metal') {
    // Oval coffee table: a cabinet with rounded ends and slatted doors, on thin black legs.
    const legH = 0.12
    const body = h - legH
    const r = d / 2
    const slats = Math.round((w - d) / 0.025)
    return (
      <group>
        <Part size={[w - d, body, d]} mat={mat} color={item.color} pos={[0, legH + body / 2, 0]} />
        {[-1, 1].map((sx) => (
          <Cyl key={sx} r={r} h={body} mat={mat} color={item.color} pos={[sx * (w / 2 - r), legH + body / 2, 0]} segments={36} />
        ))}
        {Array.from({ length: slats }, (_, i) => (
          <Part key={i} size={[0.004, body * 0.7, 0.003]} mat="plastic" color={new THREE.Color(item.color).multiplyScalar(0.7).getStyle()} pos={[-(w - d) / 2 + (i + 0.5) * ((w - d) / slats), legH + body / 2, d / 2 + 0.001]} shadow={false} />
        ))}
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Rod key={`${sx}${sz}`} from={[sx * (w / 2 - r), 0, sz * r * 0.6]} to={[sx * (w / 2 - r * 0.9), legH, sz * r * 0.5]} r={0.008} mat="paintedMetal" color={item.color2 ?? DARK} />))}
      </group>
    )
  }
  // 'shelf-wood': square side table with a slatted lower shelf.
  return (
    <group>
      <Part size={[w, 0.022, d]} radius={0.008} mat={mat} color={item.color} pos={[0, h - 0.011, 0]} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Part key={`${sx}${sz}`} size={[0.035, h - 0.022, 0.035]} radius={0.006} mat={mat} color={item.color} pos={[sx * (w / 2 - 0.03), (h - 0.022) / 2, sz * (d / 2 - 0.03)]} />))}
      {Array.from({ length: 5 }, (_, i) => (
        <Part key={i} size={[w - 0.08, 0.012, (d - 0.08) / 5 - 0.008]} mat={mat} color={item.color} pos={[0, 0.12, -d / 2 + 0.04 + ((d - 0.08) / 5) * (i + 0.5)]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- storage

export function StorageVariant({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const mat = hardMat(item, 'laminate')
  const groove = new THREE.Color(item.color).multiplyScalar(0.6).getStyle()
  const handle = '#9c9c98'
  const style = item.style ?? 'drawers'
  if (style === 'legs') {
    // A drawer box on tall splayed legs (mid-century bedside table).
    const box = Math.min(0.24, h * 0.45)
    const legH = h - box
    return (
      <group>
        <Part size={[w, box, d]} radius={0.006} mat={mat} color={item.color} pos={[0, legH + box / 2, 0]} />
        <Part size={[w - 0.03, box - 0.05, 0.003]} mat="plastic" color={groove} pos={[0, legH + box / 2, d / 2 + 0.001]} shadow={false} />
        <Ball r={0.012} mat="metal" color="#c8a865" pos={[0, legH + box / 2, d / 2 + 0.012]} />
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => <Rod key={`${sx}${sz}`} from={[sx * (w / 2 - 0.01), 0, sz * (d / 2 - 0.01)]} to={[sx * (w / 2 - 0.05), legH, sz * (d / 2 - 0.05)]} r={0.012} r2={0.018} mat="wood" color={item.color2 ?? item.color} />),
        )}
      </group>
    )
  }
  const plinth = 0.06
  const body = h - plinth
  const top = item.color2 && style === 'drawers' && d < 0.5 && h < 0.9
  const doorsH = style === 'combi' ? body * 0.62 : style === 'doors' ? body : 0
  const drawerZone = body - doorsH
  const drawers = style === 'doors' ? 0 : Math.max(1, Math.round(drawerZone / (style === 'combi' ? 0.2 : 0.24)))
  return (
    <group>
      <Part size={[w - 0.03, plinth, d - 0.05]} mat="plastic" color={DARK} pos={[0, plinth / 2, -0.01]} />
      <Part size={[w, body, d]} radius={0.005} mat={mat} color={item.color} pos={[0, plinth + body / 2, 0]} />
      {top && <Part size={[w + 0.02, 0.025, d + 0.02]} radius={0.004} mat="wood" color={item.color2!} pos={[0, h + 0.0125, 0]} />}
      {doorsH > 0 && (
        <group position={[0, plinth + drawerZone + doorsH / 2, d / 2 + 0.001]}>
          <Part size={[0.003, doorsH - 0.02, 0.002]} mat="plastic" color={groove} shadow={false} />
          {[-1, 1].map((sx) => (
            <Part key={sx} size={[0.014, Math.min(0.3, doorsH * 0.2), 0.016]} radius={0.006} mat="metal" color={handle} pos={[sx * 0.04, -doorsH * 0.05, 0.012]} />
          ))}
        </group>
      )}
      {Array.from({ length: drawers }, (_, i) => {
        const dh = drawerZone / drawers
        const y = plinth + dh * i
        return (
          <group key={i}>
            {(i > 0 || doorsH > 0) && <Part size={[w - 0.01, 0.003, 0.002]} mat="plastic" color={groove} pos={[0, y + (i === 0 ? drawerZone : 0) * 0, d / 2 + 0.001]} shadow={false} />}
            <Part size={[Math.min(0.14, w * 0.3), 0.012, 0.016]} radius={0.005} mat="metal" color={handle} pos={[0, y + dh * 0.62, d / 2 + 0.012]} />
          </group>
        )
      })}
      {doorsH > 0 && drawers > 0 && <Part size={[w - 0.01, 0.004, 0.002]} mat="plastic" color={groove} pos={[0, plinth + drawerZone, d / 2 + 0.001]} shadow={false} />}
    </group>
  )
}

// ---------------------------------------------------------------- shelving

export function MetalShelving({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const frame = item.color2 ?? DARK
  const shelves = Math.max(3, Math.round(h / 0.36))
  const gap = (h - 0.05) / (shelves - 1)
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Part key={`${sx}${sz}`} size={[0.02, h, 0.02]} mat="paintedMetal" color={frame} pos={[sx * (w / 2 - 0.01), h / 2, sz * (d / 2 - 0.01)]} />),
      )}
      <Rod from={[-w / 2 + 0.02, 0.05, -d / 2 + 0.01]} to={[w / 2 - 0.02, h - 0.05, -d / 2 + 0.01]} r={0.004} mat="paintedMetal" color={frame} />
      <Rod from={[w / 2 - 0.02, 0.05, -d / 2 + 0.01]} to={[-w / 2 + 0.02, h - 0.05, -d / 2 + 0.01]} r={0.004} mat="paintedMetal" color={frame} />
      {Array.from({ length: shelves }, (_, i) => (
        <Part key={i} size={[w - 0.02, 0.018, d - 0.02]} mat="wood" color={item.color} pos={[0, 0.05 + gap * i, 0]} />
      ))}
    </group>
  )
}

/** A wall-hung shelf unit: an elongated octagon of thin metal holding wooden shelves. */
export function LadderShelf({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const frame = item.color2 ?? DARK
  const c = w * 0.22
  const pts: V3[] = [
    [-w / 2 + c, 0, d / 2],
    [w / 2 - c, 0, d / 2],
    [w / 2, c, d / 2],
    [w / 2, h - c, d / 2],
    [w / 2 - c, h, d / 2],
    [-w / 2 + c, h, d / 2],
    [-w / 2, h - c, d / 2],
    [-w / 2, c, d / 2],
  ]
  return (
    <group>
      {pts.map((p, i) => (
        <Rod key={i} from={p} to={pts[(i + 1) % pts.length]} r={0.006} mat="paintedMetal" color={frame} />
      ))}
      {[0.08, 0.36, 0.64, 0.92].map((t) => {
        const y = h * t
        const inset = y < c ? c - y : y > h - c ? y - (h - c) : 0
        return <Part key={t} size={[w - 0.02 - inset * 2, 0.02, d - 0.02]} mat="wood" color={item.color} pos={[0, y, d / 2]} />
      })}
    </group>
  )
}

// ---------------------------------------------------------------- lamps

function Shade({ kind, r, h, color }: { kind: 'drum' | 'dome' | 'cone'; r: number; h: number; color: string }) {
  const outer = useMemo(() => {
    if (kind === 'drum') return cachedGeometry(`drum:${r}:${h}`, () => new THREE.CylinderGeometry(r, r, h, 40, 1, true))
    if (kind === 'cone') return cachedGeometry(`cone:${r}:${h}`, () => new THREE.CylinderGeometry(r * 0.3, r, h, 32, 1, true))
    return cachedGeometry(`dome:${r}:${h}`, () => new THREE.SphereGeometry(r, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1))
  }, [kind, r, h])
  return (
    <group>
      <mesh geometry={outer} material={material(kind === 'drum' ? 'semiSheer' : 'gloss', color)} castShadow position={[0, kind === 'dome' ? -h * 0.15 : 0, 0]} />
      <mesh geometry={outer} material={material('innerGloss', '#fbf6ea')} position={[0, kind === 'dome' ? -h * 0.15 : 0, 0]} />
      <Ball r={0.03} mat="emissive" color="#fff1d0" pos={[0, kind === 'dome' ? -h * 0.1 : 0, 0]} />
      <pointLight position={[0, -0.02, 0]} color="#ffd59a" intensity={1.3} distance={3.5} decay={2} />
    </group>
  )
}

export function LampVariant({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const body = item.color
  const shade = item.color2 ?? '#f2efe8'
  const style = item.style ?? ''
  if (style === 'tripod-drum') {
    const apex: V3 = [0, h * 0.62, 0]
    return (
      <group>
        {[0, 1, 2].map((i) => {
          const a = Math.PI + (i * 2 * Math.PI) / 3
          return <Rod key={i} from={[Math.sin(a) * w * 0.44, 0, Math.cos(a) * w * 0.44]} to={[0, h * 0.78, 0]} r={0.012} r2={0.009} mat="wood" color={body} />
        })}
        <Rod from={apex} to={[0, h - 0.18, 0]} r={0.008} mat="metal" color="#c9c9c4" />
        <group position={[0, h - 0.13, 0]}>
          <Shade kind="drum" r={Math.min(0.22, w * 0.42)} h={0.26} color={shade} />
        </group>
      </group>
    )
  }
  if (style === 'stick-dome') {
    return (
      <group>
        <Cyl r={Math.min(0.13, w / 2)} r2={Math.min(0.12, w / 2 - 0.01)} h={0.025} mat="gloss" color={body} pos={[0, 0.0125, 0]} segments={36} />
        <Rod from={[0, 0.02, 0]} to={[0, h - 0.12, 0]} r={0.008} mat="gloss" color={body} />
        <group position={[0, h - 0.1, 0]}>
          <Shade kind="dome" r={Math.min(0.15, w / 2)} h={0.12} color={shade} />
        </group>
      </group>
    )
  }
  if (style === 'spot') {
    const neckTop: V3 = [0.02, h - 0.08, 0.12]
    return (
      <group>
        <Cyl r={Math.min(0.11, w / 2)} h={0.025} mat="paintedMetal" color={body} pos={[0, 0.0125, 0]} segments={36} />
        <Rod from={[0, 0.02, 0]} to={[0, h * 0.72, 0]} r={0.009} mat="paintedMetal" color={body} />
        <mesh geometry={tubeAlong([[0, h * 0.72, 0], [0, h * 0.86, 0.02], [0.01, h - 0.04, 0.08], neckTop], 0.007)} material={material('chrome', '#d6d6d6')} castShadow />
        <group position={neckTop} rotation={[0.9, 0, 0]}>
          <Shade kind="cone" r={0.07} h={0.14} color={shade} />
        </group>
      </group>
    )
  }
  // 'arc': heavy base at the back, three curved arms reaching forward over a sofa or bed.
  const base: V3 = [0, 0, -d / 2 + 0.16]
  const top: V3 = [0, h - 0.1, -d / 2 + 0.25]
  const ends: V3[] = [
    [-w / 2 + 0.12, h - 0.55, d / 2 - 0.12],
    [0, h - 0.4, d / 2 - 0.05],
    [w / 2 - 0.12, h - 0.55, d / 2 - 0.12],
  ]
  return (
    <group>
      <Part size={[0.32, 0.04, 0.32]} radius={0.01} mat="paintedMetal" color={body} pos={[base[0], 0.02, base[2]]} />
      <Rod from={[base[0], 0.04, base[2]]} to={top} r={0.014} mat="metal" color={body} />
      {ends.map((e, i) => (
        <group key={i}>
          <mesh geometry={tubeAlong([top, [e[0] * 0.6, h + 0.05, (top[2] + e[2]) / 2], [e[0], e[1] + 0.12, e[2]]], 0.008)} material={material('metal', body)} castShadow />
          <group position={e}>
            <Shade kind="drum" r={0.07} h={0.14} color={shade} />
          </group>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------- mirrors

function archShape(w: number, h: number) {
  const r = w / 2
  const s = new THREE.Shape()
  s.moveTo(-r, 0)
  s.lineTo(r, 0)
  s.lineTo(r, h - r)
  s.absarc(0, h - r, r, 0, Math.PI, false)
  s.lineTo(-r, 0)
  return s
}

export function MirrorVariant({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const style = item.style ?? 'wall-rect'
  const lean = style.startsWith('lean')
  const kind = style.split('-')[1] ?? 'rect'
  const f = 0.02
  const frameMat = lean && kind === 'rect' ? 'wood' : 'paintedMetal'
  const geo = useMemo(() => {
    if (kind === 'round') {
      return {
        frame: cachedGeometry(`ring:${w}`, () => new THREE.TorusGeometry(w / 2 - f / 2, f / 2, 10, 64)),
        glass: cachedGeometry(`disc:${w}`, () => new THREE.CircleGeometry(w / 2 - f, 64)),
      }
    }
    const outer = kind === 'arch' ? archShape(w, h) : new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, h), new THREE.Vector2(-w / 2, h)])
    const inner = kind === 'arch' ? archShape(w - 2 * f, h - 2 * f) : new THREE.Shape([new THREE.Vector2(-w / 2 + f, 0), new THREE.Vector2(w / 2 - f, 0), new THREE.Vector2(w / 2 - f, h - 2 * f), new THREE.Vector2(-w / 2 + f, h - 2 * f)])
    const ring = new THREE.Shape(outer.getPoints(48))
    ring.holes.push(new THREE.Path(inner.getPoints(48).map((p) => new THREE.Vector2(p.x, p.y + f))))
    return {
      frame: cachedGeometry(`mframe:${kind}:${w}:${h}`, () => new THREE.ExtrudeGeometry(ring, { depth: 0.025, bevelEnabled: false, curveSegments: 32 })),
      glass: cachedGeometry(`mglass:${kind}:${w}:${h}`, () => new THREE.ShapeGeometry(inner, 48).translate(0, f, 0)),
    }
  }, [kind, w, h])
  const tilt = lean ? -Math.atan2(Math.max(d - 0.05, 0.05), h) : 0
  return (
    <group position={[0, 0, lean ? d - 0.02 : 0]} rotation={[tilt, 0, 0]}>
      {kind === 'round' ? (
        <group position={[0, h / 2, 0.02]}>
          <mesh geometry={geo.frame} material={material(frameMat, item.color)} castShadow />
          <mesh geometry={geo.glass} material={material('chrome', '#eef3f5')} position={[0, 0, -0.002]} />
        </group>
      ) : (
        <group>
          <mesh geometry={geo.frame} material={material(frameMat, item.color)} castShadow />
          <mesh geometry={geo.glass} material={material('chrome', '#eef3f5')} position={[0, 0, 0.01]} />
          {style === 'wall-arch' && (
            <>
              <Part size={[0.012, h - 2 * f, 0.012]} mat="paintedMetal" color={item.color} pos={[0, h / 2, 0.02]} />
              {[0.33, 0.6].map((t) => (
                <Part key={t} size={[w - 2 * f, 0.012, 0.012]} mat="paintedMetal" color={item.color} pos={[0, h * t, 0.02]} />
              ))}
            </>
          )}
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------- plants

export function PlantVariant({ item }: { item: Item }) {
  const { w, h } = sizeM(item)
  const style = item.style ?? 'tree'
  const potH = Math.min(0.3, h * 0.2)
  const potR = Math.min(0.17, w * 0.3)
  const leaves = useRef<THREE.InstancedMesh>(null)
  const layout = useMemo(() => {
    const rand = rng(item.id)
    const out: { pos: V3; rot: [number, number, number]; scale: V3; tint: number }[] = []
    const stems: [V3, V3, V3][] = []
    if (style === 'tree') {
      const crown: V3 = [0, potH + (h - potH) * 0.68, 0]
      stems.push([[0, potH, 0], [0.02, potH + (h - potH) * 0.4, 0], crown])
      for (let i = 0; i < 70; i++) {
        const a = rand() * Math.PI * 2
        const y = crown[1] + (rand() - 0.4) * (h - potH) * 0.6
        const r = w * 0.42 * Math.sqrt(rand()) * (1 - Math.abs(y - crown[1]) / ((h - potH) * 0.7))
        out.push({ pos: [Math.cos(a) * r, Math.min(y, h - 0.04), Math.sin(a) * r], rot: [rand() * 1.4 - 0.7, a, rand() * 0.8], scale: [0.05, 0.09, 1], tint: 0.7 + rand() * 0.5 })
      }
    } else if (style === 'palm') {
      const trunkTop: V3 = [0, potH + (h - potH) * 0.5, 0]
      stems.push([[0, potH, 0], [0.01, potH + (h - potH) * 0.25, 0], trunkTop])
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + rand() * 0.3
        const reach = w * 0.5
        for (let k = 1; k <= 7; k++) {
          const t = k / 8
          const droop = Math.sin(t * Math.PI * 0.9) * (h - trunkTop[1]) * 0.85 - t * t * 0.25
          out.push({ pos: [Math.cos(a) * reach * t, trunkTop[1] + droop, Math.sin(a) * reach * t], rot: [0.6, -a + Math.PI / 2, 0], scale: [0.04, 0.22 * (1 - t * 0.4), 1], tint: 0.75 + rand() * 0.4 })
        }
      }
    } else {
      // 'broad': a handful of big upright leaves (banana, bird of paradise).
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rand() * 0.5
        const lean = 0.15 + rand() * 0.25
        const top = potH + (h - potH) * (0.55 + rand() * 0.4)
        const tip: V3 = [Math.cos(a) * w * 0.3 * lean * 3, top, Math.sin(a) * w * 0.3 * lean * 3]
        stems.push([[0, potH, 0], [tip[0] * 0.3, (potH + top) / 2, tip[2] * 0.3], [tip[0] * 0.8, top - 0.25, tip[2] * 0.8]])
        out.push({ pos: [tip[0] * 0.9, top - 0.1, tip[2] * 0.9], rot: [lean - 0.2, -a + Math.PI / 2, 0], scale: [0.2, 0.55, 1], tint: 0.8 + rand() * 0.35 })
      }
    }
    return { out, stems }
  }, [item.id, style, w, h, potH])

  useLayoutEffect(() => {
    const m = leaves.current
    if (!m) return
    const o = new THREE.Object3D()
    const base = new THREE.Color(item.color)
    layout.out.forEach((l, i) => {
      o.position.set(...l.pos)
      o.rotation.set(l.rot[0], l.rot[1], l.rot[2], 'YXZ')
      o.scale.set(...l.scale)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, base.clone().multiplyScalar(l.tint))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [layout, item.color])

  return (
    <group>
      <Cyl r={potR * 0.8} r2={potR} h={potH} mat="ceramic" color={item.color2 ?? '#1e1e1e'} pos={[0, potH / 2, 0]} segments={32} />
      <Cyl r={potR * 0.94} h={0.01} mat="soil" color="#3b2a1e" pos={[0, potH - 0.015, 0]} segments={28} />
      {layout.stems.map((s, i) => (
        <mesh key={i} geometry={tubeAlong(s, style === 'broad' ? 0.008 : 0.014)} material={material(style === 'broad' ? 'plastic' : 'wood', style === 'broad' ? '#5c7a3e' : '#6b5440')} castShadow />
      ))}
      <instancedMesh key={layout.out.length} ref={leaves} args={[undefined, undefined, layout.out.length]} material={material('leaf', '#ffffff')} castShadow>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
    </group>
  )
}

// ---------------------------------------------------------------- rugs

export function RugVariant({ item }: { item: Item }) {
  const { w, d } = sizeM(item)
  const style = item.style ?? 'plain'
  const shaggy = style === 'shaggy'
  const t = shaggy ? 0.025 : Math.max(sizeM(item).h, 0.008)
  const round = style === 'round' || style === 'oval'
  const top = useMemo(() => {
    if (!round) return null
    return cachedGeometry(`ellipse:${w}:${d}`, () => new THREE.CircleGeometry(0.5, 72).rotateX(-Math.PI / 2).scale(w, 1, d))
  }, [round, w, d])
  const side = useMemo(() => (round ? cachedGeometry(`ellipse-side:${w}:${d}:${t}`, () => new THREE.CylinderGeometry(0.5, 0.5, t, 72, 1, true).scale(w, 1, d)) : null), [round, w, d, t])
  const mat = shaggy ? 'boucle' : 'rug'
  return (
    <group>
      {round ? (
        <>
          <mesh geometry={side!} material={material(mat, item.color)} position={[0, t / 2, 0]} receiveShadow />
          <mesh geometry={top!} material={material(mat, item.color)} position={[0, t, 0]} receiveShadow />
        </>
      ) : (
        <Part size={[w, t, d]} radius={Math.min(0.006, t / 2.5)} mat={mat} color={item.color} pos={[0, t / 2, 0]} />
      )}
      {item.image && (
        <group position={[0, t + 0.0015, 0]}>
          {round ? <RoundArt url={item.image} w={w} d={d} label={item.name} /> : <Art url={item.image} label={item.name} w={w} h={d} rot={[-Math.PI / 2, 0, 0]} fit="stretch" />}
        </group>
      )}
    </group>
  )
}

/** A picture clipped to an ellipse, for round and oval rugs. */
function RoundArt({ url, w, d, label }: { url: string; w: number; d: number; label: string }) {
  // Art draws a rectangle; scaling a unit circle's UVs onto it keeps the corners off the floor.
  return (
    <group scale={[1, 1, 1]}>
      <Art url={url} label={label} w={w * 0.999} h={d * 0.999} rot={[-Math.PI / 2, 0, 0]} fit="stretch" clip="ellipse" />
    </group>
  )
}

// ---------------------------------------------------------------- curtains

export function curtainMat(item: Item): MatKind {
  if (item.style === 'sheer') return 'sheer'
  if (item.style === 'semi') return 'semiSheer'
  return 'cloth'
}

export { lerp3 }
