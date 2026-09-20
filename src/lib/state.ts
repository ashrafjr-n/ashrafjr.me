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
 *
 * **The range is measured out of band, never in the scroll handler.**
 * `scrollHeight` is a layout-dependent property, so reading it forces the
 * browser to flush layout synchronously — and doing that inside a `scroll`
 * listener puts a forced reflow on the single hottest path on the site, once
 * per scroll event.
 *
 * **But it cannot simply be measured once at startup either, and that shipped
 * broken.** The range comes from `body { min-height }`, and in dev the
 * stylesheet is injected by script rather than being render-blocking — so at
 * the moment this runs the body can still be one viewport tall. The range then
 * comes out near zero and every scroll maps many times too far down the page:
 * a touch of the wheel landed in the middle of Scene 2. Reading it fresh per
 * event used to hide that, at the cost of the reflow.
 *
 * So it is measured whenever the body actually changes size — which is what a
 * `ResizeObserver` is for, and it fires when the stylesheet lands, on every
 * resize, and on an orientation change, without any of them needing their own
 * listener.
 */
export function initScroll(): void {
  let range = 0
  const read = (): void => {
    state.scroll = range > 0 ? clamp(window.scrollY / range, 0, 1) : 0
  }
  const measure = (): void => {
    range = document.body.scrollHeight - window.innerHeight
    read()
  }
  window.addEventListener('scroll', read, { passive: true })
  new ResizeObserver(measure).observe(document.body)
  measure()
}
