import { Repeat2, RotateCw, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Item } from '../types'
import { remove, rotateBy, startSwap, undo } from './actions'
import { useUi } from './uiStore'

/** Small toolbar above the selected thing in the 3D view. */
export function ItemBar({ item, hasError }: { item: Item; hasError: boolean }) {
  const wall = item.place.type === 'wall'
  return (
    <div className="item-bar" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <span className="name">
        {item.name}
        <small className={hasError ? 'bad' : ''}>{hasError ? "doesn't fit here" : `${item.size.w} × ${wall ? item.size.h : item.size.d} cm`}</small>
      </span>
      <span className="sep" />
      {!wall && (
        <button className="icon-btn" title="Turn" disabled={item.locked} onClick={() => rotateBy(item, 90)}>
          <RotateCw size={16} />
        </button>
      )}
      <button className="icon-btn" title="Find something to replace it" onClick={() => startSwap(item)}>
        <Repeat2 size={16} />
      </button>
      <button className="icon-btn danger" title="Remove" onClick={() => remove(item)}>
        <Trash2 size={16} />
      </button>
    </div>
  )
}

export function Toast() {
  const toast = useUi((s) => s.toast)
  const dismiss = useUi((s) => s.dismissToast)
  if (!toast) return null
  return (
    <div className="toast" key={toast.id} role="status">
      {toast.text}
      {toast.undo && <button onClick={undo}>Undo</button>}
      <button onClick={dismiss} aria-label="Dismiss" style={{ color: '#9a9aa2' }}>
        <X size={14} />
      </button>
    </div>
  )
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el?.closest?.('textarea, select, [contenteditable], input:not([type=checkbox]):not([type=color]):not([type=file])')
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

/** Drop or paste a picture anywhere to start adding it. */
export function DropAndPaste() {
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/uri-list')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e) || useUi.getState().add.open) return
      depth++
      setDragging(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e) && !useUi.getState().add.open) e.preventDefault()
    }
    const drop = async (e: DragEvent) => {
      depth = 0
      setDragging(false)
      if (useUi.getState().add.open || !e.dataTransfer) return
      e.preventDefault()
      const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))
      if (file) return useUi.getState().openAdd({ photo: await readAsDataUrl(file) })
      const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
      if (/^https?:\/\//.test(url.trim())) useUi.getState().openAdd({ photo: url.trim() })
    }
    const paste = async (e: ClipboardEvent) => {
      if (isTyping(e.target) || !e.clipboardData) return
      const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
      if (file) {
        e.preventDefault()
        return useUi.getState().openAdd({ photo: await readAsDataUrl(file) })
      }
      const text = e.clipboardData.getData('text/plain').trim()
      if (/^https?:\/\/\S+$/.test(text)) {
        e.preventDefault()
        useUi.getState().openAdd({ photo: text })
      }
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    window.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
      window.removeEventListener('paste', paste)
    }
  }, [])
  return dragging ? <div className="drop-veil">Drop the picture to add it to the room</div> : null
}

export { isTyping }
