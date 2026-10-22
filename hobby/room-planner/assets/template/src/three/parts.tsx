import { useTexture } from '@react-three/drei'
import { Component, Suspense, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { boxGeometry, cachedGeometry, material, type MatKind } from './materials'
import { placeholderArt } from './textures'

// Building blocks for the furniture models. Units are metres.

export type V3 = [number, number, number]

interface Placed {
  pos?: V3
  rot?: V3
  scale?: V3 | number
}

/** A box, optionally with rounded edges, in a real material. */
export function Part({ size, radius = 0, mat, color, pos, rot, scale, shadow = true }: Placed & { size: V3; radius?: number; mat: MatKind; color: string; shadow?: boolean }) {
  const [w, h, d] = size.map((v) => Math.max(v, 0.001)) as V3
  return <mesh geometry={boxGeometry(w, h, d, radius)} material={material(mat, color)} position={pos} rotation={rot} scale={scale} castShadow={shadow} receiveShadow />
}

/** Any prepared geometry in a real material. */
export function Shape({ geometry, mat, color, pos, rot, scale, shadow = true }: Placed & { geometry: THREE.BufferGeometry; mat: MatKind; color: string; shadow?: boolean }) {
  return <mesh geometry={geometry} material={material(mat, color)} position={pos} rotation={rot} scale={scale} castShadow={shadow} receiveShadow />
}

/** A cylinder standing on y, optionally tapering from r (bottom) to r2 (top). */
export function Cyl({ r, r2, h, mat, color, pos, rot, segments = 20 }: Placed & { r: number; r2?: number; h: number; mat: MatKind; color: string; segments?: number }) {
  const geo = cachedGeometry(`cyl:${(r2 ?? r).toFixed(4)}:${r.toFixed(4)}:${h.toFixed(4)}:${segments}`, () => new THREE.CylinderGeometry(r2 ?? r, r, h, segments))
  return <mesh geometry={geo} material={material(mat, color)} position={pos} rotation={rot} castShadow receiveShadow />
}

export function Ball({ r, mat, color, pos, scale }: Placed & { r: number; mat: MatKind; color: string }) {
  const geo = cachedGeometry(`ball:${r.toFixed(4)}`, () => new THREE.SphereGeometry(r, 20, 14))
  return <mesh geometry={geo} material={material(mat, color)} position={pos} scale={scale} castShadow receiveShadow />
}

const UP = new THREE.Vector3(0, 1, 0)

/** A rod between two points, optionally tapering from r at `from` to r2 at `to`. */
export function Rod({ from, to, r, r2, mat, color }: { from: V3; to: V3; r: number; r2?: number; mat: MatKind; color: string }) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const dir = b.clone().sub(a)
  const len = dir.length()
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())
  const geo = cachedGeometry(`rod:${r.toFixed(4)}:${(r2 ?? r).toFixed(4)}:${len.toFixed(4)}`, () => new THREE.CylinderGeometry(r2 ?? r, r, len, 12))
  return <mesh geometry={geo} material={material(mat, color)} position={a.add(b).multiplyScalar(0.5)} quaternion={quat} castShadow receiveShadow />
}

export function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function TexturedPlane({ url, w, h, fit, clip }: { url: string; w: number; h: number; fit: 'cover' | 'stretch'; clip?: 'ellipse' }) {
  const tex = useTexture(url)
  const map = useMemo(() => {
    const t = tex.clone()
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    // "cover": crop the picture to the frame's proportions instead of squashing it.
    const img = tex.image as { width?: number; height?: number } | undefined
    if (fit === 'cover' && img?.width && img?.height) {
      const imgAspect = img.width / img.height
      const frameAspect = w / h
      if (imgAspect > frameAspect) {
        t.repeat.set(frameAspect / imgAspect, 1)
        t.offset.set((1 - t.repeat.x) / 2, 0)
      } else {
        t.repeat.set(1, imgAspect / frameAspect)
        t.offset.set(0, (1 - t.repeat.y) / 2)
      }
    }
    t.needsUpdate = true
    return t
  }, [tex, w, h, fit])
  const geometry = useMemo(
    () => (clip === 'ellipse' ? cachedGeometry(`art-ellipse:${w}:${h}`, () => new THREE.CircleGeometry(0.5, 72).scale(w, h, 1)) : null),
    [clip, w, h],
  )
  if (geometry)
    return (
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial map={map} roughness={0.85} />
      </mesh>
    )
  return (
    <mesh receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={map} roughness={0.75} />
    </mesh>
  )
}

/** A picture on a flat face: placeholder art while loading, or if the image can't be loaded. */
export function Art({ url, label, w, h, pos, rot, fit = 'cover', clip }: Placed & { url?: string; label: string; w: number; h: number; fit?: 'cover' | 'stretch'; clip?: 'ellipse' }) {
  const placeholder = (
    <mesh>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={placeholderArt(label)} roughness={0.8} />
    </mesh>
  )
  return (
    <group position={pos} rotation={rot}>
      {url ? (
        <Fallback key={url} fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <TexturedPlane url={url} w={w} h={h} fit={fit} clip={clip} />
          </Suspense>
        </Fallback>
      ) : (
        placeholder
      )}
    </group>
  )
}

export function rng(seedText: string) {
  let s = 0
  for (const ch of seedText) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
