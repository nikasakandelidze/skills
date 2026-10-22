import { ArrowLeft, Check, ExternalLink, ImagePlus, Plus, Repeat2, Search, ShoppingBag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORIES, categoryLabel, categoryOf, itemToReplace, SHOP, shoppingList, formatGel, tryProduct } from '../shop'
import { isWallShape } from '../shapes'
import { useActiveItems, useStore } from '../store'
import type { CatalogEntry } from '../types'
import { useUi } from './uiStore'

const sizeText = (e: CatalogEntry) => (isWallShape(e.shape) ? `${e.size.w} × ${e.size.h} cm` : `${e.size.w} × ${e.size.d} cm · ${e.size.h} cm high`)

function useInRoom() {
  const items = useActiveItems()
  return useMemo(() => new Set(items.filter((i) => !i.hidden && i.catalogId).map((i) => i.catalogId!)), [items])
}

function ProductCard({ p, inRoom }: { p: CatalogEntry; inRoom: boolean }) {
  const open = useUi((s) => s.openProduct)
  return (
    <button className="card" onClick={() => open(p.id)}>
      <div className="card-photo">
        {p.photo || p.image ? <img src={p.photo ?? p.image} alt="" loading="lazy" /> : null}
        {p.store && <span className="badge">{p.store}</span>}
        {inRoom && (
          <span className="badge in-room">
            <Check size={12} /> In room
          </span>
        )}
      </div>
      <div className="card-body">
        <span className="card-name">{p.name}</span>
        {p.price && (
          <span className="price">
            {p.price}
            {p.oldPrice && <s>{p.oldPrice}</s>}
          </span>
        )}
        <span className="card-size">{sizeText(p)}</span>
      </div>
    </button>
  )
}

function ProductSheet({ p, inRoom }: { p: CatalogEntry; inRoom: boolean }) {
  const open = useUi((s) => s.openProduct)
  const photos = [p.photo, ...(p.photos ?? [])].filter((x): x is string => !!x)
  const [shown, setShown] = useState(photos[0] ?? p.image)
  const replace = itemToReplace(p)
  const cat = p.category ? categoryLabel(p.category) : undefined
  return (
    <div>
      <button className="sheet-back" onClick={() => open(null)}>
        <ArrowLeft size={15} /> {cat?.label ?? 'Shop'}
      </button>
      <div className="sheet-photo">{shown && <img src={shown} alt="" />}</div>
      {photos.length > 1 && (
        <div className="thumbs">
          {photos.map((src) => (
            <button key={src} className={src === shown ? 'on' : ''} onClick={() => setShown(src)}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
      <h2 className="sheet-title">{p.name}</h2>
      <div className="sheet-meta">
        {p.price && (
          <span className="price" style={{ color: 'var(--text)', fontSize: 16 }}>
            {p.price}
            {p.oldPrice && <s>{p.oldPrice}</s>}
          </span>
        )}
        {p.oldPrice && <span className="badge sale">On sale</span>}
        {p.store && <span className="badge">{p.store}</span>}
      </div>
      <dl className="facts">
        <dt>Size</dt>
        <dd>{sizeText(p)}</dd>
        {p.colorName && (
          <>
            <dt>Colour</dt>
            <dd>{p.colorName}</dd>
          </>
        )}
        {p.notes && (
          <>
            <dt>Notes</dt>
            <dd>{p.notes}</dd>
          </>
        )}
      </dl>
      <div className="sheet-actions">
        {replace ? (
          <>
            <button className="btn primary big" onClick={() => tryProduct(p, 'replace')}>
              <Repeat2 size={16} /> Try it instead of your {cat?.one ?? 'current one'}
            </button>
            <button className="btn ghost" onClick={() => tryProduct(p, 'add')}>
              <Plus size={16} /> Add it as an extra
            </button>
          </>
        ) : (
          <button className="btn primary big" onClick={() => tryProduct(p, 'add')}>
            <Plus size={16} /> Try it in my room
          </button>
        )}
        {inRoom && <div className="callout ok">It's in your room now. Drag it to find the right spot.</div>}
        {p.link && (
          <a className="sheet-link" href={p.link} target="_blank" rel="noreferrer">
            Open on the {p.store ?? 'shop'} website <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  )
}

export function ShopPanel() {
  const ui = useUi()
  const finds = useStore((s) => s.catalog)
  const inRoom = useInRoom()
  const all = useMemo(() => [...SHOP, ...finds.map((f) => ({ ...f, category: f.category ?? categoryOf(f) ?? undefined }))], [finds])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of SHOP) if (p.category) m.set(p.category, (m.get(p.category) ?? 0) + 1)
    return m
  }, [])

  const product = ui.productId ? all.find((p) => p.id === ui.productId) : undefined
  const q = ui.shopQuery.trim().toLowerCase()
  const list = (ui.shopFilter === 'finds' ? finds : ui.shopFilter === 'all' ? SHOP : SHOP.filter((p) => p.category === ui.shopFilter)).filter(
    (p) => !q || `${p.name} ${p.colorName ?? ''} ${p.store ?? ''} ${categoryLabel(p.category!)?.label ?? ''}`.toLowerCase().includes(q),
  )

  return (
    <aside className="catalog">
      {product ? (
        <div className="catalog-body">
          <ProductSheet key={product.id} p={product} inRoom={inRoom.has(product.id)} />
        </div>
      ) : (
        <>
          <div className="catalog-head">
            <div className="search">
              <Search size={16} />
              <input className="field" placeholder="Search the shop" value={ui.shopQuery} onChange={(e) => ui.setQuery(e.target.value)} />
            </div>
            <div className="chip-row">
              <button className={`chip${ui.shopFilter === 'all' ? ' on' : ''}`} onClick={() => ui.browse('all')}>
                All
              </button>
              {CATEGORIES.filter((c) => counts.get(c.id)).map((c) => (
                <button key={c.id} className={`chip${ui.shopFilter === c.id ? ' on' : ''}`} onClick={() => ui.browse(c.id)}>
                  {c.label}
                </button>
              ))}
              {finds.length > 0 && (
                <button className={`chip${ui.shopFilter === 'finds' ? ' on' : ''}`} onClick={() => ui.browse('finds')}>
                  My finds
                </button>
              )}
            </div>
          </div>
          <div className="catalog-body">
            {list.length === 0 ? (
              <div className="empty-state">
                <b>Nothing here</b>
                {q ? 'Try a different word.' : 'Ask Claude to add products from a shop link.'}
              </div>
            ) : (
              <div className="grid">
                {list.map((p) => (
                  <ProductCard key={p.id} p={p} inRoom={inRoom.has(p.id)} />
                ))}
              </div>
            )}
            <button className="btn ghost wide" style={{ marginTop: 14 }} onClick={() => ui.openAdd()}>
              <ImagePlus size={16} /> Found it somewhere else? Add it from a photo
            </button>
          </div>
        </>
      )}
      <ShoppingSummary />
    </aside>
  )
}

/** "This idea: 3 new things · 2 450 ₾" */
export function ShoppingSummary() {
  const items = useActiveItems()
  const { items: bought, total } = useMemo(() => shoppingList(items), [items])
  const [open, setOpen] = useState(false)
  const select = useStore((s) => s.select)
  if (!bought.length) return null
  return (
    <div className="catalog-foot">
      <button className="cost-bar" onClick={() => setOpen(!open)}>
        <ShoppingBag size={16} className="muted" />
        <span className="grow">
          Trying {bought.length} new thing{bought.length > 1 ? 's' : ''}
        </span>
        <b>{formatGel(total)}</b>
      </button>
      {open && (
        <div className="row-list" style={{ marginTop: 6 }}>
          {bought.map((i) => (
            <div key={i.id} className="row" role="button" tabIndex={0} onClick={() => select(i.id)}>
              <span className="thumb">{i.photo ? <img src={i.photo} alt="" /> : null}</span>
              <span className="label">{i.name}</span>
              <span className="meta">{i.price}</span>
              {i.link && (
                <a className="icon-btn" href={i.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Open in shop">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
