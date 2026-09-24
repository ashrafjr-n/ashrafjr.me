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

/**
 * Attach a pointer listener that feeds normalized mouse coords into state.
 *
 * **Only on a device with a real hovering pointer.** A touch screen fires a
 * compatibility `mousemove` on every tap, so on a phone or an iPad the whole
 * starfield would jerk toward wherever the reader last touched — a tilt with
 * nothing continuous behind it. There the field simply stays level.
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
 * Attach a scroll listener that feeds 0..1 transition progress into state.
 *
 * The scrollable height comes from `#app { min-height }` in style.css — every
 * layer is fixed, so the page has no content of its own to scroll. Also fires
 * once on init so the progress starts from wherever the scroller already is
 * rather than snapping from 0.
 *
 * **The range is measured out of band, never in the scroll handler.**
 * `scrollHeight` is a layout-dependent property, so reading it forces the
 * browser to flush layout synchronously — and doing that inside a `scroll`
 * listener puts a forced reflow on the single hottest path on the site, once
 * per scroll event.
 *
 * **But it cannot simply be measured once at startup either, and that shipped
 * broken.** The range comes from `#app { min-height }`, and in dev the
 * stylesheet is injected by script rather than being render-blocking — so at
 * the moment this runs the page can still be one viewport tall. The range then
 * comes out near zero and every scroll maps many times too far down the page:
 * a touch of the wheel landed in the middle of Scene 2. Reading it fresh per
 * event used to hide that, at the cost of the reflow.
 *
 * So it is measured whenever either side of it changes size — the content
 * (`#app`) or the scroller's own box (`body`, on every resize and orientation
 * change) — which is what a `ResizeObserver` is for, and it fires when the
 * stylesheet lands too, without any of them needing their own listener.
 */
export function initScroll(): void {
  let range = 0
  const read = (): void => {
    state.scroll = range > 0 ? clamp(scroller.scrollTop / range, 0, 1) : 0
  }
  const measure = (): void => {
    range = scroller.scrollHeight - scroller.clientHeight
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
