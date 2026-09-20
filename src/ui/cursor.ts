/**
 * The pointer: a disc that **inverts whatever the page has drawn under it**.
 *
 * Black page turns white inside the circle, the white identity statements turn
 * black, a star turns into a hole. Nothing of the circle itself is ever seen —
 * only the negative of what was already there.
 *
 * **It is `mix-blend-mode: difference` over pure white, exactly as Scene 3's
 * panel is** (`ui/invert.ts`) — difference with white is `1 - backdrop`, so the
 * disc paints no colour of its own and needs to know nothing about what it is
 * over. That is the whole reason to do it this way rather than with a clipped
 * copy of the page or per-element colour swaps: **anything added to the site
 * later is inverted with no work at all**, because the inversion happens when
 * the frame is composited, not inside any feature's code.
 *
 * Two invariants keep that true, and both are in CLAUDE.md:
 *
 * 1. **It is appended last and carries the highest z-index on the page.** A
 *    blended element only negates what is painted *below* it; anything stacked
 *    over the disc simply stops being inverted.
 * 2. **No ancestor of it may create a stacking context** — no `opacity`,
 *    `transform`, `filter`, `isolation` or `will-change` on `html`, `body` or
 *    `#app`. Blending is scoped to the nearest isolating ancestor, so one such
 *    property anywhere up that chain silently cuts the disc off from the canvas
 *    and everything else behind it.
 *
 * Note what `difference` does and does not do: pure black and pure white swap,
 * but a mid grey inverts to itself. The dim corner labels and the `Scroll`
 * marker are 50% white, so they barely change inside the circle. That is the
 * arithmetic, not a bug.
 */

/** Set once the disc has a real position to be at. */
const LIVE = 'is-live'

/**
 * Mount the pointer into `parent`, if this is a device that has one.
 *
 * **Call it last**, after every other layer — see the first invariant above.
 * On a coarse pointer nothing is built and nothing is hidden: a phone has no
 * cursor to replace and `cursor: none` there would be meaningless.
 */
export function createCursor(parent: HTMLElement): void {
  if (!window.matchMedia('(pointer: fine)').matches) return

  const el = document.createElement('div')
  el.className = 'cursor'
  // It is the pointer the reader is already holding; there is nothing here to
  // announce, and nothing to click through to.
  el.setAttribute('aria-hidden', 'true')
  parent.append(el)

  /**
   * The native cursor is hidden from here rather than from the stylesheet, and
   * only once the disc has actually been somewhere.
   *
   * `cursor: none` in CSS would apply whether or not this module ever ran, so a
   * failed script or a first paint before any pointer movement would leave the
   * page with no pointer at all. Gating the rule on a class this file adds
   * means the native cursor is the fallback for free.
   */
  let live = false

  // Pointer events are coalesced to at most one per frame, so this is already
  // frame-accurate; putting it through the RAF loop would only add a frame of
  // lag. The disc tracks the pointer exactly — there is deliberately no spring
  // or trail on it, the way there is on the page's scroll.
  window.addEventListener(
    'pointermove',
    (e) => {
      // The individual `translate` property, not `transform`: the stylesheet
      // holds a `transform` that centres the disc on its own box, and the two
      // compose instead of overwriting each other.
      el.style.translate = `${e.clientX}px ${e.clientY}px`
      if (live) return
      live = true
      el.classList.add(LIVE)
      document.documentElement.classList.add('has-cursor')
    },
    { passive: true },
  )

  // Leaving the window parks the disc at the edge it left by, which reads as a
  // mark stuck to the screen. The next move brings it back, so there is no
  // matching enter listener to write.
  document.documentElement.addEventListener('pointerleave', () => {
    live = false
    el.classList.remove(LIVE)
  })
}
