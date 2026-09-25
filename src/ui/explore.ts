/**
 * The night world's EXPLORE button: a black pill in the gap between the two
 * hands, centred on the screen. It fades in once the hands have arrived and
 * opens the projects page (wired in main.ts).
 */

// Lucide `arrow-up-right` (ISC), stroked in currentColor.
const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'

export interface Explore {
  el: HTMLButtonElement
  show(on: boolean): void
}

export function createExplore(): Explore {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'explore'
  el.innerHTML = `<span class="explore-label">EXPLORE</span><span class="explore-icon">${ARROW_SVG}</span>`

  return { el, show: (on) => el.classList.toggle('is-shown', on) }
}
