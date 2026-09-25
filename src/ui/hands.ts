/**
 * The night world's two hands: a glowing one reaching down from the top-right
 * and a human one rising from below, EXPLORE in the gap between them.
 *
 * **They come in with the scroll**, not on a timer: `set(night)` maps how far
 * the night is open onto each hand's own share of the entrance, written as
 * `--light` / `--human` (0..1, eased) for the stylesheet to turn into
 * position, opacity and focus. Scroll back and they leave the same way.
 *
 * The glowing hand is a photograph, so it is given a little life on top, all
 * masked to the hand's own shape: a slow breath in its light, a fine moving
 * grain, and now and then a faint band of light running down the arm to the
 * fingers. Styled in `.hand-life` (style.css); off under reduced motion.
 */
const LIGHT = '/assets/hero/hand-light.png'

export interface Hands {
  el: HTMLDivElement
  /** `night` is how far the night world is open, 0..1. */
  set(night: number): void
}

/** Each hand's stretch of the night's opening; the human one a beat behind. */
const LIGHT_FROM = 0.4
const LIGHT_TO = 0.88
const HUMAN_FROM = 0.5
const HUMAN_TO = 0.97

/** Ease out: quick to start, long soft landing. */
function arrive(v: number, from: number, to: number): number {
  const u = Math.min(1, Math.max(0, (v - from) / (to - from)))
  return 1 - (1 - u) ** 3
}

export function createHands(): Hands {
  const el = document.createElement('div')
  el.className = 'hands'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML =
    '<div class="hand hand--light">' +
    `<img src="${LIGHT}" alt="" decoding="async">` +
    '<span class="hand-life hand-life--breath"></span>' +
    '<span class="hand-life hand-life--grain"></span>' +
    '<span class="hand-life hand-life--flow"><span></span></span>' +
    '</div>' +
    '<img class="hand hand--human" src="/assets/hero/hand-human.png" alt="" decoding="async">'
  let drawn = -1
  function set(night: number): void {
    if (Math.abs(night - drawn) < 0.0005) return
    drawn = night
    el.style.setProperty('--light', arrive(night, LIGHT_FROM, LIGHT_TO).toFixed(4))
    el.style.setProperty('--human', arrive(night, HUMAN_FROM, HUMAN_TO).toFixed(4))
    el.style.visibility = night > LIGHT_FROM ? 'visible' : 'hidden'
  }
  set(0)
  return { el, set }
}
