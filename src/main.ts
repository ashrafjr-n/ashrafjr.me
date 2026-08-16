import './style.css'
import { initScene } from './three/scene'
import { createRevealScene } from './three/reveal'
import { state, initPointer, initScroll } from './lib/state'
import { buildSocialBadges } from './ui/social'

/**
 * Scroll progress at which the intro line has fully gone. It clears early in
 * the transition so it is never left hanging over Scene 2.
 */
const INTRO_FADE_END = 0.28
/** How far the line drifts upward as it goes, in px. */
const INTRO_DRIFT = 70

/**
 * Scroll progress at which the Scene 2 cards start appearing. They belong to
 * Scene 2 only, so they stay fully invisible through Scene 1 and the bulk of
 * the transition and are only there once the camera has settled.
 */
const CARDS_FADE_START = 0.82

/** Scene 1 intro line, centred near the top of the viewport above the model. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
}

/** How many cards sit in the Scene 2 row. They share one outer boundary. */
const SCENE2_CARD_COUNT = 2

/**
 * How long after opening the look-around starts, in ms. Matches
 * --reveal-duration in style.css: the 3D view only responds once the window
 * has finished growing.
 */
const REVEAL_OPEN_MS = 620

/** Widest tilt of the canvas under the mouse, in degrees, either side of centre. */
const REVEAL_TILT_MAX = 5
/** Per-frame approach rate of the tilt toward its target — damped, not jumpy. */
const REVEAL_TILT_LERP = 0.12
/**
 * Fade fraction above which the window accepts input. The row is still
 * arriving below that, so the window is inert (and untouchable) until Scene 2
 * has effectively landed.
 */
const REVEAL_ACTIVE_AT = 0.9

/**
 * The reveal window: a fixed-position mask that sits exactly on the right card
 * and holds an image far larger than itself. Kept out of the row because the
 * card is a flex item and could not fly out to the corner; the CSS derives its
 * closed geometry from the row's tokens so the two line up.
 */
function buildRevealWindow(): {
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
 * Scene 2 card row: bottom-centre, below the model in the levelled Scene 2
 * view. The cards are flush — one white boundary around the pair and a single
 * white line between them, so they read as one wide rectangle split in two.
 * Empty for now.
 */
function buildScene2Cards(): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'scene2-cards'
  for (let i = 0; i < SCENE2_CARD_COUNT; i++) {
    const card = document.createElement('div')
    card.className = 'scene2-card'
    row.append(card)
  }
  return row
}

// --- Mount ---
const app = document.querySelector<HTMLDivElement>('#app')!

/** Background WebGL canvas — fixed, full-screen, sits below everything else. */
const canvas = document.createElement('canvas')
canvas.id = 'scene'

const intro = buildIntro()
const scene2Cards = buildScene2Cards()
const reveal = buildRevealWindow()
/** The card the reveal window sits on: the last one in the row. */
const revealCard = scene2Cards.lastElementChild as HTMLDivElement
app.append(canvas, intro, scene2Cards, reveal.root, buildSocialBadges())

// --- Starfield + model, and the input they read ---
const scene = initScene(canvas)

// The reveal window's own 3D layer: its own renderer, scene and camera, sharing
// nothing with the Scene 1 starfield above. Built once here and reused for
// every open, so reopening allocates nothing.
const revealScene = createRevealScene(reveal.canvas)

window.addEventListener('resize', () => {
  scene.resize()
  revealScene.resize()
})

initPointer()
initScroll()

let introShown = -1
let cardsShown = -1

/** Fade and lift the intro line, driven by the same progress as the scene. */
function updateIntro(progress: number): void {
  const t = Math.min(progress / INTRO_FADE_END, 1)
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, ${-t * INTRO_DRIFT}px)`
}

/**
 * Fade the Scene 2 cards in, off the same progress as everything else. The
 * reveal window rides the same value — it is a separate element, so it has to
 * be faded and gated by hand rather than inheriting the row's opacity.
 */
function updateScene2Cards(progress: number): void {
  const t = Math.min(Math.max((progress - CARDS_FADE_START) / (1 - CARDS_FADE_START), 0), 1)
  if (Math.abs(t - cardsShown) < 0.002) return // skip redundant style writes
  cardsShown = t
  scene2Cards.style.opacity = String(t)
  reveal.root.style.opacity = String(t)

  const active = t > REVEAL_ACTIVE_AT
  reveal.root.style.pointerEvents = active ? 'auto' : 'none'
  scene2Cards.classList.toggle('is-live', active) // lets the cards take hover
  // Scrolling back toward Scene 1 puts it away rather than leaving an open
  // preview fading over the transition.
  if (!active && isRevealOpen) closeReveal()
}

// --- Reveal window: click to open, mouse tilt while closed, look-around while open ---
let isRevealOpen = false
let tilt = 0
let tiltTarget = 0
let tiltWritten = 0

/** True only once the window has finished growing; the mouse is ignored until then. */
let isLookLive = false
let lookTimer = 0

function openReveal(): void {
  if (isRevealOpen) return
  isRevealOpen = true
  reveal.root.classList.add('is-open')
  reveal.root.setAttribute('aria-expanded', 'true')
  tiltTarget = 0 // the tilt is a closed-state affordance only
  setRevealCardHover(false) // don't leave the card lifted under a full-screen window
  // Hand the view over only when the window is actually full-screen.
  clearTimeout(lookTimer)
  lookTimer = window.setTimeout(() => {
    isLookLive = true
    revealScene.setActive(true)
  }, REVEAL_OPEN_MS)
}

function closeReveal(): void {
  if (!isRevealOpen) return
  isRevealOpen = false
  reveal.root.classList.remove('is-open')
  reveal.root.setAttribute('aria-expanded', 'false')
  // Stop rendering at once. The scene recentres its camera and leaves one still
  // frame on the canvas, which is what the small card goes back to showing.
  clearTimeout(lookTimer)
  isLookLive = false
  revealScene.setActive(false)
}

reveal.root.addEventListener('click', () => {
  if (!isRevealOpen) openReveal()
})

reveal.close.addEventListener('click', (e) => {
  e.stopPropagation() // don't let it read as a click on the window itself
  closeReveal()
})

// Click-away and Escape, the two patterns expected of an expanded preview. One
// permanent listener each: the opening click's target is inside the window, so
// it can never close what it just opened.
document.addEventListener('click', (e) => {
  if (isRevealOpen && !reveal.root.contains(e.target as Node)) closeReveal()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeReveal()
})

// Keyboard equivalent of the click, since the window is a focusable control.
reveal.root.addEventListener('keydown', (e) => {
  if (isRevealOpen || (e.key !== 'Enter' && e.key !== ' ')) return
  e.preventDefault() // Space would otherwise scroll the page
  openReveal()
})

reveal.root.addEventListener(
  'mousemove',
  (e) => {
    if (isRevealOpen) return
    const rect = reveal.root.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1 // -1 left .. 1 right
    tiltTarget = Math.min(Math.max(nx, -1), 1) * REVEAL_TILT_MAX
  },
  { passive: true },
)
reveal.root.addEventListener('mouseleave', () => {
  tiltTarget = 0
  setRevealCardHover(false)
})

/**
 * The right card and the window over it grow together, but they are separate
 * subtrees. The card is left inert (see the pointer-events rule in style.css),
 * so the window's own hover is the single source for both.
 */
function setRevealCardHover(on: boolean): void {
  revealCard.classList.toggle('is-hovered', on)
  reveal.root.classList.toggle('is-hovered', on)
}

reveal.root.addEventListener('mouseenter', () => {
  if (!isRevealOpen) setRevealCardHover(true)
})

/**
 * Damp the closed-state tilt and write it out.
 *
 * A pure CSS rotation of the canvas about its own centre, so it cannot disturb
 * the slice of the 3D view the small card is showing. It settles to exact zero,
 * at which point the inline transform is dropped so nothing is left applied.
 *
 * The open state's motion is not here at all: it is the reveal scene's camera,
 * turning in real 3D (see `three/reveal.ts`).
 */
function updateRevealTilt(): void {
  tilt += (tiltTarget - tilt) * REVEAL_TILT_LERP
  if (tiltTarget === 0 && Math.abs(tilt) < 0.005) tilt = 0
  if (Math.abs(tilt - tiltWritten) < 0.005) return // skip redundant style writes
  tiltWritten = tilt
  reveal.canvas.style.transform =
    tilt === 0 ? '' : `perspective(1400px) rotateY(${tilt.toFixed(2)}deg)`
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
function raf(time: number) {
  const progress = scene.update(time, state)
  updateIntro(progress)
  updateScene2Cards(progress)
  updateRevealTilt()
  // Only while the window is open and full-screen; the scene draws nothing at
  // all otherwise, and skips the draw even then if the view has not moved.
  if (isLookLive) revealScene.update(state)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
