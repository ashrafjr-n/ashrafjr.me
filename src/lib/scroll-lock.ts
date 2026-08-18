/**
 * Freeze the page's scroll while a takeover is open.
 *
 * Everything on screen is `position: fixed`, so the page has no content of its
 * own to scroll and scrolling with the reveal window open changed nothing
 * visible — while silently advancing the Scene 1 -> Scene 2 transition
 * underneath it. Closing the window then dropped the viewer somewhere they
 * never chose to be.
 *
 * **This deliberately does not touch `overflow`, and that is the whole design.**
 * The obvious lock — `html { overflow: hidden }` — takes the scrollbar out of
 * the layout, which widens the initial containing block that every fixed
 * element resolves against. Measured in this page in Chrome with a classic 15px
 * scrollbar forced on: the reveal window's own `calc(100% - 2 * inset)` box went
 * 1481px -> 1496px the instant overflow was hidden, and since the viewport-sized
 * canvas inside is centred on that box, the entire 3D scene would jump 7.5px
 * sideways on open and back again on close. `scrollbar-gutter: stable` does not
 * rescue it — Chrome drops the reserved gutter as soon as the root stops
 * scrolling, giving the same 1481 -> 1496. The window's sizing was written in
 * percentages precisely to survive a scrollbar; a lock that reintroduces the
 * shift would undo that.
 *
 * So no box on the page changes here. The continuous inputs are refused
 * outright, which is what keeps the scrollbar from so much as twitching under a
 * wheel or a trackpad. The `scroll` listener is the catch-all behind them for
 * every other way a page can move — arrow keys, dragging the scrollbar thumb, a
 * programmatic scroll — and it simply puts the page back. Nothing on screen can
 * have moved in between, because nothing on screen is in flow.
 */

/** The scroll position to hold, and to come back to when the lock is released. */
let lockedY = 0
let locked = false

/**
 * Refuse a scrolling gesture. Both of these default to passive on `window`, so
 * they are registered with `{ passive: false }` below — a passive listener is
 * not allowed to call `preventDefault` and would be ignored.
 */
function refuse(event: Event): void {
  event.preventDefault()
}

/** The catch-all: put the page straight back wherever it was moved from. */
function snapBack(): void {
  if (window.scrollY !== lockedY) window.scrollTo(0, lockedY)
}

/** Hold the page where it stands. Safe to call when already locked. */
export function lockScroll(): void {
  if (locked) return
  locked = true
  lockedY = window.scrollY
  window.addEventListener('wheel', refuse, { passive: false })
  window.addEventListener('touchmove', refuse, { passive: false })
  window.addEventListener('scroll', snapBack)
}

/**
 * Let the page go again, exactly where it was taken. The final `scrollTo` is
 * not redundant: the catch-all may have been left mid-correction, and the
 * position the window was opened from is the one the viewer expects back.
 */
export function unlockScroll(): void {
  if (!locked) return
  locked = false
  window.removeEventListener('wheel', refuse)
  window.removeEventListener('touchmove', refuse)
  window.removeEventListener('scroll', snapBack)
  window.scrollTo(0, lockedY)
}
