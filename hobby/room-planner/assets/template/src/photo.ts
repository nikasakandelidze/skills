// Turning a product photo into something you can place in the room.

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Couldn't load that image"))
    img.src = src
  })
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export interface Cutout {
  /** PNG data URL, trimmed to the object. */
  src: string
  width: number
  height: number
  /** Whether a plain background was found and removed. */
  removed: boolean
  /** Average colour of the object, for the floor plan. */
  color: string
}

/**
 * Removes a plain studio background (the white or grey most shop photos use) by flood-filling
 * inwards from the edges, then trims to the object. Photos without a plain background come back
 * unchanged, so posters and room shots keep their edges.
 */
export async function cutOut(src: string, removeBackground = true): Promise<Cutout> {
  const img = await loadImage(src)
  const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data

  // What does the border look like?
  const border: number[] = []
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1)
  let r = 0
  let g = 0
  let b = 0
  for (const i of border) {
    r += px[i * 4]
    g += px[i * 4 + 1]
    b += px[i * 4 + 2]
  }
  r /= border.length
  g /= border.length
  b /= border.length
  let spread = 0
  for (const i of border) spread += Math.hypot(px[i * 4] - r, px[i * 4 + 1] - g, px[i * 4 + 2] - b)
  spread /= border.length
  const transparentAlready = border.filter((i) => px[i * 4 + 3] < 20).length > border.length * 0.6
  const plain = !transparentAlready && spread < 22 && removeBackground

  if (plain) {
    const tol = 40
    const dist = (i: number) => Math.hypot(px[i * 4] - r, px[i * 4 + 1] - g, px[i * 4 + 2] - b)
    const seen = new Uint8Array(w * h)
    const queue = new Int32Array(w * h)
    let head = 0
    let tail = 0
    for (const i of border) {
      if (!seen[i] && dist(i) < tol) {
        seen[i] = 1
        queue[tail++] = i
      }
    }
    while (head < tail) {
      const i = queue[head++]
      const x = i % w
      const y = (i / w) | 0
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (n < 0 || seen[n]) continue
        if (dist(n) < tol) {
          seen[n] = 1
          queue[tail++] = n
        }
      }
    }
    for (let i = 0; i < w * h; i++) {
      if (seen[i]) {
        px[i * 4 + 3] = 0
        continue
      }
      // Feather pixels that touch the removed background.
      const x = i % w
      const y = (i / w) | 0
      const edge = (x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (y > 0 && seen[i - w]) || (y < h - 1 && seen[i + w])
      if (edge) px[i * 4 + 3] = Math.min(px[i * 4 + 3], 140)
    }
    ctx.putImageData(data, 0, 0)
  }

  // Trim to the visible object.
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  let cr = 0
  let cg = 0
  let cb = 0
  let n = 0
  for (let i = 0; i < w * h; i += 7) {
    if (px[i * 4 + 3] > 200) {
      cr += px[i * 4]
      cg += px[i * 4 + 1]
      cb += px[i * 4 + 2]
      n++
    }
  }
  const hex = (v: number) => Math.round(v / (n || 1)).toString(16).padStart(2, '0')
  const color = n ? `#${hex(cr)}${hex(cg)}${hex(cb)}` : '#9a9a9a'
  if (maxX < minX) return { src, width: w, height: h, removed: false, color }
  const tw = maxX - minX + 1
  const th = maxY - minY + 1
  const out = document.createElement('canvas')
  out.width = tw
  out.height = th
  out.getContext('2d')!.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th)
  return { src: out.toDataURL('image/png'), width: tw, height: th, removed: plain, color }
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, body] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png'
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return new File([bytes], name, { type: mime })
}

/** Gets a pasted image link into the app: through the dev server (avoids hot-link blocking), else directly. */
export async function importImageUrl(url: string): Promise<string> {
  try {
    const res = await fetch(`/api/fetch-image?url=${encodeURIComponent(url)}`)
    const body = (await res.json()) as { url?: string; error?: string }
    if (res.ok && body.url) return body.url
    if (body.error) throw new Error(body.error)
  } catch (err) {
    if (err instanceof Error && !/fetch|JSON/i.test(err.message)) throw err
  }
  return url
}
