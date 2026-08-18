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
  playCardEntrance,
} from './project-cards'

/**
 * How long after opening the look-around starts, in ms. Matches
 * --reveal-duration in style.css: the 3D view only responds once the window
 * has finished growing.
 */
const OPEN_MS = 620

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
 */
export function createRevealWindow(parent: HTMLElement): RevealWindow {
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

  /** True only once the window has finished growing; the mouse is ignored until then. */
  let isLookLive = false
  let lookTimer = 0

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
    openedFrom = trigger

    // Before anything is painted: the row drops back below its place, ready to
    // rise. Arming on open rather than on close is what makes the cascade play
    // exactly once per open — and it leaves the cards standing while the window
    // shrinks back into its word, so they go with it rather than blinking out
    // from under it.
    armCardEntrance(projectCards)

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

    // Hand the view over only when the window has finished growing, and start
    // the cascade on the same beat: the mask is still a sliver of the screen
    // until then, so a row rising behind it would be over before it could be
    // seen. The cards' own transitions carry it from here — nothing per-frame.
    clearTimeout(lookTimer)
    lookTimer = window.setTimeout(() => {
      isLookLive = true
      scene.setActive(true)
      playCardEntrance(projectCards)
    }, OPEN_MS)
  }

  function closeWindow(): void {
    if (!isOpen) return
    isOpen = false
    root.classList.remove('is-open')
    root.setAttribute('aria-hidden', 'true')

    // Back into the word it came out of, re-measured in case the layout moved.
    if (openedFrom) {
      openedFrom.setAttribute('aria-expanded', 'false')
      applyBox(boxOf(openedFrom))
      // Don't strand the focus ring on a button inside a window that is going.
      if (root.contains(document.activeElement)) openedFrom.focus()
    }

    // Stop rendering at once. The scene recentres its camera and leaves one
    // still frame on the canvas, ready for the next open.
    clearTimeout(lookTimer)
    isLookLive = false
    scene.setActive(false)
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
