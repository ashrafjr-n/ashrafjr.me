/**
 * The page's two scroll markers: one that says there is more below, one that
 * says there is not.
 *
 * Scene 1 is a completely static composition — the ring hangs there and nothing
 * moves until the reader scrolls — so it gives no sign that it is the top of a
 * 900vh page rather than the whole of it. And Scene 3 is a resting state with
 * nothing after it, which reads the same as a page that has stopped responding.
 * Both markers are the same object built twice, at the same place, and only one
 * of them is ever up.
 *
 * **A scroll hint was deliberately deleted from this project once** (with the
 * old HUD) and this is not that: no counter, no progress bar, no percentage.
 * A word and a hairline, in the same mono caps and 0.32em tracking the scene
 * labels use, and gone the moment the page is moving.
 *
 * Both are pure functions of the page value like everything else, so scrolling
 * back up brings the first one back exactly.
 */

/** Page value by which the Scene 1 hint has completely gone. */
const SCROLL_CUE_END = 0.05
/** Page range over which the end marker arrives, as the model lands. */
const END_CUE_FROM = 0.9
const END_CUE_TO = 0.97

function smooth(u: number): number {
  const x = Math.min(Math.max(u, 0), 1)
  return x * x * (3 - 2 * x)
}

/** One marker: a hairline and a word, the line on the side it points toward. */
function buildCue(kind: 'scroll' | 'end', label: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `cue cue--${kind}`
  const line = document.createElement('span')
  line.className = 'cue-line'
  const text = document.createElement('span')
  text.className = 'cue-label'
  text.textContent = label
  // The hairline sits on the side the marker points to: below the word at the
  // top of the page, above it at the bottom.
  el.append(...(kind === 'scroll' ? [text, line] : [line, text]))
  return el
}

export interface Cues {
  el: HTMLDivElement
  /** `page` is the smoothed 0..1 page scroll. */
  update(page: number): void
}

export function createCues(): Cues {
  const el = document.createElement('div')
  el.className = 'cues'

  const scrollCue = buildCue('scroll', 'SCROLL')
  // A real button, so it is reachable by keyboard and announced as an action.
  // `visibility` is what takes it out of the tab order while it is invisible —
  // opacity alone would leave a focusable control sitting over Scene 1.
  const endCue = buildCue('end', 'BACK TO TOP')
  const top = document.createElement('button')
  top.type = 'button'
  top.className = 'cue-button'
  top.append(endCue)
  top.addEventListener('click', () => {
    // The whole page is a pure function of scroll, so a smooth return rewinds
    // all three scenes exactly. Honoured against the reader's motion setting:
    // the same 900vh rewind is the last thing someone asking for less motion
    // wants to sit through.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  })

  el.append(scrollCue, top)

  let shownScroll = -1
  let shownEnd = -1

  /** Write opacity and visibility together; hidden is what drops it from tab order. */
  function show(target: HTMLElement, value: number): void {
    target.style.opacity = value.toFixed(3)
    target.style.visibility = value <= 0 ? 'hidden' : 'visible'
  }

  function update(page: number): void {
    const atTop = 1 - smooth(page / SCROLL_CUE_END)
    if (Math.abs(atTop - shownScroll) > 0.002) {
      shownScroll = atTop
      show(scrollCue, atTop)
    }

    const atEnd = smooth((page - END_CUE_FROM) / (END_CUE_TO - END_CUE_FROM))
    if (Math.abs(atEnd - shownEnd) > 0.002) {
      shownEnd = atEnd
      show(top, atEnd)
      top.disabled = atEnd <= 0
    }
  }

  return { el, update }
}
