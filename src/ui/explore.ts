/**
 * EXPLORE: the white pill under PROJECTS at the end of the journey. The list
 * is not in the page until it is pressed — then the button goes, the list
 * opens under the heading and the page glides the heading up to the top, so
 * the first card slides in beneath it (`main.ts`).
 */
import { range } from '../lib/math'

// Lucide `arrow-up-right` (ISC), stroked in currentColor.
const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'

/** Comes in once the heading has landed, as `[from, span]` of the journey. */
const SHOW = [0.93, 0.07] as const
/** How far it rises as it comes in, px. */
const LIFT = 16

export interface Explore {
  el: HTMLButtonElement
  update(p: number): void
}

export function createExplore(onOpen: () => void): Explore {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'explore'
  el.innerHTML = `<span class="explore-label">EXPLORE</span><span class="explore-icon">${ARROW_SVG}</span>`

  let used = false
  let drawn = -1
  el.addEventListener('click', () => {
    used = true
    el.classList.add('is-used')
    el.blur()
    onOpen()
  })

  function update(p: number): void {
    const t = used ? 0 : range(p, ...SHOW)
    if (t === drawn) return
    drawn = t
    el.style.opacity = String(t)
    el.style.translate = `-50% ${((1 - t) * LIFT).toFixed(1)}px`
    // Out of reach, keyboard included, until it is really there.
    el.style.visibility = t > 0 ? 'visible' : 'hidden'
    el.style.pointerEvents = t > 0.6 ? 'auto' : 'none'
  }

  return { el, update }
}
