/**
 * 02 — IDENTITY: the three statements, very large, stacked, and **alone on the
 * screen**. Scene 2 has no model.
 *
 * Two things happen here and both are scroll, not time:
 *
 * 1. **The three arrive together, from alternating sides.** They start fully
 *    off-screen — first and third to the left, second to the right — and slide
 *    to centre, where they land stacked on top of each other. That is the whole
 *    entrance; there is no fade-and-pop and no per-statement stagger.
 * 2. **Then they fill.** Each statement is drawn twice, exactly on top of
 *    itself: an outline copy (hairline stroke, no fill) and a solid white copy
 *    clipped to nothing. As the scroll passes a statement its solid copy is
 *    unclipped from the left, so the white sweeps across the word and stays.
 *    By the end all three are solid — the block fills in rather than playing
 *    through, so there is a real final state and scrolling back drains it
 *    exactly.
 *
 * **The block does not fade out.** It is still on screen, complete and white,
 * when Scene 3's panel rises and inverts it (see `ui/invert.ts`) — that
 * inversion is the whole of the transition out, so anything that dimmed the
 * type here would take away the thing being inverted.
 *
 * The block is **justified per statement**: `fitType()` measures each one and
 * sets its own font size so all three are flush to both margins. They come out
 * at different sizes, shortest statement largest, which is the hierarchy
 * falling out of the text rather than being imposed on it.
 *
 * Driven from main.ts's one RAF loop. **It has no smoothing of its own** — that
 * stage lives in `three/scene.ts`'s page value, where everything gets it.
 */
import { clamp } from '../lib/math'

const STATEMENTS = ['COMPUTER SCIENCE', 'FULL-STACK DEVELOPER', 'BUILDING TOWARD AI']

/**
 * Which side each statement comes in from: -1 is off to the left, +1 off to the
 * right. Alternating, so the three cross the frame in opposite directions and
 * the scene reads as closing rather than as sliding.
 */
const SLIDE_SIDE = [-1, 1, -1]
/** Fraction of the scene the arrival takes. The fill starts where it ends. */
const SLIDE_SPAN = 0.42
/**
 * How far off-screen each statement starts, in viewport widths.
 *
 * A statement is set flush to `BLOCK_WIDTH` of the viewport and is centred, so
 * its near edge is `BLOCK_WIDTH / 2` from the middle; clearing the frame takes
 * `0.5 + BLOCK_WIDTH / 2` = 0.98, and 1.05 is that with a margin. Under this
 * they are visibly on screen before the scene has begun.
 */
const SLIDE_FROM = 1.05
/**
 * Peak blur while a statement is travelling, in px.
 *
 * CSS blur is isotropic and this motion is horizontal, so it is not literally
 * motion blur — but over a travel this long it reads as one, and it is what
 * keeps the arrival from looking like three rectangles being slid into place.
 * It is gone by the time they land, and nothing is blurred once the block is
 * still.
 */
const SLIDE_BLUR = 10

/** Fraction of the scene spent bringing the layer in. There is no fade out. */
const EDGE = 0.06

/**
 * Where each statement's fill begins, and how long it takes, as fractions of
 * the scene.
 *
 * `FILL_SPAN` is longer than the step between statements, so one is still
 * finishing as the next starts and the three read as a single pass down the
 * block. **The last has to land before Scene 3's panel starts rising**, or the
 * inversion arrives over type that is still filling — it completes at 0.92 of
 * the scene, which is page 0.664 against the panel's 0.70.
 */
const FILL_FROM = 0.44
const FILL_STEP = 0.14
const FILL_SPAN = 0.2

/**
 * The size everything is measured at before being scaled to fit. Arbitrary,
 * but large enough that the measurement is not dominated by rounding.
 */
const MEASURE_PX = 200
/** Fraction of the viewport each statement spans, flush to both margins. */
const BLOCK_WIDTH = 0.94

function smooth(u: number): number {
  const x = clamp(u, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

export interface Identity {
  el: HTMLDivElement
  /** `t` is the identity progress, 0..1 — already smoothed by the page value. */
  update(t: number): void
}

export function createIdentity(): Identity {
  const el = document.createElement('div')
  el.className = 'identity'

  const block = document.createElement('div')
  block.className = 'identity-block'
  el.append(block)

  // Two copies per statement, exactly on top of each other. Both carry the
  // stroke, so their glyph geometry is identical and the fill's edge cannot
  // shimmer half a pixel off the outline's. The row is what slides, so the two
  // copies always travel together.
  const lines = STATEMENTS.map((text) => {
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
    return { row, outline, fill }
  })

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
    for (const { outline, fill } of lines) {
      outline.style.fontSize = `${MEASURE_PX}px`
      const natural = outline.getBoundingClientRect().width
      if (natural <= 0) continue
      const size = (MEASURE_PX * target) / natural
      outline.style.fontSize = `${size.toFixed(2)}px`
      fill.style.fontSize = `${size.toFixed(2)}px`
    }
  }

  let fittedAt = 0
  // The face has to be in before anything is measured, or all three are sized
  // against a fallback and stay that way.
  document.fonts.ready.then(fitType)

  let hidden = true
  /** Last arrival value written, so the landed block writes nothing per frame. */
  let arrivedAt = -1

  function update(tt: number): void {
    const fade = smooth(tt / EDGE)
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

    // The arrival. One value for all three — they travel together and only
    // their direction differs. Skipped once landed, so the still block writes
    // nothing but the fill's clip.
    const arrived = smooth(tt / SLIDE_SPAN)
    if (Math.abs(arrived - arrivedAt) > 0.001) {
      arrivedAt = arrived
      const away = 1 - arrived
      const travel = away * SLIDE_FROM * window.innerWidth
      for (let i = 0; i < lines.length; i++) {
        // The individual `translate` property, not `transform`: the fill copy
        // is positioned over the outline and the block carries a `transform` of
        // its own, and these compose instead of overwriting each other.
        lines[i].row.style.translate = `${(SLIDE_SIDE[i] * travel).toFixed(1)}px 0`
      }
      el.style.filter = away > 0.001 ? `blur(${(SLIDE_BLUR * away).toFixed(2)}px)` : 'none'
    }

    for (let i = 0; i < lines.length; i++) {
      const filled = smooth((tt - (FILL_FROM + i * FILL_STEP)) / FILL_SPAN)
      // Unclipped from the left, so the white sweeps across the word. The only
      // property written per frame once the block has landed.
      lines[i].fill.style.clipPath = `inset(0 ${(100 - filled * 100).toFixed(2)}% 0 0)`
    }
  }

  return { el, update }
}
