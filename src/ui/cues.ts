/**
 * The scroll marker: a mouse, low on the screen, in Scene 1 only.
 *
 * Scene 1 is a completely static composition — the ring hangs there and nothing
 * moves until the reader scrolls — so it gives no sign that it is the top of a
 * 900vh page rather than the whole of it. This is the only thing that says so.
 *
 * It is a pure function of the page value like everything else, so scrolling
 * back up brings it back exactly.
 *
 * **A `BACK TO TOP` marker lived here too and was removed on request.** So was
 * the old `SCROLL` word-and-hairline this replaced. And this is not the old HUD
 * scroll-hint returning either (see CLAUDE.md) — there is no counter, no
 * progress bar and no percentage.
 */

/** Page value by which the marker has completely gone. */
const CUE_END = 0.05

/**
 * Lucide's `mouse`, ISC, embedded rather than installed — the same way every
 * other icon in this project is carried (see the social row in CLAUDE.md).
 * **Don't hand-draw a replacement**; take it from a recognised set the same
 * way. Only `stroke-width` is ours, dropped from the set's 2 to sit with the
 * hairlines everything else on the page is drawn with.
 */
const MOUSE_ICON = `<svg class="cue-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="5" y="2" width="14" height="20" rx="7" />
  <path d="M12 6v4" />
</svg>`

function smooth(u: number): number {
  const x = Math.min(Math.max(u, 0), 1)
  return x * x * (3 - 2 * x)
}

export interface Cues {
  el: HTMLDivElement
  /** `page` is the smoothed 0..1 page scroll. */
  update(page: number): void
}

export function createCues(): Cues {
  const el = document.createElement('div')
  el.className = 'cue'
  el.innerHTML = MOUSE_ICON
  // It says "there is more below" to anyone who can see it; there is nothing
  // here for a screen reader to act on, so it is not announced.
  el.setAttribute('aria-hidden', 'true')

  let shown = -1

  function update(page: number): void {
    const value = 1 - smooth(page / CUE_END)
    if (Math.abs(value - shown) <= 0.002) return
    shown = value
    el.style.opacity = value.toFixed(3)
    el.style.visibility = value <= 0 ? 'hidden' : 'visible'
  }

  return { el, update }
}
