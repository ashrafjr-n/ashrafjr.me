/**
 * The Scene 2 portrait — an ASCII-art self-portrait that draws itself in,
 * top to bottom, once Scene 2 is reached, and then stays fully drawn.
 *
 * The draw itself is `lib/ascii-reveal.ts`'s: this module just supplies the
 * file, the element and the accessible label.
 */
import { createAsciiReveal } from '../lib/ascii-reveal'

const MARK_SRC = '/assets/svg/me.svg'

/** How long the draw-in takes, in ms. */
const DRAW_MS = 3400

export interface Mark {
  /** The element to put in the row. Empty until the artwork has loaded. */
  el: HTMLElement
  /**
   * Advance the draw. `visible` comes from the row's own fade, so it only
   * starts once Scene 2 is on screen, and pauses (without rewinding) if
   * scrolled away before it finishes.
   */
  update(time: number, visible: boolean): void
}

export function createMark(label: string): Mark {
  const el = document.createElement('div')
  el.className = 'scene2-mark'
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)

  const reveal = createAsciiReveal(el, MARK_SRC, 'mark', DRAW_MS)

  return { el, update: reveal.update }
}
