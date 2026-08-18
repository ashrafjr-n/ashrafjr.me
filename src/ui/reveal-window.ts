/**
 * Scene 2 reveal window — the project preview, opened from the words in the
 * Scene 2 row.
 *
 * One feature, one module: the element, its open/close behaviour and the 3D
 * layer behind it (`three/reveal.ts`) all live here. `main.ts` only mounts it,
 * hands it its triggers and calls `update()` from the single RAF loop.
 *
 * The element is a MASK, not a viewport: the canvas inside is always the size
 * of the screen, so opening grows the mask and uncovers more of the same
 * rendered frame. Nothing here may scale or resize that canvas — see the
 * .reveal-window rules in style.css.
 *
 * While closed it is invisible and inert: it has no resting box of its own on
 * screen any more. It grows out of whichever word was clicked and shrinks back
 * into it, so its geometry is written from here rather than set in CSS.
 */
import type { InputState } from '../lib/state'
import { createRevealScene } from '../three/reveal'
import {
  armCardEntrance,
  buildProjectCards,
  CARD_EXIT_MS,
  dropCards,
  playCardEntrance,
} from './project-cards'

/**
 * How long after opening the look-around starts, in ms. Matches
 * --reveal-duration in style.css: the 3D view only responds once the window
 * has finished growing.
 */
const OPEN_MS = 620

/**
 * How long after opening the row starts rising, in ms. Near-immediate on
 * purpose: the cascade used to be released on the same OPEN_MS beat as the
 * look-around, which read as a pause with nothing happening in it. The cards
 * now start from below the frame and take well over a second to land, so they
 * are still climbing long after the mask has finished growing — there is
 * nothing left to wait for. It is not zero only so the window is visibly on its
 * way before the row sets off; the armed state also wants a paint of its own.
 *
 * On a phone this same beat is also when the camera's intro pan starts — see
 * the sweep note in three/reveal.ts.
 */
const CARDS_MS = 100

/**
 * The window no longer waits on the drop at all: `closeWindow()` starts the
 * cards down and the window into its word in the same tick, and the two play
 * over each other. They are independent animations — the drop is the cards' own
 * CSS transition, the shrink is the window's — so running them together takes
 * nothing but starting them together, and the drop finishing after the mask has
 * gone costs nothing either.
 *
 * `CARD_EXIT_MS` is still imported, for the one thing that genuinely cannot
 * happen until the cards are gone — see `settleScene()`.
 */

export interface RevealWindow {
  /** Make `trigger` open the window, growing the view out of its own box. */
  bindTrigger(trigger: HTMLElement): void
  /**
   * Take or refuse input. Turning it off also puts an open window away, so
   * scrolling back toward Scene 1 never leaves a preview over the transition.
   */
  setInteractive(active: boolean): void
  /** Per-frame: the look-around while open. Draws nothing while closed. */
  update(state: InputState): void
  resize(): void
}

/** The window's own geometry, in the same terms as its CSS box. */
interface Box {
  left: number
  bottom: number
  width: number
  height: number
}

/** Where an element sits, as a box the fixed-position window can be given. */
function boxOf(el: HTMLElement): Box {
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left,
    bottom: window.innerHeight - rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

/**
 * Build the window's DOM. A fixed-position mask over everything, framed by a
 * hairline that sits --reveal-inset off the screen's edges when it is open.
 */
function buildElements(): {
  root: HTMLDivElement
  canvas: HTMLCanvasElement
  cards: HTMLDivElement
  raised: HTMLDivElement
  close: HTMLButtonElement
} {
  const root = document.createElement('div')
  root.className = 'reveal-window'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Project preview')
  root.setAttribute('aria-hidden', 'true')

  // Always the size of the viewport, centred on the window, so growing the
  // window uncovers more of the same frame instead of resizing the drawing
  // buffer.
  const canvas = document.createElement('canvas')
  canvas.className = 'reveal-canvas'

  // The project cards' layer: same size and placement as the canvas, driven by
  // the scene's CSS3D renderer off the same camera. It goes between the canvas
  // and the close corner so the cards sit over the stars and under the ×.
  const cards = document.createElement('div')
  cards.className = 'reveal-cards'

  // The hovered card is drawn here instead of in the row, and this sits after
  // the row for exactly one reason: the row is a single 3D rendering context,
  // where the browser paints by depth and neither document order nor z-index
  // can lift a card out from behind its neighbour. A second layer is a second
  // context, which simply paints later. See three/reveal.ts.
  const raised = document.createElement('div')
  raised.className = 'reveal-cards reveal-cards-raised'

  const close = document.createElement('button')
  close.className = 'reveal-close'
  close.type = 'button'
  close.setAttribute('aria-label', 'Close project preview')
  close.textContent = '×'

  // Document order is the stacking: stars, the row, the raised card, the ×.
  root.append(canvas, cards, raised, close)
  return { root, canvas, cards, raised, close }
}

/**
 * The window mounts itself into `parent` and only then builds its 3D layer.
 * That order is load-bearing: the scene draws exactly one still frame at
 * startup and then renders on demand, so its canvas has to be in the page
 * already for that frame to reach the screen.
 *
 * `onOpenChange` is how the rest of the page finds out: the window covers the
 * screen when it is open, so the page behind it has no business still scrolling
 * or animating. It fires once per real change, on both edges, and this module
 * stays ignorant of what anyone does with it.
 */
export function createRevealWindow(
  parent: HTMLElement,
  onOpenChange?: (open: boolean) => void,
): RevealWindow {
  const { root, canvas, cards, raised, close } = buildElements()
  parent.append(root)

  // The window's own 3D layer: its own renderer, scene and camera, sharing
  // nothing with the Scene 1 starfield. Built once and reused for every open,
  // so reopening allocates nothing. The cards are built here and placed in the
  // world by the scene — this module owns what they are, the scene owns where
  // they stand.
  // Held, not just handed over: the cards are armed and released on every open
  // (see `open()` below), which is this module's business rather than the
  // scene's — where they stand is the scene's, when they arrive is the
  // window's.
  const projectCards = buildProjectCards()
  const scene = createRevealScene(canvas, cards, raised, projectCards)

  let isOpen = false
  /** The word the window is currently out of — where it shrinks back to. */
  let openedFrom: HTMLElement | null = null

  /**
   * Phones only, and this query is a copy of the stylesheet's own phone bound
   * — change the two together. It stops short of 900 on purpose: iPads sit at
   * 768-834px wide in portrait, and they keep the untouched tablet layout, the
   * mouse-style look-around and no intro sweep. See the note above that block
   * in style.css.
   *
   * It is not re-evaluated on resize: a device does not change its input model,
   * and rebinding mid-session would risk a listener left behind on a rotate.
   * Both the card drag and the intro sweep hang off it.
   */
  const MOBILE = window.matchMedia('(max-width: 767.98px)')

  /** True only once the window has finished growing; the mouse is ignored until then. */
  let isLookLive = false
  let lookTimer = 0
  /** The row's release, on its own much shorter beat than the look-around. */
  let cardsTimer = 0
  /** True once the row has actually been let go, so a close knows whether there is anything to drop. */
  let areCardsUp = false
  /** True from the moment a close is asked for until the window is closed. */
  let isClosing = false
  /** The scene's own stop, held back until the cards have finished dropping. */
  let settleTimer = 0

  function applyBox(box: Box): void {
    root.style.left = `${box.left}px`
    root.style.bottom = `${box.bottom}px`
    root.style.width = `${box.width}px`
    root.style.height = `${box.height}px`
  }

  /**
   * The opened box: the screen, held `--reveal-inset` off all four edges, so
   * the scene sits in an even frame instead of running to the screen's edges.
   * One token drives all four sides, which is what keeps the margin equal.
   *
   * Percentages, not `vw`/`vh`: they resolve against the viewport minus a
   * classic scrollbar, and the page is always scrollable, so the window can
   * never be grown wider than the visible area.
   */
  function applyOpenBox(): void {
    const inset = 'var(--reveal-inset)'
    root.style.left = inset
    root.style.bottom = inset
    root.style.width = `calc(100% - 2 * ${inset})`
    root.style.height = `calc(100% - 2 * ${inset})`
  }

  function open(trigger: HTMLElement): void {
    if (isOpen) return
    isOpen = true
    isClosing = false
    areCardsUp = false
    openedFrom = trigger

    // Reopened before the last close's scene stop came due — run it now rather
    // than let it fire into the new open and recentre a live view. It is
    // idempotent, and its end state is exactly what an open starts from.
    settleScene()

    // Before anything is painted: the row drops back below its place, ready to
    // rise. Arming on open rather than on close is what makes the cascade play
    // exactly once per open — and it is also what leaves the cards lying below
    // the frame after a close, where the exit drop put them, instead of
    // snapping them back up behind the shrinking window.
    armCardEntrance(projectCards)

    // Phones open with the view already on the far right of the row, ready for
    // the sweep back across it. It has to be aimed now, while the mask is a
    // sliver and the cards are still below the frame — done any later it would
    // read as the scene jerking sideways.
    if (MOBILE.matches) scene.parkAtSweepStart()

    // Sit on the word first, with transitions suppressed so that jump is not
    // animated, and flush it — otherwise the growth would start from wherever
    // the window happened to be left, not from the word that was clicked.
    root.style.transition = 'none'
    applyBox(boxOf(trigger))
    void root.offsetWidth
    root.style.transition = ''

    root.classList.add('is-open')
    root.setAttribute('aria-hidden', 'false')
    trigger.setAttribute('aria-expanded', 'true')
    applyOpenBox()

    // The row goes almost at once, on its own beat — the cards climb from below
    // the frame, so they are still on their way up long after the mask has
    // finished growing, and holding them back only bought an empty pause. Their
    // own transitions carry it from here; nothing per-frame.
    clearTimeout(cardsTimer)
    cardsTimer = window.setTimeout(() => {
      areCardsUp = true
      playCardEntrance(projectCards)
      // On a phone the camera's own pan starts in this same tick, alongside
      // the first card's rise, rather than waiting for the whole cascade to
      // land — see SWEEP_MS in three/reveal.ts for how its length is solved
      // against the cascade's. `setActive` has to run first: `playIntroSweep`
      // is a silent no-op while the scene is still inactive.
      if (MOBILE.matches) {
        isLookLive = true
        scene.setActive(true)
        scene.playIntroSweep()
      }
    }, CARDS_MS)

    // The view is handed over only when the window has finished growing: the
    // mask is a sliver of the screen until then, and a look-around inside it
    // would be aiming a frame nobody can see. Phones are the exception — the
    // block above hands it over at CARDS_MS instead, in step with the cascade
    // and the sweep, so this timer is desktop/tablet only.
    if (!MOBILE.matches) {
      clearTimeout(lookTimer)
      lookTimer = window.setTimeout(() => {
        isLookLive = true
        scene.setActive(true)
      }, OPEN_MS)
    }

    onOpenChange?.(true)
  }

  /**
   * Asked to close, from anywhere — the ×, a click away, Escape, or the row
   * going out of reach. **The row drops and the window closes together**: both
   * are started here, in the same tick, and play over each other.
   *
   * Neither animation is the other's business — the drop is the cards' own CSS
   * transition and the shrink is the window's — so the only thing sequencing
   * them was the timer that used to sit between, and it is gone. Every trigger
   * comes through here, so the drop cannot be skipped by closing some other
   * way, and `isClosing` is what stops a second Escape (or the click that
   * dismissed the ×) firing the close twice.
   */
  function closeWindow(): void {
    if (!isOpen || isClosing) return
    isClosing = true

    // A release still in flight would put the row back up under the close.
    // Nothing to drop if it never went out at all — closed inside the first
    // CARDS_MS, while the row was still armed below the frame.
    clearTimeout(cardsTimer)
    const dropping = areCardsUp
    if (dropping) dropCards(projectCards)

    finishClose(dropping ? CARD_EXIT_MS : 0)
  }

  /**
   * Put the scene away: recentre the camera and leave one still frame on the
   * canvas, ready for the next open.
   *
   * This is the one part of the close that cannot happen at once. `setActive`
   * recentres *instantly* and repaints, so with cards still on screen a view
   * that had been turned would snap the whole row sideways as it closed. It
   * waits out the drop instead, and lands on an empty frame the way it always
   * did.
   */
  function settleScene(): void {
    clearTimeout(settleTimer)
    isLookLive = false
    scene.setActive(false)
  }

  /** The window's own close, unchanged — now running alongside the drop. */
  function finishClose(settleAfter: number): void {
    isOpen = false
    isClosing = false
    areCardsUp = false
    root.classList.remove('is-open')
    root.setAttribute('aria-hidden', 'true')

    // Back into the word it came out of, re-measured in case the layout moved.
    if (openedFrom) {
      openedFrom.setAttribute('aria-expanded', 'false')
      applyBox(boxOf(openedFrom))
      // Don't strand the focus ring on a button inside a window that is going.
      if (root.contains(document.activeElement)) openedFrom.focus()
    }

    // A row that has not been released yet stays armed — the next open arms it
    // again anyway — and one that is on its way down stays down until then too.
    // The scene keeps drawing for as long as those cards are still falling, so
    // the drop is not left playing over a frozen frame.
    clearTimeout(cardsTimer)
    clearTimeout(lookTimer)
    clearTimeout(settleTimer)
    if (settleAfter > 0) settleTimer = window.setTimeout(settleScene, settleAfter)
    else settleScene()

    // Last, so whatever hands the page back its scroll and its loop does it
    // only once this window is genuinely done with them.
    onOpenChange?.(false)
  }

  function bindTrigger(trigger: HTMLElement): void {
    trigger.setAttribute('aria-expanded', 'false')
    trigger.addEventListener('click', (e) => {
      // The click-away listener below would otherwise see this click land
      // outside the window and close what it just opened — the trigger is no
      // longer inside the window, as it was when the card carried it.
      e.stopPropagation()
      open(trigger)
    })
  }

  close.addEventListener('click', (e) => {
    e.stopPropagation() // don't let it read as a click on the window itself
    closeWindow()
  })

  // --- Touch drag: reaching the far cards on a phone ---
  /**
   * The card row is deliberately wider than the frame (see the note on the row
   * overrunning it), which on desktop is fine — the mouse look-around covers
   * the difference. A phone has no pointer to look around with and a much
   * narrower frame, so without this the outer cards simply cannot be reached.
   *
   * It turns the *camera*, through the same sprung yaw the mouse drives, so
   * nothing about the cards themselves changes: not their size, their place on
   * the arc, their spacing or their tilt. The row is not moved; the view is.
   *
   * Bound by `MOBILE`, declared above with the rest of the window's state
   * because `open()` needs it too, for the intro sweep.
   */
  /** Past this much travel the gesture is a drag, and not a tap on a card. */
  const DRAG_SLOP_PX = 8

  if (MOBILE.matches) {
    let lastX = 0
    let travelled = 0
    let dragging = false

    root.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) return
        lastX = e.touches[0].clientX
        travelled = 0
        dragging = true
      },
      { passive: true },
    )

    root.addEventListener(
      'touchmove',
      (e) => {
        if (!dragging || e.touches.length !== 1) return
        const x = e.touches[0].clientX
        const dx = x - lastX
        lastX = x
        travelled += Math.abs(dx)
        scene.dragBy(dx)
      },
      { passive: true },
    )

    const endDrag = (): void => {
      dragging = false
    }
    root.addEventListener('touchend', endDrag, { passive: true })
    root.addEventListener('touchcancel', endDrag, { passive: true })

    // A drag that started on a card would otherwise finish as a tap on it, and
    // on VIEW that opens a tab the reader never asked for. Capture, so it is
    // settled before the card's own handlers see it. `travelled` is left as it
    // is — the next touchstart resets it — so a genuine tap, which never
    // accumulates any, always passes straight through.
    root.addEventListener(
      'click',
      (e) => {
        if (travelled <= DRAG_SLOP_PX) return
        e.preventDefault()
        e.stopPropagation()
      },
      true,
    )
  }

  // Click-away and Escape, the two patterns expected of an expanded preview.
  // One permanent listener each.
  document.addEventListener('click', (e) => {
    if (isOpen && !root.contains(e.target as Node)) closeWindow()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeWindow()
  })

  function update(state: InputState): void {
    // Only while the window is open and grown; the scene draws nothing at
    // all otherwise, and skips the draw even then if the view has not moved.
    if (isLookLive) scene.update(state)
  }

  function setInteractive(active: boolean): void {
    if (!active) closeWindow()
  }

  return { bindTrigger, setInteractive, update, resize: scene.resize }
}
