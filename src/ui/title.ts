/**
 * The PROJECTS heading at the end of the journey.
 *
 * Its letters drop one after another into a diagonal across the screen, small
 * and faint, while the camera is still in the tunnel's last stretch; then they
 * straighten into one line at the top, at full size, and the projects list
 * scrolls up under it. Scroll-driven both ways, like everything in the journey.
 *
 * The line is the letters' real layout; the diagonal is an offset from it,
 * measured once per resize, so the final frame is plain text with no transform.
 */
import { range, smoother } from '../lib/math'

const WORD = 'PROJECTS'
/** The two beats, as `[from, span]` of the journey. */
const FALL = [0.7, 0.18] as const
const STRAIGHTEN = [0.88, 0.12] as const
/** Each letter starts falling this much of `FALL` after the one before it. */
const FALL_STAGGER = 0.07
/** The diagonal, as fractions of the screen: from its first letter to its last. */
const DIAGONAL = { x0: 0.34, y0: 0.2, x1: 0.64, y1: 0.82 }
/** How big the letters are on the diagonal, against their size in the line. */
const DIAGONAL_SCALE = 0.36
const DIAGONAL_OPACITY = 0.55
/** How far above its place a letter starts its fall, in screen heights. */
const DROP = 0.5

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

  /** Each letter's centre in the line, in px from the stage's top-left. */
  let home: { x: number; y: number }[] = []
  let drawn = -1

  function measure(): void {
    home = letters.map((span) => ({
      x: el.offsetLeft + span.offsetLeft + span.offsetWidth / 2,
      y: el.offsetTop + span.offsetTop + span.offsetHeight / 2,
    }))
    drawn = -1
  }
  // Whenever the heading's box changes: the stylesheet landing (injected by
  // script in dev), the serif swapping in, a resize.
  new ResizeObserver(measure).observe(el)

  function update(p: number): void {
    if (p === drawn || !home.length) return
    drawn = p
    const fall = range(p, ...FALL)
    const s = smoother(range(p, ...STRAIGHTEN))
    const w = window.innerWidth
    const h = window.innerHeight
    const last = letters.length - 1

    letters.forEach((span, i) => {
      const e = smoother(range(fall, i * FALL_STAGGER, 1 - last * FALL_STAGGER))
      const slotX = w * (DIAGONAL.x0 + ((DIAGONAL.x1 - DIAGONAL.x0) * i) / last)
      const slotY = h * (DIAGONAL.y0 + ((DIAGONAL.y1 - DIAGONAL.y0) * i) / last)
      const x = (slotX - home[i].x) * (1 - s)
      const y = (slotY - home[i].y) * (1 - s) - (1 - e) * DROP * h
      span.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`
      span.style.scale = String(DIAGONAL_SCALE + (1 - DIAGONAL_SCALE) * s)
      span.style.opacity = String(e * (DIAGONAL_OPACITY + (1 - DIAGONAL_OPACITY) * s))
    })
  }

  return { el, update }
}
