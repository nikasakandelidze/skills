import { Environment, Lightformer, OrbitControls, SoftShadows } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { fitIssues, wallPoint } from '../geometry'
import { useActiveItems, useStore, type CameraPreset } from '../store'
import type { Item, Room } from '../types'
import { canvasHandle, exposeForDebugging } from './handles'
import { ItemObject } from './ItemObject'
import { CutawayUpdater, RoomMesh } from './RoomMesh'

type View = { pos: THREE.Vector3; target: THREE.Vector3 }

function frontOf(item: Item): [number, number] {
  const rot = item.place.type === 'floor' ? (item.place.rot * Math.PI) / 180 : 0
  // Local +z (front) rotated clockwise in plan coordinates.
  return [-Math.sin(rot), Math.cos(rot)]
}

/** Orbit around a point just in front of the eye, so dragging looks around instead of circling the room. */
function eyeLevel(eye: THREE.Vector3, lookAt: THREE.Vector3): View {
  const dir = lookAt.clone().sub(eye).normalize()
  return { pos: eye, target: eye.clone().addScaledVector(dir, 0.6) }
}

function presetView(preset: CameraPreset, room: Room, items: Item[], camera: THREE.PerspectiveCamera): View {
  const W = room.width / 100
  const D = room.depth / 100
  const H = room.height / 100
  const centre = new THREE.Vector3(W / 2, H * 0.3, D / 2)
  const halfV = THREE.MathUtils.degToRad(camera.fov / 2)
  const halfH = Math.atan(Math.tan(halfV) * (camera.aspect > 0.1 ? camera.aspect : 1.5))
  switch (preset) {
    case 'top': {
      const dist = Math.max(D / 2 / Math.tan(halfV), W / 2 / Math.tan(halfH)) * 1.12
      return { pos: new THREE.Vector3(W / 2, dist, D / 2 + 0.001), target: new THREE.Vector3(W / 2, 0, D / 2) }
    }
    case 'door': {
      const door = room.openings.find((o) => o.kind === 'door')
      if (door) {
        const [x, z] = wallPoint(room, door.wall, door.along, 45)
        return eyeLevel(new THREE.Vector3(x / 100, 1.6, z / 100), new THREE.Vector3(W / 2, 1.0, D / 2))
      }
      break
    }
    case 'desk': {
      const desk = items.find((i) => i.shape === 'desk' && i.place.type === 'floor')
      if (desk && desk.place.type === 'floor') {
        const [fx, fz] = frontOf(desk)
        const reach = desk.size.d / 200 + 0.5
        const eye = new THREE.Vector3(desk.place.x / 100 + fx * reach, 1.22, desk.place.z / 100 + fz * reach)
        return eyeLevel(eye, new THREE.Vector3(eye.x - fx * 3, 0.85, eye.z - fz * 3))
      }
      break
    }
    case 'bed': {
      const bed = items.find((i) => i.shape === 'bed' && i.place.type === 'floor')
      if (bed && bed.place.type === 'floor') {
        const [fx, fz] = frontOf(bed)
        const back = bed.size.d / 200 - 0.45
        const eye = new THREE.Vector3(bed.place.x / 100 - fx * back, 1.05, bed.place.z / 100 - fz * back)
        return eyeLevel(eye, new THREE.Vector3(W / 2 + 0.6, 0.9, D / 2))
      }
      break
    }
  }
  // Overview: from above the south-east corner, far enough back that the whole room fits the view.
  const radius = Math.hypot(W, D, H) / 2
  const dist = (radius / Math.sin(Math.min(halfV, halfH))) * 1.0
  const az = THREE.MathUtils.degToRad(32)
  const el = THREE.MathUtils.degToRad(44)
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  return { pos: centre.clone().addScaledVector(dir, dist), target: centre }
}

/** Eye-level views need a wide angle to feel like standing in the room, even in a narrow canvas. */
function fovFor(preset: CameraPreset, aspect: number) {
  if (preset === 'dollhouse' || preset === 'top') return 40
  const horizontal = THREE.MathUtils.degToRad(80)
  const vertical = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(horizontal / 2) / Math.max(aspect, 0.1)))
  return Math.min(100, Math.max(55, vertical))
}

function CameraRig({ room }: { room: Room }) {
  const request = useStore((s) => s.camera)
  const { camera, controls } = useThree()
  const size = useThree((s) => s.size)
  const anim = useRef<{ from: View; to: View; t: number } | null>(null)
  const handled = useRef(-1)
  const userMoved = useRef(false)

  useEffect(() => {
    const ctl = controls as unknown as THREE.EventDispatcher<{ start: object }> | null
    if (!ctl) return
    const onStart = () => (userMoved.current = true)
    ctl.addEventListener('start', onStart)
    return () => ctl.removeEventListener('start', onStart)
  }, [controls])

  useEffect(() => {
    const ctl = controls as unknown as { target: THREE.Vector3; update: () => void } | null
    if (!ctl || size.width < 10 || size.height < 10) return
    const fresh = handled.current !== request.nonce
    // Re-frame on resize only until the user takes over the camera.
    if (!fresh && userMoved.current) return
    handled.current = request.nonce
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = fovFor(request.preset, cam.aspect)
    cam.updateProjectionMatrix()
    const items = useStore.getState().variants.find((v) => v.id === useStore.getState().activeVariantId)?.items ?? []
    const to = presetView(request.preset, room, items, cam)
    if (request.nonce === 0 || !fresh) {
      camera.position.copy(to.pos)
      ctl.target.copy(to.target)
      ctl.update()
      return
    }
    userMoved.current = false
    anim.current = { from: { pos: camera.position.clone(), target: ctl.target.clone() }, to, t: 0 }
    // Room edits shouldn't yank the camera around, so `room` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.nonce, controls, size.width, size.height])

  useFrame((_, dt) => {
    const a = anim.current
    const ctl = controls as unknown as { target: THREE.Vector3; update: () => void } | null
    if (!a || !ctl) return
    a.t = Math.min(1, a.t + dt / 0.7)
    const k = 1 - Math.pow(1 - a.t, 3)
    camera.position.lerpVectors(a.from.pos, a.to.pos, k)
    ctl.target.lerpVectors(a.from.target, a.to.target, k)
    ctl.update()
    if (a.t >= 1) anim.current = null
  })
  return null
}

/** A ceiling spotlight shining straight down. Its target rides along as a child so it stays below it. */
function Downlight({ position }: { position: [number, number, number] }) {
  const light = useRef<THREE.SpotLight>(null)
  useLayoutEffect(() => {
    const l = light.current
    if (!l) return
    l.target.position.set(0, -1, 0)
    l.add(l.target)
  }, [])
  return <spotLight ref={light} position={position} angle={1.0} penumbra={1} intensity={3.2} distance={6} decay={2} color="#ffdcb0" />
}

function Lights({ room }: { room: Room }) {
  const W = room.width / 100
  const D = room.depth / 100
  const H = room.height / 100
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(W / 2, 0, D / 2)
    return o
  }, [W, D])
  // Recessed downlights in a grid, like the spotlights in the lowered ceiling.
  const downlights: [number, number][] = [
    [0.22, 0.32],
    [0.58, 0.32],
    [0.22, 0.72],
    [0.58, 0.72],
    [0.86, 0.52],
  ]
  return (
    <>
      <ambientLight intensity={0.12} color="#fff6ea" />
      <Environment resolution={256} frames={1} environmentIntensity={0.55}>
        <color attach="background" args={['#5a4c40']} />
        <Lightformer form="rect" intensity={2.4} color="#fff1dc" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#dbe6ff" position={[-7, 2, 1]} rotation-y={Math.PI / 2} scale={[5, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#ffe2c0" position={[7, 2, -1]} rotation-y={-Math.PI / 2} scale={[5, 3, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#ffffff" position={[0, 2, 7]} rotation-y={Math.PI} scale={[8, 3, 1]} />
      </Environment>
      <primitive object={target} />
      <directionalLight
        position={[W / 2 + 2.2, 6.5, D / 2 + 3]}
        target={target}
        intensity={1.35}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-camera-near={1}
        shadow-camera-far={16}
      />
      {downlights.map(([fx, fz], i) => (
        <Downlight key={i} position={[W * fx, H - 0.02, D * fz]} />
      ))}
    </>
  )
}

function SceneContent({ preview }: { preview?: { room: Room; items: Item[] } }) {
  const storeRoom = useStore((s) => s.room)
  const storeItems = useActiveItems()
  const room = preview?.room ?? storeRoom
  const items = preview?.items ?? storeItems
  const issues = useMemo(() => fitIssues(room, items), [room, items])
  // Match the app's light or dark theme behind the room.
  const background = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() || '#ebe8e3', [])
  return (
    <>
      <color attach="background" args={[background]} />
      <Lights room={room} />
      <RoomMesh room={room} />
      {items
        .filter((i) => !i.hidden)
        .map((item) => (
          <ItemObject key={item.id} item={item} room={room} hasError={!!issues.get(item.id)?.some((i) => i.severity === 'error')} />
        ))}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        maxPolarAngle={Math.PI / 2 - 0.04}
        minDistance={0.2}
        maxDistance={25}
      />
      <CameraRig room={room} />
      <CutawayUpdater room={room} />
      <SoftShadows size={22} samples={12} focus={0.6} />
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={0.45} distanceFalloff={0.8} intensity={2.4} quality="medium" halfRes color="#1a120c" />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.35} darkness={0.35} />
      </EffectComposer>
    </>
  )
}

/** The 3D view. `preview` shows a given room and items instead of the saved ones (nothing is saved). */
export function Scene({ preview }: { preview?: { room: Room; items: Item[] } } = {}) {
  const select = useStore((s) => s.select)
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.05, far: 100, position: [8, 5, 7] }}
      onCreated={(state) => {
        canvasHandle.current = state.gl.domElement
        exposeForDebugging(state)
      }}
      onPointerMissed={(e) => e.button === 0 && select(null)}
    >
      <SceneContent preview={preview} />
    </Canvas>
  )
}
