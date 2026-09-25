/**
 * The night world's EXPLORE button: a white pill in the gap between the two
 * hands, centred on the screen. It comes in with the scroll, over the last
 * stretch of the night's opening, and opens the projects page (main.ts).
 */

// Lucide `arrow-up-right` (ISC), stroked in currentColor.
const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'

export interface Explore {
  el: HTMLButtonElement
  /** `night` is how far the night world is open, 0..1. */
  set(night: number): void
}

const FROM = 0.8

export function createExplore(): Explore {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'explore'
  el.innerHTML = `<span class="explore-label">EXPLORE</span><span class="explore-icon">${ARROW_SVG}</span>`

  let drawn = -1
  function set(night: number): void {
    const u = Math.min(1, Math.max(0, (night - FROM) / (1 - FROM)))
    const p = u * u * (3 - 2 * u)
    if (Math.abs(p - drawn) < 0.001) return
    drawn = p
    el.style.opacity = p.toFixed(3)
    el.style.scale = (0.94 + 0.06 * p).toFixed(4)
    el.style.visibility = p > 0 ? 'visible' : 'hidden'
  }
  set(0)
  return { el, set }
}
