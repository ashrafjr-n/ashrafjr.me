/**
 * Scene 3's arrival: a white half that rises from the bottom and **inverts
 * everything it covers**.
 *
 * Black page becomes white, the white statements become black, and a glyph
 * that straddles the edge is split down the middle — white above the line,
 * black below it. That split is the whole effect; it is why this is one plain
 * rectangle and not two styled halves of the page.
 *
 * **It is `mix-blend-mode: difference` over pure white, and that is the trick.**
 * Difference with white is `1 - backdrop`, so the panel does not paint anything
 * of its own: it photographically negates whatever has already been drawn
 * underneath it, canvas and type alike, with no second copy of the text and
 * nothing to keep in sync. Which is also why the identity layer must still be
 * on screen and fully filled when this arrives — there is nothing to invert
 * otherwise. See `ui/identity.ts`, which no longer fades out for exactly this.
 *
 * It covers **half the height**, not the whole frame. The boundary is the
 * composition.
 *
 * A pure function of the page value like everything else, so scrolling back up
 * lowers it again exactly.
 */

/** Page range over which the panel rises into place. */
const PANEL_FROM = 0.7
const PANEL_TO = 0.96

function smooth(u: number): number {
  const x = Math.min(Math.max(u, 0), 1)
  return x * x * (3 - 2 * x)
}

export interface Invert {
  el: HTMLDivElement
  /** `page` is the smoothed 0..1 page scroll. */
  update(page: number): void
}

export function createInvert(): Invert {
  const el = document.createElement('div')
  el.className = 'invert'
  el.setAttribute('aria-hidden', 'true')

  let shown = -1

  function update(page: number): void {
    const up = smooth((page - PANEL_FROM) / (PANEL_TO - PANEL_FROM))
    if (Math.abs(up - shown) <= 0.001) return
    shown = up
    // Off the bottom at 0, flush with its own top edge at 1. `visibility` keeps
    // the blend out of the compositor's way entirely while it is parked.
    el.style.transform = `translateY(${((1 - up) * 100).toFixed(2)}%)`
    el.style.visibility = up <= 0 ? 'hidden' : 'visible'
  }

  return { el, update }
}
