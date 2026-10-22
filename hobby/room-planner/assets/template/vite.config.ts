import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

// ROOM_DATA_DIR lets a second copy (e.g. for recording a demo) keep its own saved rooms.
const DATA_DIR = path.resolve(process.env.ROOM_DATA_DIR ?? path.join(__dirname, 'data'))
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json')
const UPLOAD_DIR = path.resolve(__dirname, 'public/uploads')

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

/**
 * Tiny dev-server API so the planner saves to files in data/ instead of only the browser.
 * That way the layout survives browser resets, and Claude can read and edit it directly.
 */
function roomApi(): Plugin {
  // What we last wrote ourselves, so the file watcher can tell our writes from outside edits.
  const lastWritten = new Map<string, string>()

  const write = (file: string, content: string) => {
    lastWritten.set(file, content)
    fs.writeFileSync(file, content)
  }

  return {
    name: 'room-api',
    configureServer(server: ViteDevServer) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })

      server.watcher.add([STATE_FILE, CATALOG_FILE])
      server.watcher.on('change', (file) => {
        if (file !== STATE_FILE && file !== CATALOG_FILE) return
        const content = fs.readFileSync(file, 'utf8')
        if (lastWritten.get(file) === content) return
        server.ws.send({ type: 'custom', event: file === STATE_FILE ? 'room:state-changed' : 'room:catalog-changed' })
      })

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        try {
          // Pictures saved while the server runs: serve them straight away instead of waiting for
          // Vite to notice the new file in public/.
          const media = /^\/(uploads|items)\/([^/]+)$/.exec(url ?? '')
          if (media && req.method === 'GET') {
            const file = path.join(path.resolve(__dirname, 'public', media[1]), path.basename(decodeURIComponent(media[2])))
            const types: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary' }
            const type = types[path.extname(file).toLowerCase()]
            if (type && fs.existsSync(file)) {
              res.setHeader('Content-Type', type)
              res.setHeader('Cache-Control', 'no-cache')
              return fs.createReadStream(file).pipe(res)
            }
          }
          if (url === '/api/state' && req.method === 'GET') {
            // null until the planner has saved something
            if (!fs.existsSync(STATE_FILE)) return send(res, 200, null)
            return send(res, 200, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')))
          }
          if (url === '/api/state' && req.method === 'PUT') {
            const state = JSON.parse(await readBody(req))
            write(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
            return send(res, 200, { ok: true })
          }
          if (url === '/api/catalog' && req.method === 'GET') {
            const items = fs.existsSync(CATALOG_FILE) ? JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')) : []
            return send(res, 200, items)
          }
          if (url === '/api/catalog' && req.method === 'POST') {
            const entry = JSON.parse(await readBody(req))
            const items: { id: string }[] = fs.existsSync(CATALOG_FILE)
              ? JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
              : []
            const next = [...items.filter((i) => i.id !== entry.id), entry]
            write(CATALOG_FILE, JSON.stringify(next, null, 2) + '\n')
            return send(res, 200, next)
          }
          if (url?.startsWith('/api/catalog/') && req.method === 'DELETE') {
            const id = decodeURIComponent(url.slice('/api/catalog/'.length))
            const items: { id: string }[] = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
            const next = items.filter((i) => i.id !== id)
            write(CATALOG_FILE, JSON.stringify(next, null, 2) + '\n')
            return send(res, 200, next)
          }
          if (url === '/api/upload' && req.method === 'POST') {
            const { name, dataUrl } = JSON.parse(await readBody(req)) as { name: string; dataUrl: string }
            const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(dataUrl)
            if (!match) return send(res, 400, { error: 'expected a png, jpg, webp or gif data URL' })
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
            const base = path.parse(name).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image'
            const file = `${base}-${Date.now().toString(36)}.${ext}`
            fs.writeFileSync(path.join(UPLOAD_DIR, file), Buffer.from(match[2], 'base64'))
            return send(res, 200, { url: `/uploads/${file}` })
          }
          // Copies an image from a shop page into public/uploads: shops often block hot-linking,
          // and a local copy can be read pixel by pixel to cut out its background.
          if (url === '/api/fetch-image' && req.method === 'GET') {
            const src = new URL(req.url ?? '', 'http://localhost').searchParams.get('url') ?? ''
            if (!/^https?:\/\//.test(src)) return send(res, 400, { error: 'expected an http(s) image URL' })
            const remote = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0 room-planner' } })
            const type = remote.headers.get('content-type') ?? ''
            const ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : /gif/.test(type) ? 'gif' : /jpe?g/.test(type) ? 'jpg' : ''
            if (!remote.ok) return send(res, 400, { error: `Couldn't download that image (the site answered ${remote.status}). Save it and upload the file instead.` })
            if (!ext) return send(res, 400, { error: "That link is a web page, not a picture. Right-click the product photo and choose “Copy image address”, or paste the page link to Claude." })
            const bytes = Buffer.from(await remote.arrayBuffer())
            if (bytes.length > 15 * 1024 * 1024) return send(res, 400, { error: 'image is larger than 15 MB' })
            const file = `web-${Date.now().toString(36)}.${ext}`
            fs.writeFileSync(path.join(UPLOAD_DIR, file), bytes)
            return send(res, 200, { url: `/uploads/${file}` })
          }
        } catch (err) {
          return send(res, 500, { error: String(err) })
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), roomApi()],
  server: { port: 5178 },
  cacheDir: process.env.ROOM_CACHE_DIR ?? 'node_modules/.vite',
})
