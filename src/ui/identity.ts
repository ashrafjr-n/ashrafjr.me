/**
 * 02 — IDENTITY: three statements read against the model, not a scene of their
 * own.
 *
 * The model is already standing when this begins and keeps turning all the way
 * through it (see `IDENTITY_TURNS` in `three/world.ts`); it holds the lower
 * half of the frame and the statements take the upper. Each one **rises out of
 * a mask**, holds while the model turns, and wipes up and out as the next one
 * arrives. That is the whole mechanic — one idea, executed exactly.
 *
 * **What this replaced, and why none of it should come back.** Three stacked
 * headings that scrolled past each other with a dwell; then a thread of stars
 * down a central axis, with a hairline and a comet on it; then the statements
 * rasterised into a particle field with the camera flying through them,
 * bursting and reassembling. Each was a separate visual language invented for
 * this one scene, and each read as a demo bolted onto the site. The model was
 * already the site's one idea — this scene now uses it instead of competing
 * with it.
 *
 * **Only transform and opacity change per frame**, and the wipe is a
 * `translateY` inside an `overflow: hidden` box rather than an animated
 * `clip-path` — so it composites and never re-rasterises the type.
 *
 * Driven from main.ts's one RAF loop. The identity progress is chased with its
 * own time-based smoothing (on top of the page's), so the motion stays soft
 * however the wheel arrives; scrolling back plays it in reverse.
 */
import { clamp } from '../lib/math'

const STATEMENTS = ['COMPUTER SCIENCE', 'FULL-STACK DEVELOPER', 'BUILDING TOWARD AI']

/** Per-second rate the drawn progress chases the scroll at (`1 - exp(-rate * dt)`). */
const CHASE_RATE = 3.2
/** Fraction of the scene spent fading the layer in at the start and out at the end. */
const EDGE = 0.07

/**
 * Fraction of a statement's own third spent rising out of the mask, and again
 * wiping out of it. The rest is the hold.
 *
 * **The hold is in the type only — the model never stops turning**, which is
 * what keeps this from reading as a scroll that snaps. An earlier version held
 * the *scroll* between statements and that is exactly how it felt.
 */
const WIPE_IN = 0.3
const WIPE_OUT = 0.26
/**
 * How far into the statement before it a statement starts arriving.
 *
 * **Equal to `WIPE_OUT`, so the two cross exactly**: the outgoing line leaves
 * through the top of the mask as the incoming one arrives through the bottom,
 * which is the roll this mechanic is for. Without it the two windows merely
 * met, and at the join both lines were outside their masks and the upper half
 * of the frame was empty for a beat.
 */
const OVERLAP = WIPE_OUT

/**
 * How far a statement's own line drifts up across its hold, in vh. Small on
 * purpose: it is there so a held statement is not perfectly static, not as a
 * move of its own.
 */
const DRIFT_VH = 1.6

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

  // Every statement sits in the same place and replaces the one before it.
  // Two elements each, and that is load-bearing: the outer box is the mask and
  // must never carry a transform of ours, the inner one is what slides.
  const lines = STATEMENTS.map((text) => {
    const mask = document.createElement('div')
    mask.className = 'identity-line'
    const word = document.createElement('p')
    word.className = 'identity-word'
    word.textContent = text
    mask.append(word)
    el.append(mask)
    return { mask, word }
  })

  const name = document.createElement('p')
  name.className = 'identity-meta identity-meta--name'
  name.textContent = '02 — IDENTITY'
  el.append(name)

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
    el.style.opacity = fade.toFixed(3)

    // Each statement owns one third of the scene, and `p` is how far through
    // its own third the scroll is: below 0 it has not arrived, above 1 it has
    // gone. Both ends of that are outside the mask, so a statement is only
    // ever drawn where it is meant to be seen.
    const run = tt * STATEMENTS.length
    for (let i = 0; i < lines.length; i++) {
      const { mask, word } = lines[i]
      const p = run - i
      if (p <= -OVERLAP - 0.02 || p >= 1.02) {
        mask.style.visibility = 'hidden'
        continue
      }
      mask.style.visibility = 'visible'

      // Up from below the mask, hold, then up and out of it. One value, so the
      // two halves cannot disagree at the join.
      const inAt = smooth((p + OVERLAP) / WIPE_IN)
      const outAt = smooth((p - (1 - WIPE_OUT)) / WIPE_OUT)
      const slide = (1 - inAt) * 100 - outAt * 100
      const drift = -smooth(p + OVERLAP) * DRIFT_VH

      word.style.transform = `translateY(${slide.toFixed(2)}%)`
      mask.style.transform = `translate(-50%, ${drift.toFixed(2)}vh)`
    }
  }

  return { el, update }
}
