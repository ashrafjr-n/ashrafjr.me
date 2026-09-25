/**
 * Shared input state — written by the input listeners, read by the scene.
 *
 * mouseX/Y : pointer position normalized to roughly -1..1 (center = 0).
 * scroll   : how far through the journey the page is, 0 at the top, 1 once
 *            the projects list reaches the bottom of the screen. Everything
 *            in the journey is driven off this single value.
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

/**
 * Attach a pointer listener that feeds normalized mouse coords into state.
 *
 * **Only on a device with a real hovering pointer.** A touch screen fires a
 * compatibility `mousemove` on every tap, so the view would jerk toward
 * wherever the reader last touched.
 */
export function initPointer(): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
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
 * The element the page scrolls in. It is `body`, not the window: the document
 * itself is one screen tall and never scrolls (see `html` in style.css), which
 * is what keeps a phone browser's toolbar shown instead of sliding away and
 * back under the composition. Everything that reads or holds the page's scroll
 * goes through this.
 */
export const scroller = document.body

/**
 * Feed the journey's 0..1 progress into state. `end` is the scroll offset, in
 * px, where the journey is complete.
 *
 * **The range is measured out of band, never in the scroll handler** — reading
 * layout there is a forced reflow on the hottest path on the site — and not
 * only at startup either: in dev the stylesheet is injected by script, so the
 * page can still be one screen tall when this runs. A `ResizeObserver` on the
 * scroller and `#app` fires when the stylesheet lands and on every resize.
 */
export function initScroll(end: () => number): void {
  let range = 0
  const read = (): void => {
    state.scroll = range > 0 ? clamp(scroller.scrollTop / range, 0, 1) : 0
  }
  const measure = (): void => {
    range = end()
    read()
  }
  // An element's `scroll` event does not bubble, so this has to be on the
  // scroller itself — a listener on `window` would never hear it.
  scroller.addEventListener('scroll', read, { passive: true })
  const observer = new ResizeObserver(measure)
  observer.observe(scroller)
  observer.observe(document.querySelector('#app')!)
  measure()
}
