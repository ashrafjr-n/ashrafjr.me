/**
 * Shared "draw once, top to bottom, then hold" controller for the site's
 * ASCII-art SVGs (the Scene 2 portrait and the two folder icons). Every file
 * is generated the same way — N lines, each clipped by a rect whose width
 * the file's own SMIL widens from 0 to full — so this fetches the file,
 * strips that SMIL, and drives the same clip rects from the caller's own RAF
 * loop instead: the draw starts only once the caller says it is visible
 * (Scene 2 reached), runs once at `drawMs`, and holds fully drawn for good.
 *
 * If `visible` goes false before it finishes, the draw pauses rather than
 * rewinding — it picks up again once `visible` is true, and never resets to
 * blank once it has started.
 *
 * `fill()` skips the draw entirely and shows the artwork complete, and
 * `ready` hands back the injected `<svg>`; together they are what the
 * wide-screen folder icons use, where the artwork is assembled by the star
 * constellation rather than typed in. See those two members below.
 */
import { clamp } from './math'
import { makeIdsUnique, stripLightScheme } from './svg'

/** One line of the artwork: its clip rect and the width that reveals it fully. */
interface Line {
  rect: SVGRectElement
  width: number
}

/**
 * Take the SMIL animation off the artwork and hand back the clip rects it was
 * driving, in top-to-bottom order (which is document order).
 *
 * The `<animate>` elements carry each line's full width in their `to`, so
 * they are read before being removed. Removing them in the same task as the
 * inject means the built-in animation never gets a frame to play.
 */
function takeOverAnimation(root: Element): Line[] {
  const lines: Line[] = []
  for (const animate of root.querySelectorAll('animate[attributeName="width"]')) {
    const rect = animate.parentElement
    if (!(rect instanceof SVGRectElement)) continue
    lines.push({ rect, width: Number(animate.getAttribute('to') ?? 0) })
  }
  // Everything SMIL, including the typing cursor's own animation — the cursor
  // rects are opacity 0 without the `set` that used to switch them on.
  for (const node of root.querySelectorAll('animate, set')) node.remove()
  return lines
}

/** Longest frame gap honoured, so a backgrounded tab doesn't jump the draw. */
const MAX_DELTA_MS = 100

export interface AsciiReveal {
  /**
   * Advance the draw. No-op once it has finished. Returns whether the draw
   * has completed (top to bottom, at least once) — true from the frame it
   * finishes onward, so a caller can gate other UI on "has this drawn in
   * yet" without keeping its own copy of the state.
   */
  update(time: number, visible: boolean): boolean
  /**
   * Open every clip rect at once and retire the controller — `update()` is a
   * no-op from here on, exactly as if the draw had run.
   *
   * This is what the wide-screen folder icons use instead of the typed-in
   * draw: there the artwork is assembled on screen by the star constellation
   * flying in (three/constellation.ts) and then cross-faded to, so the file
   * has to be sitting there complete and simply invisible. A line-by-line
   * type-in would contradict the whole point — the stars drew it, not the
   * file.
   *
   * Safe to call before the fetch has landed: `filled` is remembered and
   * applied the moment the lines exist.
   */
  fill(): void
  /**
   * Resolves with the injected root `<svg>` once it is in the page — the hook
   * for anything that needs to read the artwork itself rather than just watch
   * it draw (the constellation samples its glyph positions). Never rejects; a
   * failed fetch simply leaves it pending.
   */
  ready: Promise<SVGSVGElement>
}

/**
 * Fetch `src`, inject it into `el` (ids made unique with `idPrefix`), and
 * return a controller whose `update()` draws it in once, over `drawMs`, the
 * first time `visible` is true.
 */
export function createAsciiReveal(
  el: HTMLElement,
  src: string,
  idPrefix: string,
  drawMs: number,
): AsciiReveal {
  let lines: Line[] = []
  /** Fractional lines currently drawn; -1 until the first write. */
  let drawn = -1
  /** ms of visible time spent drawing so far; stops advancing once full. */
  let elapsed = 0
  let prevTime = 0
  let done = false

  let announceReady: (svg: SVGSVGElement) => void
  const ready = new Promise<SVGSVGElement>((resolve) => {
    announceReady = resolve
  })

  fetch(src)
    .then((res) => res.text())
    .then((svg) => {
      el.innerHTML = makeIdsUnique(stripLightScheme(svg), idPrefix)
      lines = takeOverAnimation(el)
      // `done` here means fill() was called before the fetch landed — draw it
      // out in full rather than blank, so the request isn't silently lost.
      draw(done ? lines.length : 0) // blank: it is only ever seen mid-draw from here on
      const root = el.querySelector('svg')
      if (root) announceReady(root)
    })
    .catch((err) => console.error(`[ascii-reveal] failed to load ${src}`, err))

  /**
   * Show `filled` lines, fractionally. Only the lines between the last state
   * and this one are touched, so a frame writes one or two attributes rather
   * than all of them.
   */
  function draw(filled: number): void {
    if (filled === drawn) return
    const from = drawn < 0 ? 0 : Math.min(filled, drawn)
    const lo = Math.max(0, Math.floor(from) - 1)
    const hi = Math.min(lines.length - 1, Math.ceil(Math.max(filled, drawn)))
    for (let i = lo; i <= hi; i++) {
      const line = lines[i]
      line.rect.setAttribute('width', String(clamp(filled - i, 0, 1) * line.width))
    }
    drawn = filled
  }

  /** How many lines are drawn after `ms` of active (visible) drawing time. */
  function filledAt(ms: number): number {
    return Math.min(lines.length, (lines.length * ms) / drawMs)
  }

  function update(time: number, visible: boolean): boolean {
    if (done) return true
    const delta = Math.min(time - prevTime, MAX_DELTA_MS)
    prevTime = time
    if (!lines.length || !visible) return done

    elapsed += delta
    draw(filledAt(elapsed))
    if (drawn >= lines.length) done = true
    return done
  }

  function fill(): void {
    done = true
    if (lines.length) draw(lines.length)
  }

  return { update, fill, ready }
}
