/**
 * The loader: pure black with a counter running 0 → 99 in the middle, on
 * every visit. No bar, nothing else.
 *
 * **Part of it is real.** The count runs toward a 2s finish until the page is
 * actually ready (fonts in, `load` fired), then re-aims from wherever it is to
 * land at the soonest allowed moment — so a fast load counts for 1.5s and a
 * slow one for up to 2s, and the number never jumps or runs backwards.
 *
 * **It is never on screen past 2.5s.** The markup and its style are inline in
 * `index.html`, so it is up from the first paint, before this module runs; the
 * finish is therefore capped against navigation start as well, and the cap
 * wins over the 1.5s minimum on a device slow enough to need it.
 *
 * Driven by `main.ts`'s RAF loop — `update(time)` — rather than a loop or
 * timers of its own. The page's scroll is held for as long as it is up.
 */
import { lockScroll, unlockScroll } from '../lib/scroll-lock'

/** Shortest and longest the count may take, from when it starts. */
const MIN_MS = 1500
const MAX_MS = 2000
/** 99 holds this long, then the black fades out over `FADE_MS`. */
const HOLD_MS = 150
const FADE_MS = 300
/** Latest the count may finish, from navigation start: 2.5s less the exit. */
const CAP_MS = 2500 - HOLD_MS - FADE_MS
/** Once ready, the count takes at least this long to reach 99, so it glides. */
const SETTLE_MS = 200

export interface Loader {
  /** Advance the count. Returns `true` once the loader has gone for good. */
  update(time: number): boolean
}

export function createLoader(): Loader {
  const el = document.getElementById('loader')
  const count = document.getElementById('loader-count')
  if (!el || !count) return { update: () => true }

  lockScroll()

  let ready = false
  const load =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }))
  Promise.all([load, document.fonts.ready]).then(() => {
    ready = true
  })

  let start = -1
  /** The latest the count may land, and — once ready — where it will. */
  let end = 0
  let anchored = false
  let fromValue = 0
  let fromTime = 0
  let doneAt = -1
  let shown = -1
  let gone = false

  function update(time: number): boolean {
    if (gone) return true
    if (start < 0) {
      start = time
      end = Math.min(start + MAX_MS, CAP_MS)
    }

    if (ready && !anchored) {
      // Re-aim from where the count stands, so it neither jumps nor stalls.
      fromValue = valueAt(time) // read before `anchored` switches the formula
      fromTime = time
      anchored = true
      end = Math.min(end, Math.max(start + MIN_MS, time + SETTLE_MS))
    }

    const value = time >= end ? 99 : valueAt(time)
    const whole = Math.floor(value)
    if (whole !== shown) {
      shown = whole
      count!.textContent = String(whole)
    }

    if (whole < 99) return false
    if (doneAt < 0) doneAt = time
    if (time >= doneAt + HOLD_MS) el!.classList.add('is-done')
    if (time < doneAt + HOLD_MS + FADE_MS) return false

    el!.remove()
    unlockScroll()
    gone = true
    return true
  }

  function valueAt(time: number): number {
    if (!anchored) return (99 * (time - start)) / Math.max(end - start, 1)
    const u = (time - fromTime) / Math.max(end - fromTime, 1)
    return fromValue + (99 - fromValue) * Math.min(u, 1)
  }

  return { update }
}
