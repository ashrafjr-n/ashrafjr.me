/**
 * The Scene 2 portrait — an ASCII-art self-portrait that draws itself in,
 * holds, wipes back out and repeats.
 *
 * The artwork ships its own SMIL typing animation, but that starts the moment
 * the file loads and freezes when it is done, so by the time anyone scrolls
 * down to Scene 2 it has long since finished. It is therefore inlined (an
 * `<img>` cannot be reached into) and its animation is **taken over here**: the
 * SMIL elements are stripped on the way in and the same clip rectangles are
 * driven from the app's one RAF loop instead.
 *
 * The artwork is 127 lines, each clipped by a rect that widens from 0 to the
 * full line width. One number therefore describes the whole picture — how many
 * lines are filled, fractionally — so drawing top-to-bottom and wiping
 * bottom-to-top are the same value going up and coming back down.
 */
import { clamp } from '../lib/math'

const MARK_SRC = '/assets/svg/me.svg'

/**
 * The cycle, in ms: draw in, hold fully drawn, wipe out, and straight back to
 * the start — no pause between the wipe finishing and the next draw.
 */
const DRAW_MS = 3400
const HOLD_MS = 1600
const WIPE_MS = 1500
const CYCLE_MS = DRAW_MS + HOLD_MS + WIPE_MS

/** Longest frame gap honoured, so a backgrounded tab doesn't jump the cycle. */
const MAX_DELTA_MS = 100

export interface Mark {
  /** The element to put in the row. Empty until the artwork has loaded. */
  el: HTMLElement
  /**
   * Advance the cycle. `visible` comes from the row's own fade, so the
   * animation only runs once Scene 2 is on screen and starts from blank again
   * if the page is scrolled back up.
   */
  update(time: number, visible: boolean): void
}

/**
 * Cut the artwork's `prefers-color-scheme: light` block out of its stylesheet.
 *
 * Inline, that stylesheet is a document-level one: on a light-mode system it
 * would flip every grey to near-black on a black page. The site is black-only,
 * so the light half is simply removed rather than fought with `color-scheme`.
 */
function stripLightScheme(svg: string): string {
  const at = svg.indexOf('@media(prefers-color-scheme:light){')
  if (at < 0) return svg
  let depth = 0
  for (let i = svg.indexOf('{', at); i < svg.length; i++) {
    if (svg[i] === '{') depth++
    else if (svg[i] === '}' && --depth === 0) return svg.slice(0, at) + svg.slice(i + 1)
  }
  return svg
}

/** One line of the artwork: its clip rect and the width that reveals it fully. */
interface Line {
  rect: SVGRectElement
  width: number
}

/**
 * Take the SMIL animation off the artwork and hand back the clip rects it was
 * driving, in top-to-bottom order (which is document order).
 *
 * The `<animate>` elements carry each line's full width in their `to`, so they
 * are read before being removed. Removing them in the same task as the inject
 * means the built-in animation never gets a frame to play.
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

export function createMark(label: string): Mark {
  const el = document.createElement('div')
  el.className = 'scene2-mark'
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)

  let lines: Line[] = []
  /** Fractional lines currently drawn; -1 until the first write. */
  let drawn = -1
  /** Position in the cycle, advanced only while the row is on screen. */
  let clock = 0
  let prevTime = 0

  fetch(MARK_SRC)
    .then((res) => res.text())
    .then((svg) => {
      el.innerHTML = stripLightScheme(svg)
      lines = takeOverAnimation(el)
      draw(0) // blank: it is only ever seen mid-cycle from here on
    })
    .catch((err) => console.error(`[mark] failed to load ${MARK_SRC}`, err))

  /**
   * Show `filled` lines, fractionally. Only the lines between the last state
   * and this one are touched, so a frame writes one or two attributes rather
   * than all 127.
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

  /** Where the cycle stands: drawing in, held, or wiping back out. */
  function filledAt(ms: number): number {
    const count = lines.length
    if (ms < DRAW_MS) return count * (ms / DRAW_MS)
    if (ms < DRAW_MS + HOLD_MS) return count
    return count * (1 - (ms - DRAW_MS - HOLD_MS) / WIPE_MS)
  }

  function update(time: number, visible: boolean): void {
    const delta = Math.min(time - prevTime, MAX_DELTA_MS)
    prevTime = time
    if (!lines.length) return

    if (!visible) {
      // Off screen: hold it blank and rewound, so arriving in Scene 2 always
      // starts the portrait from its first line.
      clock = 0
      draw(0)
      return
    }

    clock = (clock + delta) % CYCLE_MS
    draw(filledAt(clock))
  }

  return { el, update }
}
