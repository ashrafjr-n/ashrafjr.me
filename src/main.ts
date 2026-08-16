/**
 * App entry: mounts the page's elements, starts the scenes and runs the single
 * RAF loop.
 *
 * The loop reads one number — the smoothed scroll progress the 3D scene
 * returns — and drives the DOM side of the Scene 1 -> Scene 2 transition off
 * exactly that value, so nothing here can drift out of sync with the camera,
 * the spin or the stars. Never read `state.scroll` directly for animation.
 */
import './style.css'
import { clamp } from './lib/math'
import { initScene } from './three/scene'
import { state, initPointer, initScroll } from './lib/state'
import { buildSocialBadges } from './ui/social'
import { createRevealWindow } from './ui/reveal-window'

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

/**
 * Fade fraction above which the reveal window accepts input. The row is still
 * arriving below that, so the window is inert (and untouchable) until Scene 2
 * has effectively landed.
 */
const REVEAL_ACTIVE_AT = 0.9

/** How many cards sit in the Scene 2 row. They share one outer boundary. */
const SCENE2_CARD_COUNT = 2

/** Scene 1 intro line, centred near the top of the viewport above the model. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
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
app.append(canvas, intro, scene2Cards)

// --- Starfield + model, and the input they read ---
const scene = initScene(canvas)

// The reveal window mounts itself here, over the last card in the row — the one
// it covers — and brings its own 3D layer with it. The badges go on last so
// they stay the topmost element.
const revealWindow = createRevealWindow(scene2Cards.lastElementChild as HTMLDivElement, app)
app.append(buildSocialBadges())

window.addEventListener('resize', () => {
  scene.resize()
  revealWindow.resize()
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
  const t = clamp((progress - CARDS_FADE_START) / (1 - CARDS_FADE_START), 0, 1)
  if (Math.abs(t - cardsShown) < 0.002) return // skip redundant style writes
  cardsShown = t
  scene2Cards.style.opacity = String(t)
  revealWindow.setOpacity(t)

  const active = t > REVEAL_ACTIVE_AT
  scene2Cards.classList.toggle('is-live', active) // lets the cards take hover
  // Scrolling back toward Scene 1 also puts an open window away, rather than
  // leaving a preview fading over the transition.
  revealWindow.setInteractive(active)
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
function raf(time: number) {
  const progress = scene.update(time, state)
  updateIntro(progress)
  updateScene2Cards(progress)
  revealWindow.update(state)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
