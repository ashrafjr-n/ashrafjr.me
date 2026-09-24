/**
 * The pointer: a disc that **inverts whatever the page has drawn under it** —
 * and it exists **only while the pointer is over the EXPLORE button**.
 *
 * Everywhere else on the site the reader keeps their ordinary system cursor.
 * Move onto EXPLORE and the disc grows out of a point in its place; leave it
 * and it shrinks away and the normal pointer comes straight back. It used to
 * be the pointer for the whole of Scene 3's white half and was narrowed to the
 * button on request. It is also what makes the effect affordable: a blended
 * element forces the browser to rasterise everything beneath it into one
 * surface, which over the animating starfield cost a full-screen recomposite
 * every frame. Parked, it paints nothing and costs nothing.
 *
 * **It is `mix-blend-mode: difference` over pure white, the same mechanism as
 * the panel the button rides** (`ui/invert.ts`) — difference with white is
 * `1 - backdrop`, so the disc paints no colour of its own and needs to know
 * nothing about what it is over: over the black pill it reads white, over the
 * pill's white label and circle it reads black.
 *
 * Two invariants keep it working, and both are in CLAUDE.md:
 *
 * 1. **It is appended last and carries the highest z-index on the page.** A
 *    blended element only negates what is painted *below* it, so anything
 *    stacked over the disc stops being inverted — including the button it
 *    lives over, which is why the disc's 100 has to stay above EXPLORE's 35.
 * 2. **No ancestor of it may create a stacking context** — no `opacity`,
 *    `transform`, `filter`, `isolation` or `will-change` on `html`, `body` or
 *    `#app`. Blending is scoped to the nearest isolating ancestor, so one such
 *    property anywhere up that chain cuts the disc off from the page behind it.
 */

/** Set while the pointer is over EXPLORE, which is the only time the disc shows. */
const LIVE = 'is-live'

export interface Cursor {
  /**
   * Park the disc at once and give the system cursor back. For the projects
   * page opening from a click on EXPLORE: the pointer is still over the
   * button, and the sheet covering it sends no `pointerleave`.
   */
  hide(): void
}

/**
 * Mount the pointer into `parent`, live over `target` (the EXPLORE button),
 * if this is a device that has one.
 *
 * **Call it last**, after every other layer — see the first invariant above.
 * On a coarse pointer nothing is built and nothing is hidden: a phone has no
 * cursor to replace and `cursor: none` there would be meaningless. The returned
 * `hide` is then a no-op, so the caller needs no branch of its own.
 */
export function createCursor(parent: HTMLElement, target: HTMLElement): Cursor {
  if (!window.matchMedia('(pointer: fine)').matches) return { hide: () => {} }

  const el = document.createElement('div')
  el.className = 'cursor'
  // It is the pointer the reader is already holding; there is nothing here to
  // announce, and nothing to click through to.
  el.setAttribute('aria-hidden', 'true')
  parent.append(el)

  /**
   * Swap the disc in for the system cursor, or back.
   *
   * **The native cursor is hidden from here rather than from the stylesheet.**
   * `cursor: none` in CSS would apply whether or not this module ever ran, so a
   * failed script would leave the page with no pointer at all. Gating the rule
   * on a class this file writes makes the system cursor the fallback for free.
   * The grow and shrink are the stylesheet's (`.cursor.is-live`).
   */
  function setLive(live: boolean): void {
    el.classList.toggle(LIVE, live)
    document.documentElement.classList.toggle('has-cursor', live)
  }

  // Pointer events are coalesced to at most one per frame, so this is already
  // frame-accurate; putting it through the RAF loop would only add a frame of
  // lag. The disc tracks the pointer exactly — there is deliberately no spring
  // or trail on it, the way there is on the page's scroll.
  window.addEventListener(
    'pointermove',
    (e) => {
      // Written even while parked, so the disc is already in the right place on
      // the frame it appears. The individual `translate` property, so it
      // composes with the `scale` the grow runs on.
      el.style.translate = `${e.clientX}px ${e.clientY}px`
    },
    { passive: true },
  )
  target.addEventListener('pointerenter', () => setLive(true))
  target.addEventListener('pointerleave', () => setLive(false))

  return { hide: () => setLive(false) }
}
