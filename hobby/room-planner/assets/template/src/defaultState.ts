import type { Item, PlannerState, Room } from './types'

// THE ROOM. This file is the model of the person's room as it is today, worked out from their photos
// (see the room-planner skill's references/room-from-photos.md). Everything below is an EXAMPLE to
// replace: sizes in cm, origin at the north-west inside corner, x west→east, z north→south.
// Say clearly to the person which numbers are estimates until they measure.

const W = 420
const D = 340
const H = 260

export const defaultRoom: Room = {
  name: 'My room',
  width: W,
  depth: D,
  height: H,
  wallThickness: 12,
  wallColor: '#e8e2d6',
  floorColor: '#c99254',
  // Stretches of wall in a different finish (panelling, a painted accent wall). `from`/`to` are measured
  // like wall items: from the wall's left end as seen standing in the room facing it.
  finishes: [],
  // Names people actually use for their walls; layout suggestions say "Bed on the window wall".
  wallNames: { north: 'window wall', east: 'door wall', south: 'wardrobe wall', west: 'bed wall' },
  openings: [
    { id: 'window', wall: 'north', kind: 'window', along: 210, width: 140, height: 150, sill: 85, label: 'Window' },
    { id: 'door', wall: 'east', kind: 'door', along: D - 60, width: 85, height: 210, sill: 0, label: 'Door' },
  ],
}

export const defaultItems: Item[] = [
  {
    id: 'bed',
    name: 'Bed',
    shape: 'bed',
    size: { w: 170, d: 212, h: 100 },
    color: '#7a7d82',
    color2: '#e9edf2',
    place: { type: 'floor', x: 106, z: 170, rot: 270 },
  },
  {
    id: 'nightstand',
    name: 'Bedside table',
    shape: 'box',
    style: 'drawers',
    finish: 'wood',
    size: { w: 45, d: 40, h: 55 },
    color: '#b98b5e',
    place: { type: 'floor', x: 20, z: 40, rot: 270 },
  },
  {
    id: 'desk',
    name: 'Desk',
    shape: 'desk',
    size: { w: 120, d: 60, h: 74 },
    color: '#e8e4dc',
    color2: '#2a2a2a',
    style: 'metal',
    place: { type: 'floor', x: 330, z: 30, rot: 180 },
  },
  {
    id: 'desk-chair',
    name: 'Desk chair',
    shape: 'officeChair',
    style: 'mesh',
    size: { w: 64, d: 64, h: 118 },
    color: '#2b2b2b',
    color2: '#3a3a3a',
    place: { type: 'floor', x: 330, z: 100, rot: 0 },
  },
  {
    id: 'wardrobe',
    name: 'Wardrobe',
    shape: 'box',
    style: 'doors',
    finish: 'painted',
    size: { w: 100, d: 58, h: 200 },
    color: '#efede8',
    place: { type: 'floor', x: 250, z: D - 30, rot: 180 },
  },
  {
    id: 'lamp',
    name: 'Floor lamp',
    shape: 'floorLamp',
    style: 'stick-dome',
    size: { w: 30, d: 30, h: 150 },
    color: '#2b2b2b',
    color2: '#f2efe8',
    place: { type: 'floor', x: 20, z: 300, rot: 0 },
  },
  {
    id: 'poster',
    name: 'Poster',
    shape: 'poster',
    size: { w: 50, d: 3, h: 70 },
    color: '#1c1c1c',
    frame: 2,
    place: { type: 'wall', wall: 'west', along: 170, elev: 115 },
  },
  {
    id: 'curtain',
    name: 'Curtain',
    shape: 'curtain',
    style: 'semi',
    size: { w: 180, d: 12, h: H - 6 },
    color: '#e9e3d6',
    place: { type: 'wall', wall: 'north', along: 210, elev: 0 },
  },
  {
    id: 'radiator',
    name: 'Radiator',
    shape: 'radiator',
    size: { w: 80, d: 10, h: 55 },
    color: '#f1f1f1',
    fixture: true,
    locked: true,
    place: { type: 'wall', wall: 'north', along: 210, elev: 12 },
  },
]

export const CURRENT_VARIANT_ID = 'current'

export function defaultState(): PlannerState {
  return structuredClone({
    version: 1,
    room: defaultRoom,
    variants: [{ id: CURRENT_VARIANT_ID, name: 'Current room', items: defaultItems }],
    activeVariantId: CURRENT_VARIANT_ID,
  })
}
