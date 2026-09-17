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
 * Driven from main.ts's one RAF loop. **It has no smoothing of its own any
 * more.** It used to chase the page value privately, which is exactly why this
 * scene read smoother than the rest of the site; that stage now lives in
 * `three/scene.ts`'s page value, where everything gets it. The fill is
 * unchanged to the frame — it was already the composition of those two stages —
 * and the type can no longer drift out of step with the model behind it.
 */
import { clamp } from '../lib/math'

const STATEMENTS = ['COMPUTER SCIENCE', 'FULL-STACK DEVELOPER', 'BUILDING TOWARD AI']

/** Fraction of the scene spent taking the layer away at the end. */
const EDGE = 0.08

/**
 * Fraction of the scene the line spends arriving, and how far out of focus and
 * oversized it arrives.
 *
 * **This is the one entrance this scene has, and it was asked for.** The layer
 * used to come in on opacity alone over `EDGE`, which on hairline stroked type
 * reads as a pop rather than an arrival — the statements were simply there.
 * What this does instead is a **focus pull**: the line resolves out of
 * defocus and settles back from slightly oversized, so the composition *comes
 * into focus* rather than moving. That matters, because the standing rule for
 * this scene is that nothing in it moves (see the note at the top): there is
 * still no drift, no parallax and no entrance *per statement* — the block is
 * complete and still the moment it is sharp, and the fill is the only
 * interaction.
 *
 * It runs longer than `EDGE` on purpose: an arrival wants room to be read, an
 * exit wants to be out of the way of the model rising into the frame. The same
 * curve drives the exit, so the scene defocuses as it leaves.
 */
const ENTER = 0.14
const ENTER_BLUR = 9
const ENTER_SCALE = 1.04

/**
 * Where each statement's fill begins, and how long it takes, as fractions of
 * the scene.
 *
 * `FILL_SPAN` is longer than the step between statements, so one is still
 * finishing as the next starts — the three read as a single sweep along the
 * line rather than as three separate events.
 *
 * **The last one has to finish before `EDGE` starts taking the layer away**,
 * and it did not: at 0.06 / 0.28 / 0.32 the third statement completed at 0.94
 * of the scene and the fade-out begins at 0.92, so the sweep was still running
 * as the block dissolved. It now completes at 0.81, which leaves the finished
 * block on screen, complete and still, for the last fifth of the scene before
 * the page moves on. Keep `FILL_FROM + 2 * FILL_STEP + FILL_SPAN` under
 * `1 - EDGE` with room to spare.
 */
const FILL_FROM = 0.05
const FILL_STEP = 0.23
const FILL_SPAN = 0.3

/**
 * The size everything is measured at before being scaled to fit. Arbitrary,
 * but large enough that the measurement is not dominated by rounding.
 */
const MEASURE_PX = 200
/**
 * Fraction of the viewport the line spans.
 *
 * **This is the only size knob there is.** At one justified line the type is as
 * large as the width allows by construction, so "bigger" means nothing except
 * a wider measure — 0.96 is about as close to the edges as the stroke can go
 * without reading as a mistake. The other few percent came out of the
 * separators' own gaps (see `.identity-dot` in style.css). Anything past this
 * needs the line broken, not the number raised.
 */
const BLOCK_WIDTH = 0.96

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

  let hidden = true
  /** Last focus value written, so the settled scene writes nothing per frame. */
  let shownAt = -1

  function update(tt: number): void {
    const fade = smooth(tt / ENTER) * smooth((1 - tt) / EDGE)
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

    // The focus pull. Skipped once it has settled, so the still scene writes
    // nothing but the fill's clip — `filter` and `scale` are the expensive two.
    if (Math.abs(fade - shownAt) > 0.002) {
      shownAt = fade
      const settle = 1 - fade
      el.style.filter = settle > 0.001 ? `blur(${(ENTER_BLUR * settle).toFixed(2)}px)` : 'none'
      // The individual `scale` property, not `transform` — the block's
      // `translate(-50%, -50%)` is a `transform` and the two compose instead of
      // overwriting each other. Same reason the project cards ride on
      // `translate`; see CLAUDE.md.
      block.style.scale = (1 + (ENTER_SCALE - 1) * settle).toFixed(4)
    }

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
