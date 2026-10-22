import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from '../store'

/** Each field records one undo step when you start editing it. */
const begin = (key: string) => useStore.getState().checkpoint(key)

export function Prop({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="prop">
      <div className="prop-label">
        {icon}
        {label}
      </div>
      <div className="prop-value">{children}</div>
    </div>
  )
}

/** A number box that applies as you type, or only on Enter/blur when `lazy`. */
export function Num({
  value,
  onChange,
  undoKey,
  min,
  max,
  step = 1,
  lazy,
  className = 'field',
  title,
}: {
  value: number
  onChange: (v: number) => void
  undoKey: string
  min?: number
  max?: number
  step?: number
  lazy?: boolean
  className?: string
  title?: string
}) {
  const show = (v: number) => String(Math.round(v * 10) / 10)
  const [draft, setDraft] = useState(show(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setDraft(show(value))
  }, [value, focused])
  const valid = (n: number) => Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)
  return (
    <input
      className={className}
      type="number"
      inputMode="decimal"
      title={title}
      value={draft}
      min={min}
      max={max}
      step={step}
      onFocus={(e) => {
        setFocused(true)
        begin(undoKey)
        e.target.select()
      }}
      onBlur={() => {
        setFocused(false)
        const n = parseFloat(draft)
        if (lazy && valid(n) && n !== value) onChange(n)
        else setDraft(show(value))
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = parseFloat(e.target.value)
        if (!lazy && valid(n)) onChange(n)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/** Width × depth × height in one compact row, with tiny labels above. */
export function Dims({ values, labels, onChange, undoKey }: { values: number[]; labels: string[]; onChange: (i: number, v: number) => void; undoKey: string }) {
  return (
    <div className="dims dims-wrap">
      {values.map((v, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span>×</span>}
          <label>
            <span className="tag">{labels[i]}</span>
            <Num value={v} min={0.5} onChange={(n) => onChange(i, n)} undoKey={`${undoKey}:${i}`} className="" title={labels[i]} />
          </label>
        </span>
      ))}
      <span style={{ marginLeft: 4 }}>cm</span>
    </div>
  )
}

export function Text({ value, onChange, undoKey, placeholder, multiline, className = 'ghost-input' }: { value: string; onChange: (v: string) => void; undoKey: string; placeholder?: string; multiline?: boolean; className?: string }) {
  if (multiline)
    return (
      <textarea
        className={className}
        rows={Math.max(1, value.split('\n').length)}
        value={value}
        placeholder={placeholder}
        onFocus={() => begin(undoKey)}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  return <input className={className} value={value} placeholder={placeholder} onFocus={() => begin(undoKey)} onChange={(e) => onChange(e.target.value)} />
}

export function Swatch({ value, onChange, undoKey }: { value: string; onChange: (v: string) => void; undoKey: string }) {
  return (
    <label className="swatch" onMouseDown={() => begin(undoKey)}>
      <span className="chip" style={{ background: value }} />
      {value}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
