import type { RootState } from '@react-three/fiber'

/** The WebGL canvas, for the screenshot button. */
export const canvasHandle: { current: HTMLCanvasElement | null } = { current: null }

/** The live three.js state, for poking at the scene from the browser console while developing. */
export function exposeForDebugging(state: RootState) {
  // A getter, so the console always sees the current camera and controls.
  if (import.meta.env.DEV) (window as unknown as { room3d: () => RootState }).room3d = state.get
}
