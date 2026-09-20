/**
 * The pointer: a disc that **inverts whatever the page has drawn under it** —
 * and it exists **only inside Scene 3's white half**.
 *
 * Everywhere else on the site the reader keeps their ordinary system cursor.
 * Cross into the white panel and it becomes a black disc; leave it and the
 * normal pointer comes straight back. That was the brief, and it is also what
 * makes the effect affordable: a blended element forces the browser to
 * rasterise everything beneath it into one surface, which over the animating
 * starfield cost a full-screen recomposite every frame. Parked, it paints
 * nothing and costs nothing.
 *
 * **It is `mix-blend-mode: difference` over pure white, the same mechanism as
 * the panel it lives in** (`ui/invert.ts`) — difference with white is
 * `1 - backdrop`, so the disc paints no colour of its own and needs to know
 * nothing about what it is over. Inside the white half that reads black; where
 * the half overlaps something already inverted, it inverts back — so over a
 * statement the panel has already turned black, and over the black stars the
 * panel has made of the pressed field, the disc puts both back to white.
 *
 * **The stars are the one thing under it that is not a flat tone**, now that
 * the press leaves the field on screen for the whole page. Each point is a
 * radial sprite, so its edge is a grey falloff rather than an edge, and
 * difference takes a mid grey to something near itself — the disc passing over
 * a star inverts its bright core cleanly and barely touches the halo around
 * it. That is correct and costs nothing; it is only worth knowing before
 * anyone reads it as the blend failing.
 *
 * Two invariants keep it working, and both are in CLAUDE.md:
 *
 * 1. **It is appended last and carries the highest z-index on the page.** A
 *    blended element only negates what is painted *below* it, so anything
 *    stacked over the disc stops being inverted — including the panel itself,
 *    which is why the disc's 100 has to stay above the panel's 30.
 * 2. **No ancestor of it may create a stacking context** — no `opacity`,
 *    `transform`, `filter`, `isolation` or `will-change` on `html`, `body` or
 *    `#app`. Blending is scoped to the nearest isolating ancestor, so one such
 *    property anywhere up that chain cuts the disc off from the page behind it.
 */

/** Set while the disc is inside the white panel, which is the only time it shows. */
const LIVE = 'is-live'

export interface Cursor {
  /**
   * `panelTop` is the white panel's top edge in CSS px — `invert.topEdge()`.
   *
   * Called every frame because the panel moves under a stationary pointer as
   * the page scrolls; the pointer's own movement is handled by the listener.
   * Both paths funnel into the same test, and it does nothing unless the answer
   * has actually changed.
   */
  update(panelTop: number): void
}

/**
 * Mount the pointer into `parent`, if this is a device that has one.
 *
 * **Call it last**, after every other layer — see the first invariant above.
 * On a coarse pointer nothing is built and nothing is hidden: a phone has no
 * cursor to replace and `cursor: none` there would be meaningless. The returned
 * `update` is then a no-op, so the caller needs no branch of its own.
 */
export function createCursor(parent: HTMLElement): Cursor {
  if (!window.matchMedia('(pointer: fine)').matches) return { update: () => {} }

  const el = document.createElement('div')
  el.className = 'cursor'
  // It is the pointer the reader is already holding; there is nothing here to
  // announce, and nothing to click through to.
  el.setAttribute('aria-hidden', 'true')
  parent.append(el)

  /** Last known pointer height, in CSS px. -1 until it has been anywhere. */
  let pointerY = -1
  /** The white panel's top edge, `Infinity` while it is parked off the bottom. */
  let panelTop = Infinity
  /** Whether the disc is currently the pointer. */
  let live = false

  /**
   * Swap the disc in for the system cursor, or back, when the pointer crosses
   * the panel's edge.
   *
   * **The native cursor is hidden from here rather than from the stylesheet.**
   * `cursor: none` in CSS would apply whether or not this module ever ran, so a
   * failed script would leave the page with no pointer at all. Gating the rule
   * on a class this file writes makes the system cursor the fallback for free —
   * and now it is also the normal state everywhere outside the white half.
   *
   * The early return matters: the class on `<html>` invalidates style for the
   * whole document, so it is written when the answer changes and not per move.
   */
  function apply(): void {
    const inside = pointerY >= panelTop
    if (inside === live) return
    live = inside
    el.classList.toggle(LIVE, inside)
    document.documentElement.classList.toggle('has-cursor', inside)
  }

  // Pointer events are coalesced to at most one per frame, so this is already
  // frame-accurate; putting it through the RAF loop would only add a frame of
  // lag. The disc tracks the pointer exactly — there is deliberately no spring
  // or trail on it, the way there is on the page's scroll.
  window.addEventListener(
    'pointermove',
    (e) => {
      // Written even while parked, so the disc is already in the right place on
      // the frame it appears. The individual `translate` property, not
      // `transform`: the stylesheet holds a `transform` that centres the disc
      // on its own box, and the two compose instead of overwriting each other.
      el.style.translate = `${e.clientX}px ${e.clientY}px`
      pointerY = e.clientY
      apply()
    },
    { passive: true },
  )

  // Leaving the window puts the system cursor back and parks the disc, which
  // would otherwise stay stuck at the edge it left by.
  document.documentElement.addEventListener('pointerleave', () => {
    pointerY = -1
    apply()
  })

  function update(top: number): void {
    if (top === panelTop) return
    panelTop = top
    apply()
  }

  return { update }
}
