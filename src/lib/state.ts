/**
 * Shared input state — written by the input listeners, read by the scene.
 *
 * mouseX/Y : pointer position normalized to roughly -1..1 (center = 0).
 * scroll   : Scene 1 -> Scene 2 transition progress, 0 at the top of the page,
 *            1 once the page is scrolled to the bottom. Every part of the
 *            transition is driven off this single value.
 */
import { clamp } from './math'

export interface InputState {
  mouseX: number
  mouseY: number
  scroll: number
}

export const state: InputState = {
  mouseX: 0,
  mouseY: 0,
  scroll: 0,
}

/** Attach a pointer listener that feeds normalized mouse coords into state. */
export function initPointer(): void {
  window.addEventListener(
    'mousemove',
    (e) => {
      state.mouseX = (e.clientX / window.innerWidth) * 2 - 1
      state.mouseY = (e.clientY / window.innerHeight) * 2 - 1
    },
    { passive: true },
  )
}

/**
 * Attach a scroll listener that feeds 0..1 transition progress into state.
 *
 * The scrollable height comes from `body { min-height }` in style.css — the
 * canvas and badge are both fixed, so the page has no content of its own to
 * scroll. Also fires once on init so a reload part-way down the page starts at
 * the right progress rather than snapping from 0.
 */
export function initScroll(): void {
  const read = (): void => {
    const range = document.body.scrollHeight - window.innerHeight
    state.scroll = range > 0 ? clamp(window.scrollY / range, 0, 1) : 0
  }
  window.addEventListener('scroll', read, { passive: true })
  window.addEventListener('resize', read, { passive: true })
  read()
}
