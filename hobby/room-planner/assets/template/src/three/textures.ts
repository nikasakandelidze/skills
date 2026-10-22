import * as THREE from 'three'

const placeholderCache = new Map<string, THREE.CanvasTexture>()

/** Stand-in art for a poster with no image yet. */
export function placeholderArt(label: string) {
  const cached = placeholderCache.get(label)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 340
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f1efe9'
  ctx.fillRect(0, 0, 256, 340)
  ctx.strokeStyle = '#c9c4b8'
  ctx.lineWidth = 3
  ctx.strokeRect(24, 24, 208, 292)
  ctx.beginPath()
  ctx.moveTo(24, 24)
  ctx.lineTo(232, 316)
  ctx.moveTo(232, 24)
  ctx.lineTo(24, 316)
  ctx.stroke()
  ctx.fillStyle = '#8a8478'
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label.slice(0, 18), 128, 178)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  placeholderCache.set(label, tex)
  return tex
}
