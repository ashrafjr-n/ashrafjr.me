/**
 * Scene 3's EXPLORE button: a black pill, bottom-right, carried up **with the
 * white half** rather than appearing on its own.
 *
 * It rides the panel's own rise (`panelRiseAt`), translated by the same
 * `(1 - up) * 50svh` the panel is, so the two arrive as one piece and scrolling
 * back up lowers them together. It sits *above* the panel (z-index 35) so it
 * paints itself rather than being negated.
 *
 * Nothing is bound to it yet — it is the button, not the destination.
 */
import { panelRiseAt } from './invert'

// Lucide `arrow-up-right` (ISC), stroked in currentColor.
const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'

export interface Explore {
  el: HTMLButtonElement
  /** `page` is the smoothed 0..1 page scroll. */
  update(page: number): void
}

export function createExplore(): Explore {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'explore'
  el.innerHTML = `<span class="explore-label">EXPLORE</span><span class="explore-icon">${ARROW_SVG}</span>`

  let shown = -1

  function update(page: number): void {
    const up = panelRiseAt(page)
    if (Math.abs(up - shown) <= 0.001) return
    shown = up
    el.style.transform = `translateY(${((1 - up) * 50).toFixed(2)}svh)`
    // Hidden while parked, so it is neither painted nor tabbable off-screen.
    el.style.visibility = up <= 0 ? 'hidden' : 'visible'
  }

  return { el, update }
}
