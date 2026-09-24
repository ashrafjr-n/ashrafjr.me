/**
 * Freeze the page's scroll while a takeover is open.
 *
 * Everything on screen is `position: fixed`, so the page has no content of its
 * own to scroll, and scrolling under a takeover (the projects page) would
 * silently advance the scenes underneath it. Closing it would then drop the
 * viewer somewhere they never chose to be.
 *
 * **This deliberately does not touch `overflow`, and that is the whole design.**
 * The obvious lock — `html { overflow: hidden }` — takes the scrollbar out of
 * the layout, which widens the initial containing block that every fixed
 * element resolves against. Measured in this page in Chrome with a classic 15px
 * scrollbar forced on: a fixed `calc(100% - 2 * inset)` box went 1481px ->
 * 1496px the instant overflow was hidden, so every fixed layer jumps sideways
 * on open and back again on close. (The page scrolls in `body` now, not the
 * document, but the same holds: hiding body's overflow drops its scrollbar and
 * widens everything sized against it.) `scrollbar-gutter: stable` does not
 * rescue it — Chrome drops the reserved gutter as soon as the root stops
 * scrolling, giving the same 1481 -> 1496. The window's sizing was written in
 * percentages precisely to survive a scrollbar; a lock that reintroduces the
 * shift would undo that.
 *
 * So no box on the page changes here. Every input that can scroll a page is
 * refused outright instead, which is what keeps the scrollbar from so much as
 * twitching. The `scroll` listener is only the catch-all behind them — for a
 * dragged scrollbar thumb or a programmatic scroll — and it simply puts the
 * page back. Nothing on screen can have moved in between, because nothing on
 * screen is in flow.
 *
 * **The keys have to be refused rather than corrected**, and that is not
 * belt-and-braces. Chrome scrolls a keypress *smoothly*, over several frames,
 * and the catch-all only runs on the `scroll` event a frame later — so a
 * PageUp fired an animation that the snap-back fought frame by frame and that
 * simply carried on once the lock was released. Measured: the page was handed
 * back at 1680 and drifted to 811 — very nearly the one viewport that PageUp
 * had asked for — a moment after the window closed. Refusing the keydown means
 * the animation is never started, so there is nothing left in flight to
 * outlive the lock.
 */

import { scroller } from './state'

/** The scroll position to hold, and to come back to when the lock is released. */
let lockedY = 0
let locked = false
/**
 * A scroll container inside the takeover that must keep scrolling — the
 * projects list. Gestures and keys aimed inside it are let through; its
 * `overscroll-behavior: contain` stops them chaining out to the page, and the
 * catch-all below covers anything that still does.
 */
let allowed: Element | null = null

const isAllowed = (target: EventTarget | null): boolean =>
  allowed !== null && target instanceof Node && allowed.contains(target)

/**
 * Refuse a scrolling gesture. Both of these default to passive on `window`, so
 * they are registered with `{ passive: false }` below — a passive listener is
 * not allowed to call `preventDefault` and would be ignored.
 */
function refuse(event: Event): void {
  if (isAllowed(event.target)) return
  event.preventDefault()
}

/**
 * The keys that scroll a page. `Enter` and `Tab` are deliberately absent: they
 * move focus and activate controls, which the window still needs.
 */
export const SCROLL_KEYS = new Set([
  ' ',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

/**
 * Refuse a key that would scroll. The one exception is Space on a focused
 * button: there it is the button's own activation and the page does not move,
 * so taking it away would make the window's × unreachable from the keyboard.
 * A focused *link* is not exempt — Space scrolls the page from an anchor,
 * where Enter is what follows it.
 */
function refuseKey(event: KeyboardEvent): void {
  if (!SCROLL_KEYS.has(event.key) || isAllowed(event.target)) return
  const target = event.target as HTMLElement | null
  if (event.key === ' ' && target?.closest?.('button')) return
  event.preventDefault()
}

/** The catch-all: put the page straight back wherever it was moved from. */
function snapBack(): void {
  if (scroller.scrollTop !== lockedY) scroller.scrollTop = lockedY
}

/**
 * Hold the page where it stands, leaving `within` (if given) free to scroll.
 * Safe to call when already locked.
 */
export function lockScroll(within: Element | null = null): void {
  if (locked) return
  locked = true
  allowed = within
  lockedY = scroller.scrollTop
  window.addEventListener('wheel', refuse, { passive: false })
  window.addEventListener('touchmove', refuse, { passive: false })
  // Capture, so the key is refused before anything inside the window can act
  // on it — and before Chrome can start scrolling on it.
  window.addEventListener('keydown', refuseKey, { capture: true })
  // On the scroller, not `window`: an element's `scroll` does not bubble.
  scroller.addEventListener('scroll', snapBack)
}

/**
 * Let the page go again, exactly where it was taken. The final write is
 * not redundant: the catch-all may have been left mid-correction, and the
 * position the window was opened from is the one the viewer expects back.
 */
export function unlockScroll(): void {
  if (!locked) return
  locked = false
  allowed = null
  window.removeEventListener('wheel', refuse)
  window.removeEventListener('touchmove', refuse)
  window.removeEventListener('keydown', refuseKey, { capture: true })
  scroller.removeEventListener('scroll', snapBack)
  scroller.scrollTop = lockedY
}
