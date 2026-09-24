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
 * 2. **Then they fill — and the first one starts before it has landed.** The
 *    white begins crossing the top line while that line is still travelling,
 *    so the arrival and the fill are one move rather than two beats. Each statement is drawn twice, exactly on top of
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
/**
 * Fraction of the scene the arrival takes. **The fill now starts 0.05 before
 * it ends**, so the two overlap rather than queue — see `FILL_FROM`.
 */
const SLIDE_SPAN = 0.42
/**
 * How far off-screen each statement starts, in viewport widths.
 *
 * A statement is set flush to `BLOCK_WIDTH` of the viewport and is centred, so
 * its near edge is `BLOCK_WIDTH / 2` from the middle; clearing the frame takes
 * `0.5 + BLOCK_WIDTH / 2` = 0.98, and this is that with a margin. Under 0.98
 * they are already on screen when the scene opens.
 *
 * **It was 1.05, and it is what sets how soon the first glyph is seen.** The
 * entrance rides `smooth`, a smootherstep, which is very flat at its start —
 * so those extra 0.07 viewport widths cost 0.088 of the scene before anything
 * reached the frame, against 0.057 at 1.0. That is ~25vh of the overlap with
 * Scene 1's scatter, which is the thing this is being tuned for. The margin
 * left is 0.02 viewport widths; do not go under 0.98.
 */
const SLIDE_FROM = 1.0
// The travel used to carry a `SLIDE_BLUR` stand-in for motion blur (6px,
// peaking at the start and gone on landing). **It was removed on request** —
// the statements are drawn with a 1px stroke and it took too much of them away
// on the way in. The slide is the whole entrance now; don't put a filter back
// on this layer.

/** Fraction of the scene spent bringing the layer in. There is no fade out. */
const EDGE = 0.06

/**
 * Where each statement's fill begins, and how long it takes, as fractions of
 * the scene.
 *
 * `FILL_SPAN` is longer than the step between statements, so one is still
 * finishing as the next starts and the three read as a single pass down the
 * block. **The last has to land before Scene 3's panel starts rising**, or the
 * inversion arrives over type that is still filling — it completes at 0.84 of
 * the scene, which is page 0.788 against the panel's 0.81. That 0.022 of page
 * is deliberately small: the gap between the block finishing and the white
 * half arriving was the dead beat at the end of Scene 2.
 *
 * **`FILL_FROM` is deliberately well under `SLIDE_SPAN` (0.42), and that is
 * the one thing to preserve here.** It was 0.44 against that landing, so the
 * first statement came to a stop and only then began to fill — two beats
 * where the scene wants one. At 0.36 the white starts crossing the top line
 * **0.06 of the scene before it lands**, which is enough for the two to read
 * as one move without the sweep spending most of itself on type that is still
 * travelling — 0.22 was tried and was too far ahead. The floor is 0, where
 * the fill would start on a statement wholly off screen.
 */
const FILL_FROM = 0.36
const FILL_STEP = 0.14
const FILL_SPAN = 0.2

/**
 * The fill's own coast: a critically damped spring on the scene value the
 * sweeps read, so the white **carries on a little past where the wheel
 * stopped** and settles, rather than halting on the same frame. Lag on a held
 * scroll is `2 / FILL_OMEGA`, ~0.33s. Asked for explicitly.
 *
 * **It is the one exception to "the page spring is the only smoothing", and
 * it is scoped to the fill alone.** The slide still reads the page value
 * directly, so the arrival stays locked to the scroll; only the sweeps coast.
 * Under reduced motion the fill reads the scene value directly, like the page.
 */
const FILL_OMEGA = 6
/** Largest integration step, so a long frame cannot destabilise the spring. */
const FILL_MAX_STEP = 1 / 60
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

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
  /**
   * `t` is the identity progress, 0..1 — already smoothed by the page value.
   * `time` is the loop's timestamp, for the fill's coast.
   */
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
    // `filledAt` is the last clip written for this statement, so an unchanged
    // one can be skipped — see `update`.
    return { row, outline, fill, filledAt: -1 }
  })

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
  let fadedAt = -1
  /** The fill's coasting copy of `tt`, and its velocity — see `FILL_OMEGA`. */
  let fillT = 0
  let fillVel = 0
  let prevTime = -1

  /** Advance the fill's spring toward `tt`. Runs even while hidden. */
  function coast(tt: number, time: number): void {
    const delta = prevTime < 0 ? 0 : Math.min((time - prevTime) / 1000, 0.1)
    prevTime = time
    if (REDUCED_MOTION.matches) {
      fillT = tt
      fillVel = 0
      return
    }
    for (let left = delta; left > 0; left -= FILL_MAX_STEP) {
      const step = left < FILL_MAX_STEP ? left : FILL_MAX_STEP
      fillVel += (FILL_OMEGA * FILL_OMEGA * (tt - fillT) - 2 * FILL_OMEGA * fillVel) * step
      fillT += fillVel * step
    }
    // Snapped once there, so the skip below sees an exact, unchanging value.
    if (Math.abs(tt - fillT) < 1e-5 && Math.abs(fillVel) < 1e-4) {
      fillT = tt
      fillVel = 0
    }
  }

  function update(tt: number, time: number): void {
    coast(tt, time)
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
    // Skipped when unchanged, which is most of the scene: `fade` is pinned at
    // 1 between the two EDGE ramps, and this layer is still being updated all
    // through Scene 3, where every write under the inversion panel costs a
    // repaint of the half it covers.
    if (Math.abs(fade - fadedAt) > 0.001) {
      fadedAt = fade
      el.style.opacity = fade.toFixed(3)
    }

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
    }

    for (let i = 0; i < lines.length; i++) {
      const filled = smooth((fillT - (FILL_FROM + i * FILL_STEP)) / FILL_SPAN)
      // Unclipped from the left, so the white sweeps across the word. Skipped
      // once a statement's own sweep is over: all three sit at a complete 1 for
      // the last fifth of the scene and the whole of Scene 3, and rewriting an
      // unchanged clip there repaints the block under the inversion panel for
      // nothing.
      if (Math.abs(filled - lines[i].filledAt) <= 0.0005) continue
      lines[i].filledAt = filled
      lines[i].fill.style.clipPath = `inset(0 ${(100 - filled * 100).toFixed(2)}% 0 0)`
    }
  }

  return { el, update }
}
