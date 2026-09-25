/**
 * The night world's two hands: a glowing one reaching down from the top-right
 * and a human one rising from below, EXPLORE in the gap between them. The
 * entrance is all CSS transitions keyed on `is-in`; this only toggles it.
 *
 * The glowing hand is a photograph, so it is given a little life on top, all
 * masked to the hand's own shape: a slow breath in its light, a fine moving
 * grain, and now and then a faint band of light running down the arm to the
 * fingers. Styled in `.hand-life` (style.css); off under reduced motion.
 */
const LIGHT = '/assets/hero/hand-light.png'

export interface Hands {
  el: HTMLDivElement
  show(on: boolean): void
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
  return { el, show: (on) => el.classList.toggle('is-in', on) }
}
