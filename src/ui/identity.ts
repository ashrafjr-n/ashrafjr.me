/**
 * 02 — IDENTITY: the three statements set as one typographic block, all three
 * on screen the whole time. **Nothing moves. The scroll moves the fill.**
 *
 * Each statement is drawn twice, exactly on top of itself: an outline copy
 * (hairline stroke, no fill) and a solid white copy clipped to nothing. As the
 * scroll passes a statement its solid copy is unclipped from the left, so the
 * white sweeps across the word and stays. By the end all three are solid — the
 * block fills in rather than playing through, so there is a real final state
 * and scrolling back drains it exactly.
 *
 * **This is deliberately the least animated thing on the site, and that is the
 * point.** Four earlier versions each answered the brief with more motion —
 * three stacked headings with a dwell, a thread of stars with a comet on it, a
 * particle fly-through that burst and reassembled, a masked roll read against
 * the model — and every one of them read as an effect bolted onto the page.
 * Do not add an entrance, a parallax, a drift or a marker here. The
 * composition is complete on arrival; the fill is the whole interaction.
 *
 * The block is **justified**: `fitType()` measures each statement once and
 * sets its own font size so all three are flush to both margins. They come out
 * at different sizes, shortest statement largest, which is the hierarchy
 * falling out of the text rather than being imposed on it.
 *
 * Driven from main.ts's one RAF loop. The identity progress is chased with its
 * own time-based smoothing (on top of the page's), so the fill stays soft
 * however the wheel arrives.
 */
import { clamp } from '../lib/math'

const STATEMENTS = ['COMPUTER SCIENCE', 'FULL-STACK DEVELOPER', 'BUILDING TOWARD AI']

/** Per-second rate the drawn progress chases the scroll at (`1 - exp(-rate * dt)`). */
const CHASE_RATE = 3.2
/** Fraction of the scene spent fading the layer in at the start and out at the end. */
const EDGE = 0.08

/**
 * Where each statement's fill begins, and how long it takes, as fractions of
 * the scene.
 *
 * `FILL_SPAN` is a little longer than the step between statements, so one is
 * still finishing as the next starts — the three reads as a single sweep down
 * the block rather than as three separate events. The last finishes well
 * before the scene ends, so the block is complete and still for a while before
 * the page moves on.
 */
const FILL_FROM = 0.06
const FILL_STEP = 0.28
const FILL_SPAN = 0.32

/**
 * The size everything is measured at before being scaled to fit. Arbitrary,
 * but large enough that the measurement is not dominated by rounding.
 */
const MEASURE_PX = 200
/** Fraction of the viewport the block spans, and where its left margin sits. */
const BLOCK_WIDTH = 0.92

function smooth(u: number): number {
  const x = clamp(u, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

export interface Identity {
  el: HTMLDivElement
  /** `t` is the identity progress, 0..1; `time` is the RAF timestamp. */
  update(t: number, time: number): void
}

export function createIdentity(): Identity {
  const el = document.createElement('div')
  el.className = 'identity'

  const block = document.createElement('div')
  block.className = 'identity-block'
  el.append(block)

  // Two copies per statement, exactly on top of each other. Both carry the
  // stroke, so their glyph geometry is identical and the fill's edge cannot
  // shimmer half a pixel off the outline's.
  //
  // All three sit on **one line**, separated by a dot. The dot is built the
  // same way as a statement — a hairline ring with a solid copy clipped to
  // nothing over it — so the sweep runs through it rather than past it.
  const fills: HTMLElement[] = []
  const dots: HTMLElement[] = []
  for (const text of STATEMENTS) {
    if (fills.length > 0) {
      const dot = document.createElement('span')
      dot.className = 'identity-dot'
      const dotFill = document.createElement('span')
      dotFill.className = 'identity-dot-fill'
      dot.append(dotFill)
      block.append(dot)
      dots.push(dotFill)
    }
    const row = document.createElement('div')
    row.className = 'identity-row'
    const outline = document.createElement('p')
    outline.className = 'identity-line'
    outline.textContent = text
    const fill = document.createElement('p')
    fill.className = 'identity-line identity-line--fill'
    fill.textContent = text
    fill.setAttribute('aria-hidden', 'true')
    row.append(outline, fill)
    block.append(row)
    fills.push(fill)
  }

  const name = document.createElement('p')
  name.className = 'identity-meta identity-meta--name'
  name.textContent = '02 — IDENTITY'
  el.append(name)

  /**
   * Set each statement's own size so all three are flush to both margins.
   *
   * Measured off the rendered element rather than a canvas, so it accounts for
   * the real face, tracking and stroke. Runs once the font is in and again on
   * resize — never per frame.
   */
  function fitType(): void {
    const target = window.innerWidth * BLOCK_WIDTH
    // One size for the whole line, written on the block: the statements, the
    // gaps and the dots are all sized in `em`, so the entire run scales
    // together and stays flush to both margins. `.identity-block` is
    // `max-content`, or this would measure the viewport instead of the line.
    block.style.fontSize = `${MEASURE_PX}px`
    const natural = block.getBoundingClientRect().width
    if (natural <= 0) return
    block.style.fontSize = `${((MEASURE_PX * target) / natural).toFixed(2)}px`
  }

  let fittedAt = 0
  // The face has to be in before anything is measured, or all three are sized
  // against a fallback and stay that way.
  document.fonts.ready.then(fitType)

  /** The drawn progress, chasing the scroll's. */
  let tt = 0
  let prevTime = 0
  let hidden = true

  function update(t: number, time: number): void {
    const dt = Math.min((time - prevTime) / 1000, 0.1)
    prevTime = time
    tt += (t - tt) * (1 - Math.exp(-CHASE_RATE * dt))
    if (Math.abs(t - tt) < 1e-4) tt = t

    const fade = smooth(tt / EDGE) * smooth((1 - tt) / EDGE)
    if (fade <= 0) {
      if (!hidden) {
        hidden = true
        el.style.visibility = 'hidden'
      }
      return
    }
    if (hidden) {
      hidden = false
      el.style.visibility = 'visible'
    }
    if (window.innerWidth !== fittedAt) {
      fittedAt = window.innerWidth
      fitType()
    }
    el.style.opacity = fade.toFixed(3)

    for (let i = 0; i < fills.length; i++) {
      const filled = smooth((tt - (FILL_FROM + i * FILL_STEP)) / FILL_SPAN)
      // Unclipped from the left, so the white sweeps across the word. The only
      // property written per frame, on the only elements that change.
      const clip = `inset(0 ${(100 - filled * 100).toFixed(2)}% 0 0)`
      fills[i].style.clipPath = clip
      // The dot after this statement fills on the same value, so the sweep
      // carries straight through it into the next statement.
      if (dots[i]) dots[i].style.clipPath = clip
    }
  }

  return { el, update }
}
