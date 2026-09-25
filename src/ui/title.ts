/**
 * The PROJECTS heading, after mohitvirli.github.io's EXPERIENCE.
 *
 * The letters sit at one fixed, wide pitch, each at its own height — the
 * first highest, the last lowest — so the word first shows as a faint
 * diagonal across the tunnel's end. Then they all close onto one line at the
 * top of the screen and come up to full white. Their size never changes and
 * neither does their x; only the heights close up. Scroll-driven both ways.
 *
 * The letters fade in as the camera goes through the tunnel's last stretch,
 * and close onto the line once it is out, each chasing its height with
 * `MathUtils.damp(…, 7, delta)`; their opacity is the fade and nothing else.
 * The line is at the top, as there, so a letter's offset is `(1 - drop) *
 * (i + 1)` steps *below* it.
 */
import { beat, MOUTH_AT } from '../lib/journey'
import { range } from '../lib/math'

const WORD = 'PROJECTS'
/**
 * The fade in, then the close-up onto the line, in screens (`lib/journey.ts`):
 * the fade from a sixth of a screen past the tunnel's mouth, the close-up
 * once the camera is out of it.
 */
const FADE = beat(MOUTH_AT + 0.16, 0.8)
const DROP = beat(MOUTH_AT + 0.56, 0.8)
/** One step of the diagonal, in screen heights (the reference's, measured). */
const STEP = 0.1
/** The reference's per-letter damping, λ. */
const LAMBDA = 7

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
    const fade = range(p, ...FADE)
    const drop = range(p, ...DROP)
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
    letters.forEach((span, i) => {
      span.style.translate = `0 ${(offsets[i] * h).toFixed(1)}px`
      span.style.opacity = String(fade)
    })
  }

  return { el, update }
}
