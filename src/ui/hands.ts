/**
 * The night world's two hands: a glowing one reaching down from the top-right
 * and a human one rising from below, EXPLORE in the gap between them. The
 * entrance is all CSS transitions keyed on `is-in`; this only toggles it.
 */
export interface Hands {
  el: HTMLDivElement
  show(on: boolean): void
}

export function createHands(): Hands {
  const el = document.createElement('div')
  el.className = 'hands'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML =
    '<img class="hand hand--light" src="/assets/hero/hand-light.png" alt="" decoding="async">' +
    '<img class="hand hand--human" src="/assets/hero/hand-human.png" alt="" decoding="async">'
  return { el, show: (on) => el.classList.toggle('is-in', on) }
}
