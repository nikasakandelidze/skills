import shopData from '../data/shop.json'
import { CURRENT_VARIANT_ID } from './defaultState'
import { activeItems, useStore } from './store'
import type { CatalogEntry, Category, Item } from './types'
import { useUi } from './ui/uiStore'

/** Real products from local shops, collected into data/shop.json by scripts/shop/build_shop.py. */
export const SHOP: CatalogEntry[] = shopData as CatalogEntry[]

export const CATEGORIES: { id: Category; label: string; one: string }[] = [
  { id: 'bed', label: 'Beds', one: 'bed' },
  { id: 'sofa', label: 'Sofas', one: 'sofa' },
  { id: 'armchair', label: 'Armchairs', one: 'armchair' },
  { id: 'desk', label: 'Desks', one: 'desk' },
  { id: 'officeChair', label: 'Desk chairs', one: 'desk chair' },
  { id: 'bookshelf', label: 'Shelving', one: 'shelf' },
  { id: 'floorLamp', label: 'Lamps', one: 'lamp' },
  { id: 'rug', label: 'Rugs', one: 'rug' },
  { id: 'curtain', label: 'Curtains', one: 'curtain' },
  { id: 'wallArt', label: 'Wall art', one: 'picture' },
  { id: 'mirror', label: 'Mirrors', one: 'mirror' },
  { id: 'plant', label: 'Plants', one: 'plant' },
  { id: 'nightstand', label: 'Bedside tables', one: 'bedside table' },
  { id: 'dresser', label: 'Drawers', one: 'chest of drawers' },
  { id: 'wardrobe', label: 'Wardrobes', one: 'wardrobe' },
  { id: 'sideTable', label: 'Tables', one: 'table' },
  { id: 'wallShelf', label: 'Wall shelves', one: 'wall shelf' },
]

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)

/** Which shop category a thing in the room belongs to, so we know what a product would replace. */
export function categoryOf(thing: Pick<Item, 'shape' | 'size'> & { category?: Category }): Category | null {
  if (thing.category) return thing.category
  switch (thing.shape) {
    case 'bed':
      return 'bed'
    case 'sofa':
      return thing.size.w < 115 ? 'armchair' : 'sofa'
    case 'officeChair':
      return 'officeChair'
    case 'desk':
      return 'desk'
    case 'bookshelf':
      return 'bookshelf'
    case 'floorLamp':
      return 'floorLamp'
    case 'rug':
      return 'rug'
    case 'curtain':
      return 'curtain'
    case 'poster':
      return 'wallArt'
    case 'mirror':
      return 'mirror'
    case 'plant':
      return 'plant'
    case 'table':
      return 'sideTable'
    case 'wallShelf':
      return 'wallShelf'
    case 'box':
      return thing.size.h > 150 ? 'wardrobe' : thing.size.w > 70 ? 'dresser' : 'nightstand'
    default:
      return null
  }
}

/** The currency symbol the shop's prices use, e.g. "₾", "€", "$". */
export const CURRENCY = SHOP.find((p) => p.price)?.price?.replace(/[\d\s.,]/g, '').trim() ?? ''

/** "1 399.00 ₾" → 1399 */
export function priceValue(price?: string) {
  if (!price) return 0
  const n = parseFloat(price.replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function formatGel(value: number) {
  const amount = value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return CURRENCY ? `${amount} ${CURRENCY}` : amount
}

/** The thing in the room a product would take the place of (same category), if any. */
export function itemToReplace(entry: CatalogEntry): Item | undefined {
  const cat = entry.category ?? categoryOf(entry)
  if (!cat) return undefined
  const s = useStore.getState()
  const items = activeItems(s).filter((i) => !i.hidden && !i.fixture && categoryOf(i) === cat)
  const selected = items.find((i) => i.id === s.selectedId)
  return selected ?? items[0]
}

/** Makes sure changes go into an idea, never straight into the real room. */
export function ensureIdea(label: string) {
  const s = useStore.getState()
  if (s.activeVariantId !== CURRENT_VARIANT_ID) return
  s.addVariant()
  const fresh = useStore.getState()
  fresh.renameVariant(fresh.activeVariantId, label)
  useUi.getState().notify('Started a new idea, so your room as it is now stays safe')
}

export function tryProduct(entry: CatalogEntry, mode: 'replace' | 'add') {
  const old = mode === 'replace' ? itemToReplace(entry) : undefined
  ensureIdea(old ? `New ${categoryLabel(entry.category!)?.one ?? 'look'}` : 'New things')
  const s = useStore.getState()
  if (old && s.swapWith(old.id, entry)) {
    useUi.getState().notify(`Swapped your ${old.name.toLowerCase()} for ${entry.name}`, true)
    return
  }
  s.addFrom(entry)
  useUi.getState().notify(`Added ${entry.name}`, true)
}

/** Things from shops in this idea and what they'd cost together. */
export function shoppingList(items: Item[]) {
  const bought = items.filter((i) => !i.hidden && i.store && i.price)
  return { items: bought, total: bought.reduce((sum, i) => sum + priceValue(i.price), 0) }
}
