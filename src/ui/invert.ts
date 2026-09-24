/**
 * Scene 3's arrival: a white half that rises from the bottom and **inverts
 * everything it covers**.
 *
 * Black page becomes white, the white statements become black, **the white
 * stars become black stars on white**, and a glyph that straddles the edge is
 * split down the middle — white above the line, black below it. That split is
 * the whole effect; it is why this is one plain rectangle and not two styled
 * halves of the page.
 *
 * **It is `mix-blend-mode: difference` over pure white, and that is the trick.**
 * Difference with white is `1 - backdrop`, so the panel does not paint anything
 * of its own: it photographically negates whatever has already been drawn
 * underneath it, canvas and type alike, with no second copy of the text and
 * nothing to keep in sync. Which is also why the identity layer must still be
 * on screen and fully filled when this arrives — there is nothing to invert
 * otherwise. See `ui/identity.ts`, which no longer fades out for exactly this.
 *
 * **The starfield is part of what it negates, and that is not incidental.**
 * The scatter (`lib/scatter.ts`) leaves the field dispersed and slowly turning
 * on screen for the rest of the page instead of clearing it, so the half rises over white points
 * on black and turns them into black points on white — the same field, seen
 * the other way round, with no second layer and nothing to keep in step. If
 * `three/scene.ts` ever stopped drawing the canvas through Scene 3, the white
 * half would come up empty.
 *
 * It covers **half the height**, not the whole frame. The boundary is the
 * composition.
 *
 * A pure function of the page value like everything else, so scrolling back up
 * lowers it again exactly.
 */
import { easeEnds } from '../lib/phases'

/**
 * Page range over which the panel rises into place.
 *
 * **It was 0.70..0.96 and that read as slow and heavy**, then 0.72..0.88 and
 * still both late and slow. 0.26 of the page is 260vh of scroll for a
 * half-screen panel, and on a `smoothstep` — which spends its whole run
 * accelerating and then decelerating — the first fifth of that only moved it
 * a tenth of the way. Over 0.12 on the curve below the panel reaches half
 * height in about **44vh against the original 130vh**, and starts 100vh
 * sooner.
 *
 * `PANEL_FROM` has to stay clear of the identity block's last fill sweep,
 * which completes at page 0.788 (see `FILL_*` in `ui/identity.ts`), or the
 * inversion arrives over type that is still filling. **The 0.022 of page
 * between them is the whole margin and it is meant to be that tight** — the
 * gap where the block sat finished and nothing happened was the dead beat at
 * the end of Scene 2. The two move together.
 *
 * The range sat at 0.60..0.72 while Scene 3 still held 340vh of the split and
 * everything finished in the first fifth of it. `lib/phases.ts` gives that
 * scroll to Scene 1 now, so these are late in page terms again while being
 * the same 115vh of travel.
 */
const PANEL_FROM = 0.81
const PANEL_TO = 0.94

/**
 * Where the rise spends its time: a short ease in, a long settle, and a
 * constant climb between them.
 *
 * `easeEnds` is `lib/phases.ts`'s, the same curve the scene boundaries use —
 * shared rather than a second one here that has to agree. `smoothstep` is
 * that curve at `head = tail = 0.5`, which is what this was; naming the two
 * ramps separately is what buys the middle back and makes the panel read as
 * light rather than as something being hauled up.
 */
const RISE_HEAD = 0.08
const RISE_TAIL = 0.32

/**
 * How far the panel has risen at a page value, 0..1.
 *
 * Exported because **`three/scene.ts` needs the same answer a frame earlier
 * than this module can give it.** The starfield draws its stars heavier
 * wherever the white half is over them, which means the renderer has to know
 * where the boundary is *while it is drawing* — and the loop renders the scene
 * before it updates this panel. Both read the one function, so the boundary
 * the stars are split on and the boundary the panel paints are the same line
 * by construction, not by two constants agreeing.
 */
export function panelRiseAt(page: number): number {
  const u = (page - PANEL_FROM) / (PANEL_TO - PANEL_FROM)
  if (u <= 0) return 0
  if (u >= 1) return 1
  return easeEnds(u, RISE_HEAD, RISE_TAIL)
}

/**
 * The panel's top edge in CSS pixels at a page value, or `Infinity` while it
 * is parked. The panel is `height: 50vh` anchored to the bottom and pushed
 * down by `(1 - up)` of its own height, so its top edge sits at
 * `H - 0.5 * H * up`.
 */
export function panelTopEdgeAt(page: number, viewportHeight: number): number {
  const up = panelRiseAt(page)
  return up <= 0 ? Infinity : viewportHeight * (1 - 0.5 * up)
}

export interface Invert {
  el: HTMLDivElement
  /** `page` is the smoothed 0..1 page scroll. */
  update(page: number): void
  /**
   * The panel's top edge in CSS pixels — the boundary between the black page
   * and the white half — or `Infinity` while it is parked off the bottom.
   *
   * `ui/cursor.ts` is the caller: the inverting pointer only exists inside this
   * panel, so it needs to know where the line is. Read from the panel's own
   * geometry rather than measured, so it costs no layout.
   */
  topEdge(): number
}

export function createInvert(): Invert {
  const el = document.createElement('div')
  el.className = 'invert'
  el.setAttribute('aria-hidden', 'true')

  /** How far up the panel has come, 0..1. -1 until the first update. */
  let shown = -1

  function update(page: number): void {
    const up = panelRiseAt(page)
    if (Math.abs(up - shown) <= 0.001) return
    shown = up
    // Off the bottom at 0, flush with its own top edge at 1. `visibility` keeps
    // the blend out of the compositor's way entirely while it is parked.
    el.style.transform = `translateY(${((1 - up) * 100).toFixed(2)}%)`
    el.style.visibility = up <= 0 ? 'hidden' : 'visible'
  }

  /** The live edge, from the value last written — see `panelTopEdgeAt`. */
  function topEdge(): number {
    if (shown <= 0) return Infinity
    return window.innerHeight * (1 - 0.5 * shown)
  }

  return { el, update, topEdge }
}
