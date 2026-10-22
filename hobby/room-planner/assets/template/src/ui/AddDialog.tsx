import { Image as ImageIcon, Link2, Loader2, Lock, LockOpen, Plus, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { addToCatalog, uploadImage } from '../persist'
import { cutOut, dataUrlToFile, importImageUrl, readFile, type Cutout } from '../photo'
import { newId } from '../placement'
import { CURRENCY } from '../shop'
import type { CatalogEntry } from '../types'
import { place } from './actions'
import { useUi } from './uiStore'

type Spot = 'floor' | 'wall'

function UnitInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="unit-field">
      <div className="form-label">{label}</div>
      <input className="field" type="number" min={1} value={value} onFocus={(e) => e.target.select()} onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))} />
      <span>cm</span>
    </div>
  )
}

/** Drop a photo of a product (or a poster) and place it at its real size. */
function PhotoForm({ initial, onDone }: { initial: string | null; onDone: () => void }) {
  const [source, setSource] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [url, setUrl] = useState('')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cut, setCut] = useState<Cutout | null>(null)
  const [removeBg, setRemoveBg] = useState(true)
  const [spot, setSpot] = useState<Spot>('floor')
  const [name, setName] = useState('')
  const [size, setSize] = useState({ w: 60, d: 50, h: 80 })
  const [locked, setLocked] = useState(true)
  const [link, setLink] = useState('')
  const [price, setPrice] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const process = async (src: string, remove: boolean, fresh: boolean) => {
    setBusy(true)
    setError('')
    try {
      const result = await cutOut(src, remove)
      setCut(result)
      const aspect = result.width / result.height
      if (fresh) {
        const s: Spot = result.removed ? 'floor' : 'wall'
        setSpot(s)
        setSize(s === 'wall' ? { w: 50, d: 3, h: Math.round(50 / aspect) } : { w: Math.round(80 * aspect), d: Math.round(80 * aspect * 0.85), h: 80 })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setCut(null)
    } finally {
      setBusy(false)
    }
  }

  const load = async (src: string, label: string) => {
    setBusy(true)
    setError('')
    try {
      const local = /^https?:/.test(src) ? await importImageUrl(src) : src
      setSource(local)
      setFileName(label)
      setName(label)
      setRemoveBg(true)
      await process(local, true, true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const fromFile = async (f: File) => load(await readFile(f), f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'New thing')

  useEffect(() => {
    if (initial) void load(initial, 'New thing')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  const aspect = cut ? cut.width / cut.height : 1
  const setDim = (dim: 'w' | 'd' | 'h', v: number) =>
    setSize((s) => {
      const next = { ...s, [dim]: v }
      if (locked && dim === 'w') next.h = Math.max(1, Math.round(v / aspect))
      if (locked && dim === 'h') next.w = Math.max(1, Math.round(v * aspect))
      return next
    })

  const add = async () => {
    if (!cut || !source) return
    setBusy(true)
    try {
      const image = cut.removed ? await uploadImage(dataUrlToFile(cut.src, `${name || 'item'}.png`)) : source.startsWith('data:') ? await uploadImage(dataUrlToFile(source, fileName || 'image.png')) : source
      const entry: CatalogEntry = {
        id: newId(name || 'item'),
        name: name || 'New thing',
        shape: spot === 'wall' ? 'poster' : 'cutout',
        size: spot === 'wall' ? { w: size.w, d: 3, h: size.h } : size,
        color: spot === 'wall' ? '#1c1c1c' : cut.color,
        image,
        photo: image,
        frame: spot === 'wall' ? (cut.removed ? 0 : 2) : undefined,
        link: link || undefined,
        price: price || undefined,
      }
      // Keep it in "My finds" so it can be tried in other ideas too.
      await addToCatalog(entry)
      place(entry)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  if (!source)
    return (
      <div>
        <div
          className={`dropzone${over ? ' over' : ''}`}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f) void fromFile(f)
            else {
              const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
              if (u) void load(u.trim(), 'New thing')
            }
          }}
        >
          {busy ? <Loader2 size={24} className="spin" /> : <ImageIcon size={28} />}
          <div className="big">Drop a photo here</div>
          <div>A shop photo of a chair, lamp, plant… or a poster. White backgrounds are removed for you.</div>
          <button className="btn" onClick={() => file.current?.click()}>
            <Upload size={15} /> Choose a photo
          </button>
        </div>
        <div className="url-row">
          <input className="field" placeholder="…or paste the picture's link (right-click the photo → Copy image address)" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && url && void load(url.trim(), 'New thing')} />
          <button className="btn" disabled={!url || busy} onClick={() => load(url.trim(), 'New thing')}>
            <Link2 size={15} /> Use it
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void fromFile(f)
          }}
        />
      </div>
    )

  return (
    <div className="photo-layout">
      <div>
        <div className="photo-preview">
          {cut && <img src={cut.src} alt="" />}
          {busy && (
            <div className="busy">
              <Loader2 size={22} className="spin" />
            </div>
          )}
        </div>
        <label className="check" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={removeBg}
            onChange={(e) => {
              setRemoveBg(e.target.checked)
              void process(source, e.target.checked, false)
            }}
          />
          Remove the white background
        </label>
        <button className="btn ghost" style={{ marginTop: 6 }} onClick={() => (setSource(null), setCut(null))}>
          Use a different photo
        </button>
      </div>
      <div className="form-grid">
        <div>
          <div className="form-label">What is it?</div>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Green armchair" />
        </div>
        <div>
          <div className="form-label">Where does it go?</div>
          <div className="seg">
            <button className={spot === 'floor' ? 'on' : ''} onClick={() => (setSpot('floor'), setSize((s) => ({ w: s.w, d: Math.max(s.d, Math.round(s.w * 0.8)), h: s.h })))}>
              On the floor
            </button>
            <button className={spot === 'wall' ? 'on' : ''} onClick={() => setSpot('wall')}>
              On a wall
            </button>
          </div>
        </div>
        <div>
          <div className="form-label">Its real size (from the shop page)</div>
          <div style={{ display: 'grid', gridTemplateColumns: spot === 'wall' ? '1fr 1fr auto' : '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <UnitInput label="Width" value={size.w} onChange={(v) => setDim('w', v)} />
            {spot === 'floor' && <UnitInput label="Depth" value={size.d} onChange={(v) => setDim('d', v)} />}
            <UnitInput label="Height" value={size.h} onChange={(v) => setDim('h', v)} />
            <button className="icon-btn" title={locked ? 'Width and height keep the photo’s shape' : 'Shape unlocked'} onClick={() => setLocked(!locked)}>
              {locked ? <Lock size={15} /> : <LockOpen size={15} />}
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
          <div>
            <div className="form-label">Shop link (optional)</div>
            <input className="field" value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
          <div>
            <div className="form-label">Price (optional)</div>
            <input className="field" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={CURRENCY} />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div>
          <button className="btn primary" disabled={!cut || busy} onClick={add}>
            <Plus size={16} /> Put it in my room
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddDialog() {
  const add = useUi((s) => s.add)
  const close = useUi((s) => s.closeAdd)

  useEffect(() => {
    if (!add.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [add.open, close])

  if (!add.open) return null
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog" role="dialog" aria-label="Add from a photo">
        <div className="dialog-head">
          <h2>Add something from a photo</h2>
          <button className="icon-btn" onClick={close} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="dialog-body">
          <PhotoForm key={add.photo ?? 'empty'} initial={add.photo} onDone={close} />
        </div>
      </div>
    </div>
  )
}
