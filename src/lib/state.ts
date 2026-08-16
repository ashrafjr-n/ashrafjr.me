/**
 * Shared input state — written by the pointer listener, read by the scene.
 *
 * mouseX/Y : pointer position normalized to roughly -1..1 (center = 0).
 */
export interface InputState {
  mouseX: number
  mouseY: number
}

export const state: InputState = {
  mouseX: 0,
  mouseY: 0,
}

/** Attach a pointer listener that feeds normalized mouse coords into state. */
export function initPointer(target: InputState = state): void {
  window.addEventListener(
    'mousemove',
    (e) => {
      target.mouseX = (e.clientX / window.innerWidth) * 2 - 1
      target.mouseY = (e.clientY / window.innerHeight) * 2 - 1
    },
    { passive: true },
  )
}
