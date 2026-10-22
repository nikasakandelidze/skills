import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Item } from '../types'
import { bentPanelGeometry, cushionGeometry, duvetGeometry, headboardGeometry, pillowGeometry, shadeGeometry, tubeAlong } from './geometries'
import { material } from './materials'
import { Art, Ball, Cyl, Fallback, lerp3, Part, Rod, rng, Shape, type V3 } from './parts'
import { BedVariant, curtainMat, DeskVariant, LadderShelf, LampVariant, MetalShelving, MirrorVariant, PlantVariant, RugVariant, SofaVariant, StorageVariant, TableVariant } from './variants'

// One parametric model per shape. Everything is in metres and scales with the item's size, so a
// resized or swapped item still looks right. Floor models stand on y = 0, centred on their
// footprint, front facing +z. Wall models hang from the wall surface (z = 0), bottom edge at y = 0.
// Details follow the photos of the room in reference/.

const LIGHT_WOOD = '#c99b6b'
const DARK_PLASTIC = '#262626'

function sizeM(item: Item) {
  return { w: item.size.w / 100, d: item.size.d / 100, h: item.size.h / 100 }
}

function luminance(hex: string) {
  const c = new THREE.Color(hex)
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
}

// ---------------------------------------------------------------- bed

/** Grey upholstered bed with a rounded, buttoned headboard and short tapered wooden legs. */
function Bed({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const legH = 0.11
  const railTop = 0.37
  const railT = 0.06
  const headT = 0.09
  const mw = w - railT * 2 - 0.01
  const md = d - headT - railT - 0.01
  const mattH = 0.25
  const mattBottom = 0.3
  const mattTop = mattBottom + mattH
  const headH = Math.max(h - legH, 0.1)
  const zHead = -d / 2 + headT
  const fabric = item.color
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Cyl key={`${sx}${sz}`} r={0.016} r2={0.024} h={legH} mat="wood" color={LIGHT_WOOD} pos={[sx * (w / 2 - 0.07), legH / 2, sz * (d / 2 - 0.07)]} rot={[sz * 0.06, 0, -sx * 0.06]} />
        )),
      )}
      {[-1, 1].map((sx) => (
        <Part key={sx} size={[railT, railTop - legH, d - headT]} radius={0.022} mat="upholstery" color={fabric} pos={[sx * (w / 2 - railT / 2), (legH + railTop) / 2, headT / 2]} />
      ))}
      <Part size={[w, railTop - legH, railT]} radius={0.022} mat="upholstery" color={fabric} pos={[0, (legH + railTop) / 2, d / 2 - railT / 2]} />
      <Shape geometry={headboardGeometry(w, headH, headT, 0.14)} mat="upholstery" color={fabric} pos={[0, legH, zHead]} />
      {[-1, 1].map((sx) => (
        <Ball key={sx} r={0.011} mat="upholstery" color={fabric} pos={[sx * w * 0.17, legH + headH * 0.74, zHead + 0.004]} scale={[1, 1, 0.55]} />
      ))}
      <Shape geometry={cushionGeometry(mw, mattH, md, 0.03)} mat="fabric" color={item.color2 ?? '#e9edf2'} pos={[0, mattBottom + mattH / 2, zHead + md / 2 + 0.005]} />
      {[-1, 1].map((sx) => (
        <Shape
          key={sx}
          geometry={pillowGeometry(Math.min(0.66, mw * 0.45), 0.17, 0.44)}
          mat="fabric"
          color="#edf1f6"
          pos={[sx * mw * 0.245, mattTop + 0.1, zHead + 0.26]}
          rot={[-0.28, sx * 0.05, sx * 0.02]}
        />
      ))}
      <Shape geometry={duvetGeometry(mw, md, 0.58, mattH + 0.04, 3)} mat="fabric" color="#ddd3c5" pos={[0, mattTop, zHead + md + 0.005]} />
    </group>
  )
}

// ---------------------------------------------------------------- desk

/** Electric standing desk: laminate top with a cable grommet, two-stage columns, T-feet, control panel. */
function Desk({ item, controls = true }: { item: Item; controls?: boolean }) {
  const { w, d, h } = sizeM(item)
  const frame = item.color2 ?? '#1b1b1b'
  const legX = Math.max(w / 2 - 0.13, 0.08)
  const topT = 0.025
  const under = h - topT
  const lower = 0.035 + (under - 0.035 - 0.03) * 0.5
  return (
    <group>
      <Part size={[w, topT, d]} radius={0.004} mat="laminate" color={item.color} pos={[0, h - topT / 2, 0]} />
      <Cyl r={0.03} h={0.002} mat="rubber" color="#0c0c0c" pos={[w / 2 - 0.1, h + 0.001, -d / 2 + 0.1]} segments={28} />
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * legX, 0, 0]}>
          <Part size={[0.075, 0.035, d - 0.03]} radius={0.012} mat="paintedMetal" color={frame} pos={[0, 0.0175, 0]} />
          {[-1, 1].map((sz) => (
            <Cyl key={sz} r={0.016} h={0.008} mat="rubber" color="#111" pos={[0, 0.004, sz * (d / 2 - 0.05)]} />
          ))}
          <Part size={[0.085, lower - 0.035, 0.065]} radius={0.006} mat="paintedMetal" color={frame} pos={[0, (0.035 + lower) / 2, 0]} />
          <Part size={[0.072, under - 0.03 - lower + 0.02, 0.054]} radius={0.005} mat="paintedMetal" color={frame} pos={[0, (lower - 0.02 + under - 0.03) / 2, 0]} />
          <Part size={[0.06, 0.03, d - 0.1]} radius={0.004} mat="paintedMetal" color={frame} pos={[0, under - 0.015, 0]} />
        </group>
      ))}
      <Part size={[legX * 2, 0.045, 0.045]} radius={0.004} mat="paintedMetal" color={frame} pos={[0, under - 0.045, -0.04]} />
      {controls && <group position={[w / 2 - 0.22, under - 0.012, d / 2 - 0.035]}>
        <Part size={[0.13, 0.022, 0.06]} radius={0.006} mat="plastic" color={DARK_PLASTIC} />
        {[-0.04, -0.015, 0.015, 0.04].map((x) => (
          <Cyl key={x} r={0.006} h={0.004} mat="plastic" color="#3a3a3a" pos={[x, -0.0125, 0.012]} rot={[Math.PI, 0, 0]} />
        ))}
      </group>}
    </group>
  )
}

// ---------------------------------------------------------------- chairs

function StarBase({ w, color, mat }: { w: number; color: string; mat: 'plastic' | 'chrome' }) {
  const arms = [0, 1, 2, 3, 4].map((i) => (i * 2 * Math.PI) / 5)
  const reach = Math.min(0.33, w * 0.5)
  return (
    <group>
      <Cyl r={0.045} r2={0.04} h={0.06} mat={mat} color={color} pos={[0, 0.1, 0]} />
      {arms.map((a, i) => (
        <group key={i} rotation={[0, a, 0]}>
          <Part size={[0.045, 0.035, reach]} radius={0.012} mat={mat} color={color} pos={[0, 0.088, reach / 2]} rot={[0.12, 0, 0]} />
          <Part size={[0.028, 0.04, 0.034]} radius={0.008} mat="plastic" color={DARK_PLASTIC} pos={[0, 0.055, reach - 0.012]} />
          <Cyl r={0.026} h={0.034} mat="rubber" color="#1c1c1c" pos={[0, 0.027, reach + 0.005]} rot={[0, 0, Math.PI / 2]} />
        </group>
      ))}
    </group>
  )
}

/** Ergonomic mesh chair (the white desk chair): see-through curved back, lumbar bar, adjustable headrest. */
function MeshChair({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const frame = item.color
  const base = item.color2 ?? '#e6e6e3'
  const meshColor = new THREE.Color(frame).multiplyScalar(0.82).getStyle()
  const seatY = 0.47
  const headrest = h > 1.15
  const backH = Math.max(0.3, Math.min(h - seatY - (headrest ? 0.24 : 0.06), 0.6))
  const bw = w * 0.7
  const R = 0.5
  const edgeA = (bw / 2 - 0.015) / R
  return (
    <group>
      <StarBase w={w} color={base} mat="plastic" />
      <Cyl r={0.02} h={0.16} mat="chrome" color="#cfcfcf" pos={[0, 0.2, 0]} />
      <Cyl r={0.032} r2={0.028} h={0.12} mat="plastic" color={DARK_PLASTIC} pos={[0, 0.19, 0]} />
      <Part size={[0.22, 0.05, 0.22]} radius={0.01} mat="plastic" color={DARK_PLASTIC} pos={[0, seatY - 0.08, 0]} />
      <Part size={[w * 0.76, 0.02, d * 0.72]} radius={0.008} mat="plastic" color={base} pos={[0, seatY - 0.045, 0.02]} />
      <Shape geometry={cushionGeometry(w * 0.78, 0.075, d * 0.74, 0.16)} mat="fabric" color={meshColor} pos={[0, seatY, 0.02]} />
      <group position={[0, seatY + 0.06, -d * 0.36]} rotation={[-0.1, 0, 0]}>
        <Part size={[0.06, 0.24, 0.03]} radius={0.01} mat="plastic" color={base} pos={[0, -0.06, -0.035]} rot={[0.25, 0, 0]} />
        <Shape geometry={bentPanelGeometry(bw - 0.03, backH - 0.03, 0.004, R)} mat="mesh" color={meshColor} pos={[0, backH / 2, -0.002]} />
        {[0, backH].map((y) => (
          <Shape key={y} geometry={bentPanelGeometry(bw, 0.03, 0.025, R)} mat="plastic" color={frame} pos={[0, y, -0.01]} />
        ))}
        {[-1, 1].map((sx) => (
          <Part key={sx} size={[0.025, backH, 0.025]} radius={0.008} mat="plastic" color={frame} pos={[sx * R * Math.sin(edgeA), backH / 2, R - R * Math.cos(edgeA) - 0.01]} rot={[0, -sx * edgeA, 0]} />
        ))}
        <Shape geometry={bentPanelGeometry(bw * 0.86, 0.045, 0.02, R)} mat="plastic" color={frame} pos={[0, backH * 0.3, 0.012]} />
        {headrest && (
          <group position={[0, backH, -0.01]}>
            <Part size={[0.03, 0.14, 0.02]} radius={0.008} mat="plastic" color={frame} pos={[0, 0.07, -0.01]} />
            <Shape geometry={bentPanelGeometry(bw * 0.55, 0.12, 0.035, 0.32)} mat="fabric" color={meshColor} pos={[0, 0.17, 0]} />
            <Shape geometry={bentPanelGeometry(bw * 0.58, 0.14, 0.02, 0.32)} mat="plastic" color={frame} pos={[0, 0.17, -0.02]} />
          </group>
        )}
      </group>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * w * 0.42, 0, -0.03]}>
          {/* L-bracket from under the seat out to the armrest post. */}
          <Part size={[w * 0.2, 0.025, 0.05]} radius={0.008} mat="plastic" color={base} pos={[-sx * w * 0.09, seatY - 0.06, 0]} />
          <Part size={[0.035, 0.24, 0.05]} radius={0.01} mat="plastic" color={base} pos={[0, seatY + 0.05, 0]} />
          <Shape geometry={cushionGeometry(0.075, 0.03, 0.25, 0.1)} mat="rubber" color={DARK_PLASTIC} pos={[0, seatY + 0.175, 0.02]} />
        </group>
      ))}
    </group>
  )
}

/** Padded leather office chair (the black one) on a chrome base. */
function ExecutiveChair({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const seatY = 0.48
  const backH = Math.max(0.3, h - seatY - 0.04)
  const bw = w * 0.8
  const metal = item.color2 ?? '#c4c4c4'
  return (
    <group>
      <StarBase w={w} color={metal} mat={luminance(metal) < 0.3 ? 'plastic' : 'chrome'} />
      <Cyl r={0.022} h={0.2} mat="chrome" color="#c4c4c4" pos={[0, 0.22, 0]} />
      <Part size={[0.22, 0.05, 0.22]} radius={0.01} mat="plastic" color={DARK_PLASTIC} pos={[0, seatY - 0.08, 0]} />
      <Shape geometry={cushionGeometry(w * 0.84, 0.11, d * 0.8, 0.2)} mat="leather" color={item.color} pos={[0, seatY, 0.02]} />
      <group position={[0, seatY + 0.04, -d * 0.36]} rotation={[-0.14, 0, 0]}>
        <Shape geometry={bentPanelGeometry(bw, backH, 0.09, 0.7)} mat="leather" color={item.color} pos={[0, backH / 2, 0]} />
        {[0.32, 0.55, 0.78].map((t) => (
          <Shape key={t} geometry={bentPanelGeometry(bw * 0.86, 0.006, 0.005, 0.7)} mat="leather" color={new THREE.Color(item.color).multiplyScalar(0.6).getStyle()} pos={[0, backH * t, 0.047]} />
        ))}
      </group>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * w * 0.44, 0, 0]}>
          <Rod from={[0, seatY - 0.04, 0.12]} to={[0, seatY + 0.18, 0.1]} r={0.011} mat="chrome" color={metal} />
          <Rod from={[0, seatY - 0.04, -0.14]} to={[0, seatY + 0.18, -0.12]} r={0.011} mat="chrome" color={metal} />
          <Shape geometry={cushionGeometry(0.06, 0.035, 0.3, 0.1)} mat="leather" color={item.color} pos={[0, seatY + 0.2, -0.01]} />
        </group>
      ))}
    </group>
  )
}

function OfficeChair({ item }: { item: Item }) {
  const style = item.style ?? (luminance(item.color) < 0.2 && item.size.h < 115 ? 'executive' : 'mesh')
  return style === 'executive' ? <ExecutiveChair item={item} /> : <MeshChair item={item} />
}

/** Wooden dining/side chair with splayed legs and a curved back rail. */
function Chair({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const seatY = Math.min(0.46, h * 0.53)
  const legColor = item.color2 ?? LIGHT_WOOD
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <Rod key={`${sx}${sz}`} from={[sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02)]} to={[sx * (w / 2 - 0.05), seatY - 0.02, sz * (d / 2 - 0.05)]} r={0.014} r2={0.019} mat="wood" color={legColor} />
        )),
      )}
      <Shape geometry={cushionGeometry(w, 0.035, d, 0.05)} mat="wood" color={item.color} pos={[0, seatY, 0]} />
      {[-1, 1].map((sx) => (
        <Rod key={sx} from={[sx * (w / 2 - 0.05), seatY, -d / 2 + 0.05]} to={[sx * (w / 2 - 0.04), h - 0.02, -d / 2 + 0.01]} r={0.014} mat="wood" color={legColor} />
      ))}
      <Shape geometry={bentPanelGeometry(w * 0.95, 0.09, 0.02, 0.45)} mat="wood" color={item.color} pos={[0, h - 0.06, -d / 2 + 0.01]} rot={[-0.08, 0, 0]} />
    </group>
  )
}

/** White plastic folding chair on grey tubular legs. */
function FoldingChair({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const seatY = Math.min(0.45, h * 0.55)
  const legs = item.color2 ?? '#9a9a9a'
  return (
    <group>
      <Shape geometry={cushionGeometry(w * 0.9, 0.03, d * 0.66, 0.06)} mat="plastic" color={item.color} pos={[0, seatY, 0.04]} />
      <Shape geometry={bentPanelGeometry(w * 0.86, 0.2, 0.018, 0.5)} mat="plastic" color={item.color} pos={[0, h - 0.12, -d / 2 + 0.06]} rot={[-0.12, 0, 0]} />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Rod from={[sx * w * 0.44, 0, d / 2 - 0.04]} to={[sx * w * 0.44, h - 0.02, -d / 2 + 0.07]} r={0.009} mat="metal" color={legs} />
          <Rod from={[sx * w * 0.39, 0, -d / 2 + 0.03]} to={[sx * w * 0.39, seatY - 0.02, d * 0.16]} r={0.009} mat="metal" color={legs} />
          <Cyl r={0.012} h={0.012} mat="rubber" color="#2a2a2a" pos={[sx * w * 0.44, 0.006, d / 2 - 0.04]} />
          <Cyl r={0.012} h={0.012} mat="rubber" color="#2a2a2a" pos={[sx * w * 0.39, 0.006, -d / 2 + 0.03]} />
        </group>
      ))}
      <Rod from={[-w * 0.44, 0.08, d / 2 - 0.06]} to={[w * 0.44, 0.08, d / 2 - 0.06]} r={0.007} mat="metal" color={legs} />
      <Rod from={[-w * 0.39, seatY - 0.04, -0.02]} to={[w * 0.39, seatY - 0.04, -0.02]} r={0.007} mat="metal" color={legs} />
    </group>
  )
}

// ---------------------------------------------------------------- sofa

/** Overstuffed leather loveseat: pillow-top rolled arms, loose back and seat cushions, low plinth. */
function Sofa({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const plinth = 0.05
  const seatTop = Math.min(0.47, h * 0.56)
  const armW = Math.min(0.24, w * 0.18)
  const armH = Math.min(seatTop + 0.14, h - 0.02) - plinth
  const backD = Math.min(0.24, d * 0.26)
  const cushions = w > 1.7 ? 3 : w > 1.05 ? 2 : 1
  const innerW = w - armW * 2
  const cw = innerW / cushions
  const leather = item.color
  return (
    <group>
      <Part size={[w - 0.12, plinth, d - 0.12]} radius={0.01} mat="wood" color="#2b211b" pos={[0, plinth / 2, 0]} />
      <Shape geometry={cushionGeometry(w, seatTop - plinth - 0.1, d, 0.04)} mat="leather" color={leather} pos={[0, plinth + (seatTop - plinth - 0.1) / 2, 0]} />
      <Shape geometry={cushionGeometry(innerW + 0.1, h - plinth - 0.03, backD, 0.08)} mat="leather" color={leather} pos={[0, plinth + (h - plinth) / 2, -d / 2 + backD / 2]} rot={[-0.05, 0, 0]} />
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (w / 2 - armW / 2), 0, 0]}>
          <Shape geometry={cushionGeometry(armW, armH, d, 0.06)} mat="leather" color={leather} pos={[0, plinth + armH / 2, 0]} />
          <Shape geometry={cushionGeometry(armW + 0.035, 0.13, d - 0.01, 0.14)} mat="leather" color={leather} pos={[sx * 0.008, plinth + armH - 0.02, 0.005]} />
        </group>
      ))}
      {Array.from({ length: cushions }, (_, i) => {
        const x = -innerW / 2 + cw * (i + 0.5)
        return (
          <group key={i}>
            <Shape geometry={cushionGeometry(cw - 0.012, 0.17, d - backD - 0.04, 0.16)} mat="leather" color={leather} pos={[x, seatTop - 0.075, backD / 2 + 0.01]} />
            <Shape
              geometry={cushionGeometry(cw - 0.02, Math.max(0.2, h - seatTop - 0.05), 0.17, 0.22)}
              mat="leather"
              color={leather}
              pos={[x, seatTop + (h - seatTop) / 2 - 0.01, -d / 2 + backD + 0.07]}
              rot={[-0.14, 0, 0]}
            />
          </group>
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------- storage

const BOOK_COLORS = ['#e3d9c2', '#a33b2f', '#2f4d6b', '#efe9dc', '#c9a227', '#3f5e4a', '#1f1f1f', '#8c6e54', '#f4f1ea', '#5b6f8a', '#d26b3d', '#6b4b7a']

/** Books, stacks and a few objects on each shelf. One instanced mesh for all the books. */
function ShelfContents({ id, w, d, kick, t, levels, gap }: { id: string; w: number; d: number; kick: number; t: number; levels: number; gap: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const { books, decor } = useMemo(() => {
    const rand = rng(id)
    const books: { pos: V3; size: V3; rotZ: number; color: string }[] = []
    const decor: { kind: 'vase' | 'frame' | 'box'; pos: V3; color: string }[] = []
    for (let level = 0; level < levels; level++) {
      const y0 = kick + level * gap + t
      const room = gap - t - 0.02
      let x = -w / 2 + t + 0.01
      const end = w / 2 - t - 0.01
      while (x < end - 0.03) {
        const roll = rand()
        if (roll < 0.1 && end - x > 0.14) {
          // A stack lying flat.
          const n = 2 + Math.floor(rand() * 4)
          const bw = 0.15 + rand() * 0.06
          let y = y0
          for (let i = 0; i < n && y < y0 + room - 0.05; i++) {
            const bh = 0.02 + rand() * 0.03
            books.push({ pos: [x + bw / 2 + (rand() - 0.5) * 0.01, y + bh / 2, -d / 2 + 0.03 + 0.11], size: [bw, bh, 0.21], rotZ: 0, color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)] })
            y += bh
          }
          x += bw + 0.02
          continue
        }
        if (roll < 0.17 && end - x > 0.12) {
          const kind = (['vase', 'frame', 'box'] as const)[Math.floor(rand() * 3)]
          decor.push({ kind, pos: [x + 0.05, y0, -d / 2 + d * 0.5], color: ['#e8e2d6', '#3b3b3b', '#9db3a5', '#c06a45'][Math.floor(rand() * 4)] })
          x += 0.12
          continue
        }
        if (roll < 0.25) {
          x += 0.03 + rand() * 0.08
          continue
        }
        const bw = 0.018 + rand() * 0.035
        const bh = Math.min(room, 0.17 + rand() * 0.12)
        const bd = Math.min(d - 0.04, 0.14 + rand() * 0.08)
        const lean = rand() < 0.06 ? 0.18 : 0
        books.push({ pos: [x + bw / 2, y0 + bh / 2, -d / 2 + 0.02 + bd / 2], size: [bw, bh, bd], rotZ: lean, color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)] })
        x += bw + 0.002 + (lean ? 0.04 : 0)
      }
    }
    return { books, decor }
  }, [id, w, d, kick, t, levels, gap])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const o = new THREE.Object3D()
    books.forEach((b, i) => {
      o.position.set(...b.pos)
      o.rotation.set(0, 0, b.rotZ)
      o.scale.set(...b.size)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, new THREE.Color(b.color))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [books])

  return (
    <group>
      <instancedMesh key={books.length} ref={mesh} args={[undefined, undefined, books.length]} castShadow receiveShadow material={material('paper', '#ffffff')}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {decor.map((o, i) =>
        o.kind === 'vase' ? (
          <Cyl key={i} r={0.03} r2={0.022} h={0.13} mat="ceramic" color={o.color} pos={[o.pos[0], o.pos[1] + 0.065, o.pos[2]]} />
        ) : o.kind === 'frame' ? (
          <group key={i} position={[o.pos[0], o.pos[1], o.pos[2]]} rotation={[-0.2, 0.1, 0]}>
            <Part size={[0.11, 0.15, 0.012]} mat="plastic" color="#1f1f1f" pos={[0, 0.075, 0]} />
            <mesh position={[0, 0.075, 0.007]}>
              <planeGeometry args={[0.085, 0.12]} />
              <meshStandardMaterial color="#d8cbb6" roughness={0.6} />
            </mesh>
          </group>
        ) : (
          <Part key={i} size={[0.09, 0.06, 0.09]} radius={0.004} mat="wood" color="#8a6a4a" pos={[o.pos[0], o.pos[1] + 0.03, o.pos[2]]} />
        ),
      )}
    </group>
  )
}

/** Dark wood open bookshelf with a back panel, filled with books and a few objects. */
function Bookshelf({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const t = 0.022
  const kick = 0.05
  const levels = Math.max(2, Math.round((h - kick) / 0.33))
  const gap = (h - kick - t) / levels
  const wood = item.color
  const m = item.finish === 'painted' ? 'laminate' : 'wood'
  return (
    <group>
      {[-1, 1].map((sx) => (
        <Part key={sx} size={[t, h, d]} radius={0.002} mat={m} color={wood} pos={[sx * (w / 2 - t / 2), h / 2, 0]} />
      ))}
      <Part size={[w + 0.01, 0.028, d + 0.01]} radius={0.003} mat={m} color={wood} pos={[0, h - 0.014, 0.005]} />
      <Part size={[w - 2 * t, h - kick, 0.008]} mat={m} color={new THREE.Color(wood).multiplyScalar(0.8).getStyle()} pos={[0, kick + (h - kick) / 2, -d / 2 + 0.004]} />
      <Part size={[w - 2 * t, kick, 0.018]} mat={m} color={wood} pos={[0, kick / 2, d / 2 - 0.025]} />
      {Array.from({ length: levels }, (_, i) => (
        <Part key={i} size={[w - 2 * t, t, d - 0.012]} radius={0.002} mat={m} color={wood} pos={[0, kick + i * gap + t / 2, 0.006]} />
      ))}
      <ShelfContents id={item.id} w={w} d={d} kick={kick} t={t} levels={levels} gap={gap} />
    </group>
  )
}

/** Cabinet, wardrobe, nightstand or any boxy object. With a product photo, the photo becomes its front. */
function BoxItem({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const groove = new THREE.Color(item.color).multiplyScalar(0.55).getStyle()
  const furniture = !item.image && h > 0.35 && d > 0.25
  const doors = w > 0.7 && h > 1.1
  const drawers = Math.max(1, Math.round((h - 0.08) / 0.24))
  return (
    <group>
      <Part size={[w, h - (furniture ? 0.06 : 0), d]} radius={0.006} mat="laminate" color={item.color} pos={[0, (h + (furniture ? 0.06 : 0)) / 2, 0]} />
      {furniture && <Part size={[w - 0.04, 0.06, d - 0.06]} mat="plastic" color="#2a2a2a" pos={[0, 0.03, -0.01]} />}
      {item.image && <Art url={item.image} label={item.name} w={w * 0.98} h={h * 0.98} pos={[0, h / 2, d / 2 + 0.002]} fit="stretch" />}
      {furniture &&
        (doors ? (
          <group>
            <Part size={[0.003, h - 0.1, 0.002]} mat="plastic" color={groove} pos={[0, h / 2 + 0.03, d / 2 + 0.001]} />
            {[-1, 1].map((sx) => (
              <Part key={sx} size={[0.014, 0.22, 0.014]} radius={0.005} mat="metal" color="#9a9a9a" pos={[sx * 0.04, h * 0.55, d / 2 + 0.02]} />
            ))}
          </group>
        ) : (
          Array.from({ length: drawers }, (_, i) => {
            const dh = (h - 0.06) / drawers
            const y = 0.06 + dh * i
            return (
              <group key={i}>
                {i > 0 && <Part size={[w - 0.01, 0.003, 0.002]} mat="plastic" color={groove} pos={[0, y, d / 2 + 0.001]} />}
                <Part size={[0.12, 0.012, 0.014]} radius={0.005} mat="metal" color="#9a9a9a" pos={[0, y + dh * 0.62, d / 2 + 0.012]} />
              </group>
            )
          })
        ))}
    </group>
  )
}

/** Table with a solid top and tapered legs. */
function Table({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const legColor = item.color2 ?? LIGHT_WOOD
  const legMat = luminance(legColor) < 0.2 ? 'paintedMetal' : 'wood'
  return (
    <group>
      <Part size={[w, 0.03, d]} radius={0.008} mat="wood" color={item.color} pos={[0, h - 0.015, 0]} />
      <Part size={[w - 0.12, 0.07, d - 0.12]} mat="wood" color={item.color} pos={[0, h - 0.065, 0]} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} r={0.016} r2={0.024} h={h - 0.03} mat={legMat} color={legColor} pos={[sx * (w / 2 - 0.06), (h - 0.03) / 2, sz * (d / 2 - 0.06)]} />),
      )}
    </group>
  )
}

// ---------------------------------------------------------------- lighting and stands

function legFeet(spread: number, offset = 0): V3[] {
  return [0, 1, 2].map((i) => {
    const a = offset + (i * 2 * Math.PI) / 3
    return [Math.sin(a) * spread, 0, Math.cos(a) * spread]
  })
}

/** Mint tripod floor lamp with copper-tipped legs and an egg-shaped dome shade (glowing). */
function FloorLamp({ item }: { item: Item }) {
  const { w, h } = sizeM(item)
  const apex: V3 = [0, h * 0.52, 0]
  const joint: V3 = [0, h * 0.83, 0.03]
  const feet = legFeet(w * 0.42, Math.PI)
  const shadeR = Math.min(0.16, w * 0.32)
  const shadeH = shadeR * 1.35
  const bulb: V3 = [0, shadeH * 0.35, 0]
  return (
    <group>
      {feet.map((f, i) => {
        const tip = lerp3(f, apex, 0.17)
        return (
          <group key={i}>
            <Rod from={f} to={tip} r={0.01} r2={0.011} mat="metal" color="#b8774a" />
            <Rod from={tip} to={apex} r={0.011} r2={0.012} mat="paintedMetal" color={item.color} />
          </group>
        )
      })}
      <Ball r={0.02} mat="paintedMetal" color={item.color} pos={apex} />
      <Rod from={apex} to={joint} r={0.012} mat="paintedMetal" color={item.color} />
      <Ball r={0.018} mat="paintedMetal" color={item.color} pos={joint} />
      <group position={joint} rotation={[-1.0, 0, 0]}>
        <group position={[0, -shadeH, 0]}>
          <Shape geometry={shadeGeometry(shadeR, shadeH)} mat="gloss" color={item.color} />
          <mesh geometry={shadeGeometry(shadeR, shadeH)} material={material('innerGloss', '#fbf7ef')} />
          <Ball r={0.032} mat="emissive" color="#fff1d0" pos={bulb} />
          <pointLight position={bulb} color="#ffd59a" intensity={1.6} distance={4} decay={2} />
        </group>
      </group>
      <mesh geometry={tubeAlong([joint, [0.03, apex[1] + 0.05, 0.02], lerp3(apex, feet[1], 0.5), [feet[1][0] * 0.9, 0.003, feet[1][2] * 0.9 + 0.15], [feet[1][0] * 0.4, 0.003, feet[1][2] + 0.4]], 0.0035)} material={material('rubber', '#b75c5c')} />
    </group>
  )
}

/** Camera tripod (with a phone clamp) or a light stand with an LED panel. */
function Tripod({ item, panel }: { item: Item; panel?: boolean }) {
  const { w, h } = sizeM(item)
  const apexY = h * (panel ? 0.42 : 0.55)
  const apex: V3 = [0, apexY, 0]
  const feet = legFeet(w * 0.46)
  const colTop = panel ? h - 0.2 : h - 0.08
  const c = item.color
  return (
    <group>
      {feet.map((f, i) => {
        const mid = lerp3(apex, f, 0.55)
        return (
          <group key={i}>
            <Rod from={apex} to={mid} r={0.011} mat="paintedMetal" color={c} />
            <Rod from={mid} to={f} r={0.008} mat="metal" color="#2c2c2c" />
            <Part size={[0.028, 0.03, 0.028]} radius={0.004} mat="plastic" color={DARK_PLASTIC} pos={mid} />
            <Ball r={0.012} mat="rubber" color="#111" pos={[f[0], 0.008, f[2]]} />
            {!panel && <Rod from={lerp3(apex, f, 0.35)} to={[0, apexY - 0.16, 0]} r={0.005} mat="metal" color="#2c2c2c" />}
          </group>
        )
      })}
      <Cyl r={0.026} h={0.06} mat="plastic" color={DARK_PLASTIC} pos={[0, apexY, 0]} />
      <Rod from={[0, apexY - (panel ? 0.05 : 0.18), 0]} to={[0, colTop, 0]} r={0.012} mat="metal" color="#3a3a3a" />
      {panel ? (
        <group position={[0, h - 0.12, 0]}>
          <Rod from={[-0.17, -0.06, 0]} to={[0.17, -0.06, 0]} r={0.006} mat="metal" color="#2c2c2c" />
          <Part size={[0.32, 0.22, 0.028]} radius={0.008} mat="plastic" color={item.color2 ?? '#262626'} />
          <mesh position={[0, 0, 0.0145]}>
            <planeGeometry args={[0.29, 0.19]} />
            <meshStandardMaterial color="#f6f2ea" emissive="#fff4df" emissiveIntensity={0.5} roughness={0.4} />
          </mesh>
        </group>
      ) : (
        <group position={[0, colTop, 0]}>
          <Part size={[0.065, 0.055, 0.075]} radius={0.012} mat="plastic" color={DARK_PLASTIC} pos={[0, 0.02, 0]} />
          <Rod from={[0.02, 0.03, -0.03]} to={[0.1, -0.02, -0.24]} r={0.007} mat="plastic" color={DARK_PLASTIC} />
          <Part size={[0.085, 0.02, 0.02]} radius={0.004} mat="plastic" color={DARK_PLASTIC} pos={[0, 0.07, 0]} />
          {[-1, 1].map((sx) => (
            <Part key={sx} size={[0.012, 0.035, 0.022]} radius={0.003} mat="plastic" color={DARK_PLASTIC} pos={[sx * 0.04, 0.09, 0]} />
          ))}
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------- soft furnishings

function Rug({ item }: { item: Item }) {
  const { w, d } = sizeM(item)
  const t = Math.max(sizeM(item).h, 0.008)
  const fringe = useRef<THREE.InstancedMesh>(null)
  const count = Math.max(0, Math.floor(w / 0.015)) * 2
  useLayoutEffect(() => {
    const m = fringe.current
    if (!m) return
    const o = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1
      const x = -w / 2 + 0.01 + Math.floor(i / 2) * 0.015
      o.position.set(x, 0.002, side * (d / 2 + 0.025))
      o.rotation.set(Math.PI / 2, 0, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [count, w, d])
  return (
    <group>
      <Part size={[w, t, d]} radius={Math.min(0.004, t / 2.5)} mat="rug" color={item.color} pos={[0, t / 2, 0]} />
      {item.image && <Art url={item.image} label={item.name} w={w} h={d} pos={[0, t + 0.001, 0]} rot={[-Math.PI / 2, 0, 0]} fit="stretch" />}
      <instancedMesh key={count} ref={fringe} args={[undefined, undefined, count]} material={material('cloth', '#efe8da')}>
        <cylinderGeometry args={[0.002, 0.002, 0.05, 4]} />
      </instancedMesh>
    </group>
  )
}

/** A potted plant: glazed pot, soil, and leaves on arching stems. */
function Plant({ item }: { item: Item }) {
  const { w, h } = sizeM(item)
  const potH = Math.min(0.32, h * 0.3)
  const potR = w * 0.3
  const leaves = useRef<THREE.InstancedMesh>(null)
  const stems = useMemo(() => {
    const rand = rng(item.id)
    return Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.6
      const reach = w * (0.15 + rand() * 0.3)
      const top = potH + (h - potH) * (0.45 + rand() * 0.55)
      return { tip: [Math.cos(a) * reach, top, Math.sin(a) * reach] as V3, a, size: Math.min(0.26, h * 0.16) * (0.75 + rand() * 0.5), tint: 0.75 + rand() * 0.35 }
    })
  }, [item.id, w, h, potH])
  useLayoutEffect(() => {
    const m = leaves.current
    if (!m) return
    const o = new THREE.Object3D()
    const base = new THREE.Color(item.color)
    stems.forEach((s, i) => {
      o.position.set(...s.tip)
      o.rotation.set(-0.9, -s.a + Math.PI / 2, 0, 'YXZ')
      o.scale.set(s.size * 0.6, s.size, 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, base.clone().multiplyScalar(s.tint))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [stems, item.color])
  return (
    <group>
      <Cyl r={potR * 0.78} r2={potR} h={potH} mat="ceramic" color={item.color2 ?? '#c06a45'} pos={[0, potH / 2, 0]} segments={32} />
      <Cyl r={potR * 0.94} h={0.01} mat="soil" color="#3b2a1e" pos={[0, potH - 0.015, 0]} segments={28} />
      {stems.map((s, i) => (
        <mesh key={i} geometry={tubeAlong([[0, potH - 0.02, 0], [s.tip[0] * 0.3, (potH + s.tip[1]) / 2, s.tip[2] * 0.3], s.tip], 0.004)} material={material('plastic', '#5c7a3e')} castShadow />
      ))}
      <instancedMesh ref={leaves} args={[undefined, undefined, stems.length]} material={material('leaf', '#ffffff')} castShadow>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
    </group>
  )
}

// ---------------------------------------------------------------- wall items

/** Framed print behind glass. frame = 0 means the picture already includes its frame. */
function Poster({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const f = (item.frame ?? 2) / 100
  if (f <= 0)
    return (
      <group>
        <Part size={[w, h, d]} mat="plastic" color={item.color} pos={[0, h / 2, d / 2]} />
        <Art url={item.image} label={item.name} w={w} h={h} pos={[0, h / 2, d + 0.001]} />
        <mesh position={[0, h / 2, d + 0.003]} material={material('glass', '#ffffff')}>
          <planeGeometry args={[w, h]} />
        </mesh>
      </group>
    )
  return (
    <group>
      {[
        { size: [w, f, d] as V3, pos: [0, h - f / 2, d / 2] as V3 },
        { size: [w, f, d] as V3, pos: [0, f / 2, d / 2] as V3 },
        { size: [f, h - 2 * f, d] as V3, pos: [-w / 2 + f / 2, h / 2, d / 2] as V3 },
        { size: [f, h - 2 * f, d] as V3, pos: [w / 2 - f / 2, h / 2, d / 2] as V3 },
      ].map((p, i) => (
        <Part key={i} size={p.size} radius={0.002} mat="gloss" color={item.color} pos={p.pos} />
      ))}
      <Part size={[w - 2 * f + 0.002, h - 2 * f + 0.002, 0.006]} mat="paper" color="#f4f2ee" pos={[0, h / 2, 0.003]} />
      <Art url={item.image} label={item.name} w={w - 2 * f} h={h - 2 * f} pos={[0, h / 2, d * 0.55]} />
      <mesh position={[0, h / 2, d * 0.75]} material={material('glass', '#ffffff')}>
        <planeGeometry args={[w - 2 * f, h - 2 * f]} />
      </mesh>
    </group>
  )
}

/** Split-system indoor unit: rounded white body, air outlet with a flap, status light. */
function AirCon({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  return (
    <group>
      <Part size={[w, h, d]} radius={Math.min(0.035, h / 3)} mat="gloss" color={item.color} pos={[0, h / 2, d / 2]} />
      <Part size={[w * 0.84, 0.028, 0.02]} radius={0.004} mat="plastic" color="#2f2f2f" pos={[0, 0.035, d - 0.008]} />
      <Part size={[w * 0.84, 0.005, 0.055]} radius={0.002} mat="gloss" color={item.color} pos={[0, 0.018, d + 0.006]} rot={[0.45, 0, 0]} />
      <Part size={[w * 0.92, 0.002, 0.002]} mat="plastic" color="#d9d9d6" pos={[0, h * 0.62, d + 0.0005]} />
      <Part size={[0.035, 0.008, 0.002]} mat="emissive" color="#6fb6ff" pos={[w * 0.3, h * 0.42, d + 0.001]} />
    </group>
  )
}

function Whiteboard({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const f = 0.015
  return (
    <group>
      <Part size={[w, h, d]} radius={0.003} mat="metal" color="#c9cdd1" pos={[0, h / 2, d / 2]} />
      <Part size={[w - 2 * f, h - 2 * f, 0.002]} mat="gloss" color={item.color} pos={[0, h / 2, d + 0.001]} />
      <Part size={[w * 0.5, 0.012, 0.045]} radius={0.003} mat="metal" color="#c9cdd1" pos={[0, 0.006, 0.025]} />
      {[
        ['#1b4fd8', -0.06],
        ['#d83a1b', 0.04],
      ].map(([c, x]) => (
        <Cyl key={c as string} r={0.007} h={0.12} mat="plastic" color={c as string} pos={[x as number, 0.02, 0.03]} rot={[0, 0, Math.PI / 2]} />
      ))}
    </group>
  )
}

/** Floor-length curtain in soft gathered folds on a ceiling track. */
function Curtain({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const geometry = useMemo(() => {
    const rand = rng(item.id)
    const waves = Array.from({ length: 4 }, () => ({ period: 0.06 + rand() * 0.14, phase: rand() * 6.28, amp: 0.008 + rand() * 0.015 }))
    const g = new THREE.PlaneGeometry(w, h, Math.max(16, Math.round(w / 0.012)), 16)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const t = 0.5 - y / h // 0 at the top, 1 at the bottom
      const fold = waves.reduce((s, wv) => s + Math.sin((x / wv.period) * Math.PI * 2 + wv.phase + t * 0.6) * wv.amp, 0)
      p.setZ(i, fold * (1 + t * 0.5) + t * 0.01)
    }
    g.computeVertexNormals()
    return g
  }, [item.id, w, h])
  return (
    <group>
      <mesh geometry={geometry} material={material(curtainMat(item), item.color)} position={[0, h / 2, d / 2]} castShadow={item.style !== 'sheer'} receiveShadow />
      <Part size={[w + 0.08, 0.022, 0.035]} radius={0.004} mat="plastic" color="#e8e8e4" pos={[0, h + 0.005, d / 2]} />
    </group>
  )
}

/** Sectional aluminium radiator with a valve and pipes down into the floor. */
function Radiator({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const n = Math.max(2, Math.round(w / 0.08))
  const fin = w / n
  const elev = item.place.type === 'wall' ? item.place.elev / 100 : 0
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + fin * (i + 0.5)
        return (
          <group key={i} position={[x, 0, 0]}>
            <Part size={[fin - 0.006, h, 0.014]} radius={0.005} mat="gloss" color={item.color} pos={[0, h / 2, d - 0.007]} />
            <Part size={[0.006, h - 0.03, d - 0.02]} mat="gloss" color={item.color} pos={[0, h / 2, d / 2]} />
          </group>
        )
      })}
      {[0.035, h - 0.035].map((y) => (
        <Part key={y} size={[w, 0.03, d * 0.5]} radius={0.01} mat="gloss" color={item.color} pos={[0, y, d / 2]} />
      ))}
      <Cyl r={0.012} h={0.05} mat="chrome" color="#d6d6d6" pos={[w / 2 + 0.025, 0.035, d / 2]} rot={[0, 0, Math.PI / 2]} />
      <Cyl r={0.016} h={0.035} mat="plastic" color="#f2f2f2" pos={[w / 2 + 0.05, 0.035, d / 2]} />
      {[w / 2 + 0.05, -w / 2 - 0.02].map((x) => (
        <Cyl key={x} r={0.008} h={0.035 + elev} mat="chrome" color="#e2e2e2" pos={[x, (0.035 - elev) / 2, d / 2]} />
      ))}
    </group>
  )
}

function Mirror({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  return (
    <group>
      <Part size={[w, h, d]} radius={0.004} mat="gloss" color={item.color} pos={[0, h / 2, d / 2]} />
      <Part size={[w - 0.03, h - 0.03, 0.002]} mat="chrome" color="#eef3f5" pos={[0, h / 2, d + 0.001]} />
    </group>
  )
}

function WallShelf({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  return <Part size={[w, h, d]} radius={0.003} mat="wood" color={item.color} pos={[0, h / 2, d / 2]} />
}

// ---------------------------------------------------------------- photo cutouts

let shadowTexture: THREE.CanvasTexture | null = null
function contactShadow() {
  if (shadowTexture) return shadowTexture
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.2)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  shadowTexture = new THREE.CanvasTexture(c)
  return shadowTexture
}

function CutoutPlane({ url, w, h }: { url: string; w: number; h: number }) {
  const tex = useTexture(url)
  const { mat, depth } = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return {
      mat: new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }),
      depth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 }),
    }
  }, [tex])
  return (
    <mesh position={[0, h / 2, 0]} material={mat} customDepthMaterial={depth} castShadow>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

/**
 * A product photo (background removed) standing at its real size. It turns to face the camera like
 * a cardboard cut-out, so it reads from any angle; its footprint on the plan stays fixed.
 */
function Cutout({ item }: { item: Item }) {
  const { w, d, h } = sizeM(item)
  const turner = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    const g = turner.current
    if (!g?.parent) return
    const at = g.parent.getWorldPosition(new THREE.Vector3())
    const parentTurn = new THREE.Euler().setFromQuaternion(g.parent.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y
    g.rotation.y = Math.atan2(camera.position.x - at.x, camera.position.z - at.z) - parentTurn
  })
  const fallback = <Part size={[w, h, Math.min(d, 0.02)]} mat="plastic" color={item.color} pos={[0, h / 2, 0]} />
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} raycast={() => null}>
        <planeGeometry args={[w * 1.1, Math.max(d, 0.2) * 1.1]} />
        <meshBasicMaterial map={contactShadow()} transparent depthWrite={false} />
      </mesh>
      <group ref={turner}>
        {item.image ? (
          <Fallback key={item.image} fallback={fallback}>
            <Suspense fallback={fallback}>
              <CutoutPlane url={item.image} w={w} h={h} />
            </Suspense>
          </Fallback>
        ) : (
          fallback
        )}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- dispatch

function GlbModel({ url, item }: { url: string; item: Item }) {
  const { scene } = useGLTF(url)
  const { w, d, h } = sizeM(item)
  const wall = item.place.type === 'wall'
  const object = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
    })
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    clone.scale.set(w / (size.x || 1), h / (size.y || 1), d / (size.z || 1))
    const scaled = new THREE.Box3().setFromObject(clone)
    const centre = scaled.getCenter(new THREE.Vector3())
    clone.position.set(-centre.x, -scaled.min.y, wall ? -scaled.min.z : -centre.z)
    return clone
  }, [scene, w, d, h, wall])
  return <primitive object={object} />
}

function ShapeModel({ item }: { item: Item }) {
  const style = item.style
  switch (item.shape) {
    case 'bed':
      return style === 'wood' || style === 'panel' || style === 'cushioned' ? <BedVariant item={item} /> : <Bed item={item} />
    case 'desk':
      return style === 'classic' || style === 'drawers' ? <DeskVariant item={item} /> : <Desk item={item} controls={style !== 'metal'} />
    case 'officeChair':
      return <OfficeChair item={item} />
    case 'chair':
      return <Chair item={item} />
    case 'sofa':
      return style ? <SofaVariant item={item} /> : <Sofa item={item} />
    case 'bookshelf':
      return style === 'metal' ? <MetalShelving item={item} /> : <Bookshelf item={item} />
    case 'floorLamp':
      return style ? <LampVariant item={item} /> : <FloorLamp item={item} />
    case 'tripod':
      return <Tripod item={item} />
    case 'lightStand':
      return <Tripod item={item} panel />
    case 'foldingChair':
      return <FoldingChair item={item} />
    case 'table':
      return style ? <TableVariant item={item} /> : <Table item={item} />
    case 'box':
      return style || item.finish ? <StorageVariant item={item} /> : <BoxItem item={item} />
    case 'rug':
      return style ? <RugVariant item={item} /> : <Rug item={item} />
    case 'plant':
      return style ? <PlantVariant item={item} /> : <Plant item={item} />
    case 'cutout':
      return <Cutout item={item} />
    case 'poster':
      return <Poster item={item} />
    case 'ac':
      return <AirCon item={item} />
    case 'whiteboard':
      return <Whiteboard item={item} />
    case 'curtain':
      return <Curtain item={item} />
    case 'radiator':
      return <Radiator item={item} />
    case 'mirror':
      return style ? <MirrorVariant item={item} /> : <Mirror item={item} />
    case 'wallShelf':
      return style === 'ladder' ? <LadderShelf item={item} /> : <WallShelf item={item} />
  }
}

export function ItemModel({ item }: { item: Item }) {
  if (!item.model) return <ShapeModel item={item} />
  const fallback = <ShapeModel item={item} />
  return (
    <Fallback key={item.model} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GlbModel url={item.model} item={item} />
      </Suspense>
    </Fallback>
  )
}
