/**
 * The PROJECTS heading, after mohitvirli.github.io's EXPERIENCE.
 *
 * The letters sit at one fixed, wide pitch, each at its own height — the
 * first highest, the last lowest — so the word first shows as a faint
 * diagonal across the tunnel's end. Then they all close onto one line at the
 * top of the screen and come up to full white. Their size never changes and
 * neither does their x; only the heights close up. Scroll-driven both ways.
 *
 * **In order, as on that site**: in the last tenth of the statements' road
 * the word appears **far off**, a speck at the vanishing point, and grows as
 * the camera comes toward it (a perspective growth, `1 / (1 + FAR * (1 - a))`);
 * only once the camera has arrived and the statements are off the screen do
 * the letters close onto the line, each chasing its height with
 * `MathUtils.damp(…, 7, delta)` as there. The line is at the top here
 * (asked), so a letter's offset is `(1 - drop) * (i + 1)` steps *below* it —
 * the same diagonal, rising into place.
 */
import { range, smoother } from '../lib/math'

const WORD = 'PROJECTS'
/**
 * The approach from far off (the road's last tenth, to the camera's arrival),
 * then the close-up onto the line, as `[from, span]` of the journey.
 */
const APPROACH = [0.62, 0.12] as const
const DROP = [0.76, 0.2] as const
/** How far off the word starts: its scale is `1 / (1 + FAR)` at first. */
const FAR = 12
/** One step of the diagonal, in screen heights. */
const STEP = 0.085
/** The reference's per-letter damping, λ. */
const LAMBDA = 7
/** How clear the letters are on the diagonal, against the line. */
const FAINT = 0.45

export interface Title {
  el: HTMLHeadingElement
  update(p: number, delta: number): void
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

  /** Each letter's offset below the line, in screen heights, as drawn. */
  const offsets = letters.map((_, i) => (i + 1) * STEP)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let drawnP = -1

  function update(p: number, delta: number): void {
    const near = range(p, ...APPROACH)
    const fade = Math.min(1, near * 3)
    const drop = smoother(range(p, ...DROP))
    const chase = reduced.matches ? 1 : 1 - Math.exp(-LAMBDA * delta)
    let moving = p !== drawnP
    drawnP = p
    offsets.forEach((y, i) => {
      const target = (1 - drop) * (i + 1) * STEP
      offsets[i] = Math.abs(target - y) < 1e-5 ? target : y + (target - y) * chase
      if (offsets[i] !== y) moving = true
    })
    if (!moving) return
    const h = window.innerHeight
    el.style.visibility = fade > 0 ? 'visible' : 'hidden'
    el.style.scale = String(1 / (1 + FAR * (1 - near)))
    letters.forEach((span, i) => {
      span.style.translate = `0 ${(offsets[i] * h).toFixed(1)}px`
      span.style.opacity = String(fade * (FAINT + (1 - FAINT) * drop))
    })
  }

  return { el, update }
}
