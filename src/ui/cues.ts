/**
 * The scroll marker: the word `Scroll`, low on the screen, in Scene 1 only.
 *
 * Scene 1 is a completely static composition — the ring hangs there and nothing
 * moves until the reader scrolls — so it gives no sign that it is the top of a
 * 900vh page rather than the whole of it. This is the only thing that says so.
 *
 * It is a pure function of the page value like everything else, so scrolling
 * back up brings it back exactly.
 *
 * **A `BACK TO TOP` marker lived here too and was removed on request**, as did
 * a `SCROLL` word with a hairline under it, and the lucide mouse icon that
 * followed it. What is here now is the word alone, faint and breathing slowly —
 * it is meant to be noticed, not read. This is not the old HUD scroll-hint
 * returning either (see CLAUDE.md): no counter, no progress bar, no percentage.
 */

/** Page value by which the marker has completely gone. */
const CUE_END = 0.05

/**
 * The marker itself. The word is in its own element because the breathe
 * animation lives there and the scroll fade lives on `.cue` — a running
 * animation beats an inline style, so one element could not carry both.
 */
const CUE_WORD = `<span class="cue-word">Scroll</span>`

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
  el.innerHTML = CUE_WORD
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
