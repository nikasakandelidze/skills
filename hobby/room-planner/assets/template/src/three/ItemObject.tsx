import { Edges, Html } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { clampFloor, clampWall, WALL_ROT_Y, wallFrame, wallPoint } from '../geometry'
import { useStore } from '../store'
import type { Item, Room } from '../types'
import { ItemBar } from '../ui/Overlays'
import { ItemModel } from './models'
import { cutaway } from './RoomMesh'

const SELECT = '#5e6ad2'
const ERROR = '#e5484d'

interface DragState {
  plane: THREE.Plane
  offset: THREE.Vector3
  moved: boolean
}

function useItemDrag(item: Item, room: Room) {
  const { camera, gl, controls } = useThree()
  const drag = useRef<DragState | null>(null)
  const raycaster = useRef(new THREE.Raycaster())
  const latest = useRef({ item, room })
  latest.current = { item, room }

  useEffect(() => {
    const el = gl.domElement
    const hit = (e: PointerEvent, plane: THREE.Plane) => {
      const rect = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.current.setFromCamera(ndc, camera)
      return raycaster.current.ray.intersectPlane(plane, new THREE.Vector3())
    }
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const p = hit(e, d.plane)
      if (!p) return
      const { item, room } = latest.current
      const store = useStore.getState()
      if (!d.moved) {
        store.checkpoint()
        d.moved = true
      }
      p.add(d.offset)
      if (item.place.type === 'floor') {
        const c = clampFloor(room, item, p.x * 100, p.z * 100)
        store.setPlace(item.id, { ...item.place, ...c })
      } else {
        const f = wallFrame(room, item.place.wall)
        const along = (p.x * 100 - f.origin[0]) * f.dir[0] + (p.z * 100 - f.origin[1]) * f.dir[1]
        const c = clampWall(room, item.size, item.place.wall, along, p.y * 100)
        store.setPlace(item.id, { ...item.place, ...c })
      }
    }
    const up = () => {
      if (!drag.current) return
      drag.current = null
      if (controls) (controls as unknown as { enabled: boolean }).enabled = true
      el.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [camera, gl, controls])

  return (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    // Hidden with a cut-away wall: let the click fall through to whatever is behind it.
    if (item.place.type === 'wall' && cutaway[item.place.wall]) return
    e.stopPropagation()
    useStore.getState().select(item.id)
    if (item.locked) return
    let plane: THREE.Plane
    let anchor: THREE.Vector3
    if (item.place.type === 'floor') {
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      anchor = new THREE.Vector3(item.place.x / 100, 0, item.place.z / 100)
    } else {
      const f = wallFrame(room, item.place.wall)
      const normal = new THREE.Vector3(f.normal[0], 0, f.normal[1])
      const origin = new THREE.Vector3(f.origin[0] / 100, 0, f.origin[1] / 100)
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
      const [px, pz] = wallPoint(room, item.place.wall, item.place.along)
      anchor = new THREE.Vector3(px / 100, item.place.elev / 100, pz / 100)
    }
    const p = e.ray.intersectPlane(plane, new THREE.Vector3())
    if (!p) return
    drag.current = { plane, offset: anchor.sub(p), moved: false }
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
    gl.domElement.style.cursor = 'grabbing'
  }
}

export function ItemObject({ item, room, hasError }: { item: Item; room: Room; hasError: boolean }) {
  const selected = useStore((s) => s.selectedId === item.id)
  const onPointerDown = useItemDrag(item, room)
  const group = useRef<THREE.Group>(null)
  const { w, d, h } = { w: item.size.w / 100, d: item.size.d / 100, h: item.size.h / 100 }
  const p = item.place
  const wall = p.type === 'wall' ? p.wall : null

  useFrame(() => {
    if (group.current && wall) group.current.visible = !cutaway[wall]
  })

  let position: [number, number, number]
  let rotationY: number
  if (p.type === 'floor') {
    position = [p.x / 100, 0, p.z / 100]
    rotationY = (-p.rot * Math.PI) / 180
  } else {
    const [x, z] = wallPoint(room, p.wall, p.along)
    position = [x / 100, p.elev / 100, z / 100]
    rotationY = WALL_ROT_Y[p.wall]
  }
  const boxCentre: [number, number, number] = p.type === 'floor' ? [0, h / 2, 0] : [0, h / 2, d / 2]
  const outline = hasError ? ERROR : SELECT

  return (
    <group
      ref={group}
      position={position}
      rotation={[0, rotationY, 0]}
      onPointerDown={onPointerDown}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = item.locked ? 'pointer' : 'grab'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <ItemModel item={item} />
      {(selected || hasError) && (
        <mesh position={boxCentre} raycast={() => null}>
          <boxGeometry args={[w + 0.01, h + 0.01, d + 0.01]} />
          <meshBasicMaterial visible={false} />
          <Edges color={outline} lineWidth={selected ? 2 : 1} />
        </mesh>
      )}
      {selected && p.type === 'floor' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} raycast={() => null}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color={outline} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
      {selected && (
        <Html position={[0, h + (p.type === 'floor' ? 0.1 : 0.08), p.type === 'floor' ? 0 : d]} center zIndexRange={[20, 0]}>
          <ItemBar item={item} hasError={hasError} />
        </Html>
      )}
    </group>
  )
}
