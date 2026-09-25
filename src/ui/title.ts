/**
 * The PROJECTS heading, after mohitvirli.github.io's EXPERIENCE.
 *
 * The letters sit at one fixed, wide pitch, each at its own height — the
 * first highest, the last lowest — so the word first shows as a faint
 * diagonal across the tunnel's end. Then they all drop onto one line and come
 * up to full white. Their size never changes and neither does their x; only
 * the heights close up. Scroll-driven both ways.
 *
 * As on the reference: a letter's height above the line is `(1 - drop) *
 * (n - i)` steps, and it fades in over its own stretch, just before the drop.
 */
import { range } from '../lib/math'

const WORD = 'PROJECTS'
/** The fade in, then the drop onto the line, as `[from, span]` of the journey. */
const FADE = [0.72, 0.14] as const
const DROP = [0.8, 0.14] as const
/** One step of the diagonal, in screen heights. */
const STEP = 0.058
/** How clear the letters are on the diagonal, against the line. */
const FAINT = 0.45

export interface Title {
  el: HTMLHeadingElement
  update(p: number): void
}

export function createTitle(): Title {
  const el = document.createElement('h2')
  el.className = 'projects-title'
  el.setAttribute('aria-label', 'Projects')
  const letters = [...WORD].map((char) => {
    const span = document.createElement('span')
    span.textContent = char
    span.setAttribute('aria-hidden', 'true')
    el.append(span)
    return span
  })

  let drawn = -1

  function update(p: number): void {
    if (p === drawn) return
    drawn = p
    const fade = range(p, ...FADE)
    const drop = range(p, ...DROP)
    const h = window.innerHeight
    const n = letters.length
    el.style.visibility = fade > 0 ? 'visible' : 'hidden'
    letters.forEach((span, i) => {
      span.style.translate = `0 ${(-(1 - drop) * (n - i) * STEP * h).toFixed(1)}px`
      span.style.opacity = String(fade * (FAINT + (1 - FAINT) * drop))
    })
  }

  return { el, update }
}
