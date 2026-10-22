import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WALL_ROT_Y, WALLS, wallFrame, wallLength, wallPieces, type WallPiece } from '../geometry'
import type { Opening, Room, WallId } from '../types'
import { boxUV, cachedGeometry, material, parquet } from './materials'
import { Cyl, Part } from './parts'

/** Which walls are currently cut away because the camera is looking through them. */
export const cutaway: Record<WallId, boolean> = { north: false, east: false, south: false, west: false }

const STUB = 0.08
const SECTION = '#4d4843'
const PLASTER = '#ece8e1'
const DOOR_WOOD = '#6e2b17'

const plaster = new THREE.MeshStandardMaterial({ color: PLASTER, roughness: 0.9 })
const section = new THREE.MeshStandardMaterial({ color: SECTION, roughness: 0.9 })

/** Updates `cutaway` every frame from the camera position, before anything reads it. */
export function CutawayUpdater({ room }: { room: Room }) {
  useFrame(({ camera }) => {
    const { x, z } = camera.position
    const W = room.width / 100
    const D = room.depth / 100
    cutaway.north = z < -0.05
    cutaway.south = z > D + 0.05
    cutaway.west = x < -0.05
    cutaway.east = x > W + 0.05
  }, -1)
  return null
}

/** Shows `children` normally, and `stub` instead while that wall is cut away. */
export function CutSwitch({ wall, children, stub }: { wall: WallId; children: React.ReactNode; stub?: React.ReactNode }) {
  const full = useRef<THREE.Group>(null)
  const low = useRef<THREE.Group>(null)
  useFrame(() => {
    if (full.current) full.current.visible = !cutaway[wall]
    if (low.current) low.current.visible = cutaway[wall]
  })
  return (
    <>
      <group ref={full}>{children}</group>
      {stub && <group ref={low}>{stub}</group>}
    </>
  )
}

/**
 * One solid block of wall. Its geometry is built in wall coordinates so the wallpaper texture runs
 * continuously across blocks instead of restarting at every window edge.
 */
function PieceMesh({ piece, t, maxY }: { piece: WallPiece; t: number; maxY?: number }) {
  const y1 = Math.min(piece.y1 / 100, maxY ?? Infinity)
  const y0 = piece.y0 / 100
  const x0 = piece.from / 100
  const x1 = piece.to / 100
  const geometry = useMemo(() => {
    if (y1 - y0 <= 0.001) return null
    return cachedGeometry(`wall:${x0}:${x1}:${y0}:${y1}:${t}`, () => {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, t)
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, -t / 2)
      return boxUV(g, [10, 1, 0.01])
    })
  }, [x0, x1, y0, y1, t])
  const face = material(piece.finish ? 'textileWall' : 'wallpaper', piece.color)
  if (!geometry) return null
  return <mesh geometry={geometry} material={[plaster, plaster, section, plaster, face, plaster]} castShadow receiveShadow />
}

/** Thin lighter lines where the wall-covering rolls meet (about every 106 cm), like in the photos. */
function Seams({ room, wall }: { room: Room; wall: WallId }) {
  const H = room.height / 100
  const lines: number[] = []
  for (const f of room.finishes.filter((f) => f.wall === wall)) {
    for (let x = f.from + 106; x < f.to - 5; x += 106) {
      if (room.openings.some((o) => o.wall === wall && Math.abs(x - o.along) < o.width / 2 + 2)) continue
      lines.push(x / 100)
    }
  }
  const color = new THREE.Color(room.finishes.find((f) => f.wall === wall)?.color ?? '#555').lerp(new THREE.Color('#ffffff'), 0.22).getStyle()
  return (
    <>
      {lines.map((x) => (
        <Part key={x} size={[0.0025, H - 0.08, 0.0008]} mat="plastic" color={color} pos={[x, 0.08 + (H - 0.08) / 2, 0.0004]} shadow={false} />
      ))}
    </>
  )
}

/** Skirting board along the bottom of the wall, broken at doors. Dark under the panelling, light wood elsewhere. */
function Skirting({ room, wall }: { room: Room; wall: WallId }) {
  const L = wallLength(room, wall)
  const doors = room.openings.filter((o) => o.wall === wall && o.kind === 'door')
  const cuts = new Set<number>([0, L])
  doors.forEach((o) => (cuts.add(o.along - o.width / 2 - 6), cuts.add(o.along + o.width / 2 + 6)))
  room.finishes.filter((f) => f.wall === wall).forEach((f) => (cuts.add(f.from), cuts.add(f.to)))
  const sorted = [...cuts].filter((c) => c >= 0 && c <= L).sort((a, b) => a - b)
  const boards: { from: number; to: number; dark: boolean }[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const mid = (sorted[i] + sorted[i + 1]) / 2
    if (sorted[i + 1] - sorted[i] < 1) continue
    if (doors.some((o) => Math.abs(mid - o.along) < o.width / 2 + 6)) continue
    boards.push({ from: sorted[i], to: sorted[i + 1], dark: room.finishes.some((f) => f.wall === wall && mid > f.from && mid < f.to) })
  }
  return (
    <>
      {boards.map((b) => (
        <Part
          key={b.from}
          size={[(b.to - b.from) / 100, 0.07, 0.014]}
          radius={0.002}
          mat="wood"
          color={b.dark ? '#3a2b22' : '#a87a4e'}
          pos={[(b.from + b.to) / 200, 0.035, 0.007]}
        />
      ))}
    </>
  )
}

function WindowUnit({ o, t }: { o: Opening; t: number }) {
  const w = o.width / 100
  const h = o.height / 100
  const f = 0.06
  const sash = 0.05
  const white = '#f6f6f3'
  return (
    <group position={[o.along / 100, o.sill / 100 + h / 2, -t / 2]}>
      {/* Evening sky behind the glass. */}
      <mesh position={[0, 0, -t / 2 - 0.05]}>
        <planeGeometry args={[w + 0.2, h + 0.2]} />
        <meshBasicMaterial color="#9fb3c8" toneMapped={false} />
      </mesh>
      {[
        { size: [w, f, 0.07], pos: [0, h / 2 - f / 2, 0] },
        { size: [w, f, 0.07], pos: [0, -h / 2 + f / 2, 0] },
        { size: [f, h, 0.07], pos: [-w / 2 + f / 2, 0, 0] },
        { size: [f, h, 0.07], pos: [w / 2 - f / 2, 0, 0] },
      ].map((p, i) => (
        <Part key={i} size={p.size as [number, number, number]} radius={0.004} mat="plastic" color={white} pos={p.pos as [number, number, number]} />
      ))}
      {[-1, 1].map((sx) => {
        const sw = w / 2 - f
        return (
          <group key={sx} position={[(sx * (w / 2 - f)) / 2, 0, 0.012]}>
            {[
              { size: [sw, sash, 0.06], pos: [0, (h - 2 * f) / 2 - sash / 2, 0] },
              { size: [sw, sash, 0.06], pos: [0, -(h - 2 * f) / 2 + sash / 2, 0] },
              { size: [sash, h - 2 * f, 0.06], pos: [-sw / 2 + sash / 2, 0, 0] },
              { size: [sash, h - 2 * f, 0.06], pos: [sw / 2 - sash / 2, 0, 0] },
            ].map((p, i) => (
              <Part key={i} size={p.size as [number, number, number]} radius={0.004} mat="plastic" color={white} pos={p.pos as [number, number, number]} />
            ))}
            <mesh material={material('glass', '#dfeaf2')}>
              <planeGeometry args={[sw - 2 * sash, h - 2 * f - 2 * sash]} />
            </mesh>
            <Part size={[0.018, 0.11, 0.02]} radius={0.006} mat="plastic" color={white} pos={[-sx * (sw / 2 - sash / 2), 0, 0.04]} />
          </group>
        )
      })}
      <Part size={[w + 0.08, 0.025, t / 2 + 0.06]} radius={0.004} mat="ceramic" color="#f1efea" pos={[0, -h / 2 - 0.0125, t / 4 + 0.03]} />
    </group>
  )
}

/** Mahogany double door with horizontal grooves, chrome lever handles, architrave and a panel up to the ceiling. */
function DoorUnit({ o, t, roomH }: { o: Opening; t: number; roomH: number }) {
  const w = o.width / 100
  const h = o.height / 100
  const leaves = w > 1 ? 2 : 1
  const leafW = w / leaves
  const groove = '#3e160b'
  return (
    <group position={[o.along / 100, 0, 0]}>
      {Array.from({ length: leaves }, (_, i) => {
        const x = -w / 2 + leafW * (i + 0.5)
        const hinge = leaves === 2 ? (i === 0 ? -1 : 1) : -1
        const handleX = -hinge * (leafW / 2 - 0.07)
        return (
          <group key={i} position={[x, h / 2, -0.024]}>
            <Part size={[leafW - 0.006, h - 0.006, 0.04]} radius={0.003} mat="wood" color={DOOR_WOOD} />
            {Array.from({ length: 9 }, (_, g) => (
              <Part key={g} size={[leafW * 0.78, 0.004, 0.002]} mat="plastic" color={groove} pos={[0, -h / 2 + (h * (g + 1)) / 10, 0.0205]} shadow={false} />
            ))}
            <group position={[handleX, -0.02 * h, 0.021]}>
              <Cyl r={0.025} h={0.008} mat="chrome" color="#d2d2d2" rot={[Math.PI / 2, 0, 0]} />
              <Cyl r={0.009} h={0.05} mat="chrome" color="#d2d2d2" pos={[0, 0, 0.025]} rot={[Math.PI / 2, 0, 0]} />
              <Part size={[0.13, 0.016, 0.016]} radius={0.007} mat="chrome" color="#d2d2d2" pos={[-hinge * 0.05, 0, 0.05]} />
              <Cyl r={0.017} h={0.006} mat="chrome" color="#d2d2d2" pos={[0, -0.09, 0]} rot={[Math.PI / 2, 0, 0]} />
              <Part size={[0.004, 0.012, 0.002]} mat="plastic" color="#111" pos={[0, -0.09, 0.004]} />
            </group>
            {[0.3, -0.35].map((y) => (
              <Cyl key={y} r={0.008} h={0.1} mat="chrome" color="#bdbdbd" pos={[hinge * (leafW / 2 - 0.004), y * h, 0.02]} />
            ))}
          </group>
        )
      })}
      {roomH - h > 0.02 && (
        <group position={[0, h + (roomH - h) / 2, 0.012]}>
          <Part size={[w + 0.12, roomH - h, 0.024]} mat="wood" color={DOOR_WOOD} />
          <Part size={[0.003, roomH - h - 0.02, 0.002]} mat="plastic" color={groove} pos={[0, 0, 0.0125]} shadow={false} />
        </group>
      )}
      {[-1, 1].map((sx) => (
        <Part key={sx} size={[0.06, h, 0.024]} radius={0.003} mat="wood" color={DOOR_WOOD} pos={[sx * (w / 2 + 0.03), h / 2, 0.012]} />
      ))}
      <Part size={[w, 0.004, t]} mat="wood" color="#7a4a2e" pos={[0, 0.002, -t / 2]} />
    </group>
  )
}

function Wall({ room, wall }: { room: Room; wall: WallId }) {
  const t = room.wallThickness / 100
  const f = wallFrame(room, wall)
  const pieces = useMemo(() => wallPieces(room, wall), [room, wall])
  const openings = room.openings.filter((o) => o.wall === wall)
  return (
    <group position={[f.origin[0] / 100, 0, f.origin[1] / 100]} rotation={[0, WALL_ROT_Y[wall], 0]}>
      <CutSwitch
        wall={wall}
        stub={pieces.map((p, i) => (
          <PieceMesh key={i} piece={p} t={t} maxY={STUB} />
        ))}
      >
        {pieces.map((p, i) => (
          <PieceMesh key={i} piece={p} t={t} />
        ))}
        <Seams room={room} wall={wall} />
        {openings.map((o) =>
          o.kind === 'window' ? <WindowUnit key={o.id} o={o} t={t} /> : <DoorUnit key={o.id} o={o} t={t} roomH={room.height / 100} />,
        )}
      </CutSwitch>
      <Skirting room={room} wall={wall} />
    </group>
  )
}

function CornerPost({ x, z, t, h, walls }: { x: number; z: number; t: number; h: number; walls: [WallId, WallId] }) {
  const full = useRef<THREE.Group>(null)
  const low = useRef<THREE.Group>(null)
  useFrame(() => {
    const cut = cutaway[walls[0]] || cutaway[walls[1]]
    if (full.current) full.current.visible = !cut
    if (low.current) low.current.visible = cut
  })
  const post = (height: number) => (
    <mesh position={[x, height / 2, z]} material={[plaster, plaster, section, plaster, plaster, plaster]}>
      <boxGeometry args={[t, height, t]} />
    </mesh>
  )
  return (
    <>
      <group ref={full}>{post(h)}</group>
      <group ref={low}>{post(STUB)}</group>
    </>
  )
}

function Corners({ room }: { room: Room }) {
  const t = room.wallThickness / 100
  const W = room.width / 100
  const D = room.depth / 100
  const H = room.height / 100
  const corners: { x: number; z: number; walls: [WallId, WallId] }[] = [
    { x: -t / 2, z: -t / 2, walls: ['north', 'west'] },
    { x: W + t / 2, z: -t / 2, walls: ['north', 'east'] },
    { x: W + t / 2, z: D + t / 2, walls: ['south', 'east'] },
    { x: -t / 2, z: D + t / 2, walls: ['south', 'west'] },
  ]
  return (
    <>
      {corners.map((c, i) => (
        <CornerPost key={i} x={c.x} z={c.z} t={t} h={H} walls={c.walls} />
      ))}
    </>
  )
}

function Floor({ room }: { room: Room }) {
  const W = room.width / 100
  const D = room.depth / 100
  const mat = useMemo(() => {
    const { map, normalMap, roughnessMap } = parquet(room.floorColor)
    const fit = (tex: THREE.Texture) => {
      const t = tex.clone()
      t.repeat.set(W / 2, D / 2)
      t.needsUpdate = true
      return t
    }
    return new THREE.MeshPhysicalMaterial({
      map: fit(map),
      normalMap: fit(normalMap),
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: fit(roughnessMap),
      roughness: 1,
      clearcoat: 0.3,
      clearcoatRoughness: 0.35,
    })
  }, [room.floorColor, W, D])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0.001, D / 2]} material={mat} receiveShadow>
      <planeGeometry args={[W, D]} />
    </mesh>
  )
}

export function RoomMesh({ room }: { room: Room }) {
  const W = room.width / 100
  const D = room.depth / 100
  const t = room.wallThickness / 100
  return (
    <group>
      <mesh position={[W / 2, -0.03, D / 2]} receiveShadow>
        <boxGeometry args={[W + 2 * t, 0.06, D + 2 * t]} />
        <meshStandardMaterial color="#d3cdc4" roughness={1} />
      </mesh>
      <Floor room={room} />
      {WALLS.map((w) => (
        <Wall key={w} room={room} wall={w} />
      ))}
      <Corners room={room} />
    </group>
  )
}
