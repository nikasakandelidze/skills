import type { CatalogEntry, Shape, WallShape } from './types'

const WALL_SHAPES: WallShape[] = ['poster', 'ac', 'whiteboard', 'curtain', 'radiator', 'wallShelf', 'mirror']

export function isWallShape(shape: Shape): shape is WallShape {
  return (WALL_SHAPES as Shape[]).includes(shape)
}

export const SHAPE_LABELS: Record<Shape, string> = {
  bed: 'Bed',
  desk: 'Desk',
  officeChair: 'Office chair',
  chair: 'Chair',
  sofa: 'Sofa / armchair',
  bookshelf: 'Bookshelf',
  floorLamp: 'Floor lamp',
  tripod: 'Tripod',
  lightStand: 'Light stand',
  foldingChair: 'Folding chair',
  table: 'Table',
  box: 'Box (any object)',
  rug: 'Rug',
  plant: 'Plant',
  cutout: 'Photo cutout',
  poster: 'Poster / frame',
  ac: 'Air conditioner',
  whiteboard: 'Whiteboard',
  curtain: 'Curtain',
  radiator: 'Radiator',
  wallShelf: 'Wall shelf',
  mirror: 'Mirror',
}

/** What the secondary colour means for shapes that use one. */
export const COLOR2_LABELS: Partial<Record<Shape, string>> = {
  bed: 'Bedding',
  officeChair: 'Base',
  foldingChair: 'Legs',
  lightStand: 'Light panel',
  plant: 'Pot',
  chair: 'Legs',
  table: 'Legs',
  desk: 'Legs',
}

/** What the 3D models fall back to when an item has no secondary colour set. */
export const COLOR2_DEFAULTS: Partial<Record<Shape, string>> = {
  bed: '#e9edf2',
  officeChair: '#bdbdbd',
  foldingChair: '#9a9a9a',
  lightStand: '#2b2b2b',
  plant: '#c06a45',
  chair: '#b8875a',
  table: '#b8875a',
  desk: '#2a2a2a',
}

/** Items that don't block anything: you can walk on a rug, curtains hang in front of things. */
export function isSoft(shape: Shape) {
  return shape === 'rug' || shape === 'curtain'
}

export type Template = Omit<CatalogEntry, 'id'> & { group: string }

/** Generic starting points for trying something new. Set real dimensions after placing. */
export const TEMPLATES: Template[] = [
  { group: 'Wall', name: 'Poster 50×70', shape: 'poster', size: { w: 50, d: 3, h: 70 }, color: '#1c1c1c', frame: 2 },
  { group: 'Wall', name: 'Poster 30×40', shape: 'poster', size: { w: 30, d: 3, h: 40 }, color: '#1c1c1c', frame: 2 },
  { group: 'Wall', name: 'Poster 70×100', shape: 'poster', size: { w: 70, d: 3, h: 100 }, color: '#1c1c1c', frame: 2 },
  { group: 'Wall', name: 'Wall shelf', shape: 'wallShelf', size: { w: 80, d: 20, h: 3 }, color: '#3b2a22' },
  { group: 'Wall', name: 'Mirror', shape: 'mirror', size: { w: 50, d: 3, h: 150 }, color: '#2a2a2a' },
  { group: 'Wall', name: 'Curtain', shape: 'curtain', size: { w: 140, d: 12, h: 250 }, color: '#d8d2c4' },
  { group: 'Seating', name: 'Office chair', shape: 'officeChair', size: { w: 65, d: 65, h: 120 }, color: '#2b2b2b', color2: '#444444' },
  { group: 'Seating', name: 'Chair', shape: 'chair', size: { w: 48, d: 52, h: 85 }, color: '#b08d6a', color2: '#7a5c3e' },
  { group: 'Seating', name: 'Armchair', shape: 'sofa', size: { w: 85, d: 85, h: 80 }, color: '#8a9a7b' },
  { group: 'Seating', name: 'Sofa (3-seat)', shape: 'sofa', size: { w: 210, d: 92, h: 85 }, color: '#7b8794' },
  { group: 'Furniture', name: 'Bed 140×200', shape: 'bed', size: { w: 150, d: 210, h: 95 }, color: '#8b8f94', color2: '#e9edf2' },
  { group: 'Furniture', name: 'Bed 160×200', shape: 'bed', size: { w: 170, d: 210, h: 95 }, color: '#8b8f94', color2: '#e9edf2' },
  { group: 'Furniture', name: 'Desk 120×60', shape: 'desk', size: { w: 120, d: 60, h: 74 }, color: '#e8e4dc', color2: '#2a2a2a' },
  { group: 'Furniture', name: 'Table 80×80', shape: 'table', size: { w: 80, d: 80, h: 75 }, color: '#c8a27a', color2: '#2a2a2a' },
  { group: 'Furniture', name: 'Bookshelf', shape: 'bookshelf', size: { w: 80, d: 30, h: 180 }, color: '#e9e5dc' },
  { group: 'Furniture', name: 'Wardrobe', shape: 'box', size: { w: 100, d: 60, h: 200 }, color: '#e9e5dc' },
  { group: 'Furniture', name: 'Nightstand', shape: 'box', size: { w: 45, d: 40, h: 55 }, color: '#c8a27a' },
  { group: 'Decor', name: 'Rug 160×230', shape: 'rug', size: { w: 160, d: 230, h: 1 }, color: '#b9a48a' },
  { group: 'Decor', name: 'Rug 120×170', shape: 'rug', size: { w: 120, d: 170, h: 1 }, color: '#9aa6a0' },
  { group: 'Decor', name: 'Plant', shape: 'plant', size: { w: 45, d: 45, h: 120 }, color: '#4f7d4a', color2: '#c06a45' },
  { group: 'Decor', name: 'Floor lamp', shape: 'floorLamp', size: { w: 45, d: 45, h: 160 }, color: '#2b2b2b' },
  { group: 'Decor', name: 'Any object (box)', shape: 'box', size: { w: 60, d: 40, h: 60 }, color: '#a3a3a3' },
]
