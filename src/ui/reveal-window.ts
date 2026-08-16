/**
 * Scene 2 reveal window — the project preview shown through the right card.
 *
 * One feature, one module: the element, its open/close behaviour, its
 * closed-state mouse tilt and the 3D layer behind it (`three/reveal.ts`) all
 * live here. `main.ts` only mounts the root, fades it with the rest of Scene 2
 * and calls `update()` from the single RAF loop.
 *
 * The element is a MASK, not a viewport: the canvas inside is always the size
 * of the screen, so opening grows the mask and uncovers more of the same
 * rendered frame. Nothing here may scale or resize that canvas — see the
 * .reveal-window rules in style.css.
 */
import type { InputState } from '../lib/state'
import { createRevealScene } from '../three/reveal'

/**
 * How long after opening the look-around starts, in ms. Matches
 * --reveal-duration in style.css: the 3D view only responds once the window
 * has finished growing.
 */
const OPEN_MS = 620

/** Widest tilt of the canvas under the mouse, in degrees, either side of centre. */
const TILT_MAX = 5
/** Per-frame approach rate of the tilt toward its target — damped, not jumpy. */
const TILT_LERP = 0.12

export interface RevealWindow {
  /** Fade with the rest of Scene 2 — it is not a child of the card row. */
  setOpacity(opacity: number): void
  /**
   * Take or refuse input. Turning it off also puts an open window away, so
   * scrolling back toward Scene 1 never leaves a preview fading over the
   * transition.
   */
  setInteractive(active: boolean): void
  /** Per-frame: the closed-state tilt, and the look-around while open. */
  update(state: InputState): void
  resize(): void
}

/**
 * Build the window's DOM. A fixed-position mask, kept out of the card row
 * because a flex item could not fly out to the corner; the CSS derives its
 * closed geometry from the row's tokens so the two line up.
 */
function buildElements(): {
  root: HTMLDivElement
  canvas: HTMLCanvasElement
  close: HTMLButtonElement
} {
  const root = document.createElement('div')
  root.className = 'reveal-window'
  root.setAttribute('role', 'button')
  root.tabIndex = 0
  root.setAttribute('aria-label', 'Open project preview')
  root.setAttribute('aria-expanded', 'false')

  // Always the size of the viewport, centred on the window, so the closed card
  // shows a slice of the same 3D view the open one fills the screen with — and
  // so opening never has to resize the drawing buffer, only uncover more of it.
  const canvas = document.createElement('canvas')
  canvas.className = 'reveal-canvas'

  const close = document.createElement('button')
  close.className = 'reveal-close'
  close.type = 'button'
  close.setAttribute('aria-label', 'Close project preview')
  close.textContent = '×'

  root.append(canvas, close)
  return { root, canvas, close }
}

/**
 * `card` is the card the window sits on — the right one in the row. It is left
 * inert to the pointer (see the pointer-events rule in style.css), so the
 * window's own hover is the single source of the lift for both of them.
 *
 * The window mounts itself into `parent` rather than leaving that to the
 * caller, because the order matters: the 3D layer draws exactly one still frame
 * at startup and then renders on demand, so its canvas has to be in the page
 * already for that frame to reach the screen.
 */
export function createRevealWindow(card: HTMLElement, parent: HTMLElement): RevealWindow {
  const { root, canvas, close } = buildElements()
  parent.append(root)

  // The window's own 3D layer: its own renderer, scene and camera, sharing
  // nothing with the Scene 1 starfield. Built once and reused for every open,
  // so reopening allocates nothing.
  const scene = createRevealScene(canvas)

  let isOpen = false
  let tilt = 0
  let tiltTarget = 0
  let tiltWritten = 0

  /** True only once the window has finished growing; the mouse is ignored until then. */
  let isLookLive = false
  let lookTimer = 0

  /**
   * The card and the window over it grow together, but they are separate
   * subtrees, so the hover class goes on both by hand.
   */
  function setCardHover(on: boolean): void {
    card.classList.toggle('is-hovered', on)
    root.classList.toggle('is-hovered', on)
  }

  function open(): void {
    if (isOpen) return
    isOpen = true
    root.classList.add('is-open')
    root.setAttribute('aria-expanded', 'true')
    tiltTarget = 0 // the tilt is a closed-state affordance only
    setCardHover(false) // don't leave the card lifted under a full-screen window
    // Hand the view over only when the window is actually full-screen.
    clearTimeout(lookTimer)
    lookTimer = window.setTimeout(() => {
      isLookLive = true
      scene.setActive(true)
    }, OPEN_MS)
  }

  function closeWindow(): void {
    if (!isOpen) return
    isOpen = false
    root.classList.remove('is-open')
    root.setAttribute('aria-expanded', 'false')
    // Stop rendering at once. The scene recentres its camera and leaves one
    // still frame on the canvas, which is what the small card goes back to
    // showing.
    clearTimeout(lookTimer)
    isLookLive = false
    scene.setActive(false)
  }

  root.addEventListener('click', () => {
    if (!isOpen) open()
  })

  close.addEventListener('click', (e) => {
    e.stopPropagation() // don't let it read as a click on the window itself
    closeWindow()
  })

  // Click-away and Escape, the two patterns expected of an expanded preview.
  // One permanent listener each: the opening click's target is inside the
  // window, so it can never close what it just opened.
  document.addEventListener('click', (e) => {
    if (isOpen && !root.contains(e.target as Node)) closeWindow()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeWindow()
  })

  // Keyboard equivalent of the click, since the window is a focusable control.
  root.addEventListener('keydown', (e) => {
    if (isOpen || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault() // Space would otherwise scroll the page
    open()
  })

  root.addEventListener(
    'mousemove',
    (e) => {
      if (isOpen) return
      const rect = root.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1 // -1 left .. 1 right
      tiltTarget = Math.min(Math.max(nx, -1), 1) * TILT_MAX
    },
    { passive: true },
  )

  root.addEventListener('mouseenter', () => {
    if (!isOpen) setCardHover(true)
  })
  root.addEventListener('mouseleave', () => {
    tiltTarget = 0
    setCardHover(false)
  })

  /**
   * Damp the closed-state tilt and write it out.
   *
   * A pure CSS rotation of the canvas about its own centre, so it cannot
   * disturb the slice of the 3D view the small card is showing. It settles to
   * exact zero, at which point the inline transform is dropped so nothing is
   * left applied.
   *
   * The open state's motion is not here at all: it is the reveal scene's
   * camera, turning in real 3D (see `three/reveal.ts`).
   */
  function updateTilt(): void {
    tilt += (tiltTarget - tilt) * TILT_LERP
    if (tiltTarget === 0 && Math.abs(tilt) < 0.005) tilt = 0
    if (Math.abs(tilt - tiltWritten) < 0.005) return // skip redundant style writes
    tiltWritten = tilt
    canvas.style.transform =
      tilt === 0 ? '' : `perspective(1400px) rotateY(${tilt.toFixed(2)}deg)`
  }

  function update(state: InputState): void {
    updateTilt()
    // Only while the window is open and full-screen; the scene draws nothing at
    // all otherwise, and skips the draw even then if the view has not moved.
    if (isLookLive) scene.update(state)
  }

  function setOpacity(opacity: number): void {
    root.style.opacity = String(opacity)
  }

  function setInteractive(active: boolean): void {
    root.style.pointerEvents = active ? 'auto' : 'none'
    if (!active) closeWindow()
  }

  return { setOpacity, setInteractive, update, resize: scene.resize }
}
