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
 * Scroll progress at which the Scene 2 row starts appearing. It belongs to
 * Scene 2 only, so it stays fully invisible through Scene 1 and the bulk of
 * the transition and is only there once the camera has settled.
 */
const ROW_FADE_START = 0.82

/**
 * Fade fraction above which the row's words accept input. The row is still
 * arriving below that, so they are inert (and untouchable) until Scene 2 has
 * effectively landed.
 */
const ROW_ACTIVE_AT = 0.9

/** The ASCII-art portrait at the centre of the Scene 2 row. */
const MARK_SRC = '/assets/svg/me.svg'

/** Scene 1 intro line, centred near the top of the viewport above the model. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
}

/** One of the row's words. A real button, so Enter/Space come for free. */
function buildRowWord(text: string): HTMLButtonElement {
  const word = document.createElement('button')
  word.className = 'scene2-word'
  word.type = 'button'
  word.textContent = text
  return word
}

/**
 * Scene 2 row: bottom-centre, below the model in the levelled Scene 2 view.
 * CONTACT, the portrait, PROJECTS — three elements on one line, vertically
 * centred on each other. No cards, no frames, no dividers: the two flush
 * bordered cards that used to be here were removed deliberately, so nothing in
 * this row may grow a background, border or rectangle of its own.
 */
function buildScene2Row(): { row: HTMLDivElement; contact: HTMLButtonElement; projects: HTMLButtonElement } {
  const row = document.createElement('div')
  row.className = 'scene2-row'

  const contact = buildRowWord('CONTACT')
  const projects = buildRowWord('PROJECTS')

  const mark = document.createElement('img')
  mark.className = 'scene2-mark'
  mark.src = MARK_SRC
  mark.alt = 'ASCII-art portrait of Ashraf'
  mark.draggable = false

  row.append(contact, mark, projects)
  return { row, contact, projects }
}

// --- Mount ---
const app = document.querySelector<HTMLDivElement>('#app')!

/** Background WebGL canvas — fixed, full-screen, sits below everything else. */
const canvas = document.createElement('canvas')
canvas.id = 'scene'

const intro = buildIntro()
const { row: scene2Row, contact, projects } = buildScene2Row()
app.append(canvas, intro, scene2Row)

// --- Starfield + model, and the input they read ---
const scene = initScene(canvas)

// The reveal window mounts itself here and brings its own 3D layer with it. It
// has no resting box on screen: it grows out of whichever word opened it.
// CONTACT is wired to the same window as a placeholder — there is no contact
// content of its own yet.
const revealWindow = createRevealWindow(app)
revealWindow.bindTrigger(projects)
revealWindow.bindTrigger(contact)
app.append(buildSocialBadges())

window.addEventListener('resize', () => {
  scene.resize()
  revealWindow.resize()
})

initPointer()
initScroll()

let introShown = -1
let rowShown = -1

/** Fade and lift the intro line, driven by the same progress as the scene. */
function updateIntro(progress: number): void {
  const t = Math.min(progress / INTRO_FADE_END, 1)
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, ${-t * INTRO_DRIFT}px)`
}

/**
 * Fade the Scene 2 row in, off the same progress as everything else. The
 * reveal window is not part of the row and carries no opacity of its own here:
 * it is invisible until it is opened, which only the row's live words can do.
 */
function updateScene2Row(progress: number): void {
  const t = clamp((progress - ROW_FADE_START) / (1 - ROW_FADE_START), 0, 1)
  if (Math.abs(t - rowShown) < 0.002) return // skip redundant style writes
  rowShown = t
  scene2Row.style.opacity = String(t)

  const active = t > ROW_ACTIVE_AT
  scene2Row.classList.toggle('is-live', active) // lets the words take the pointer
  // Scrolling back toward Scene 1 also puts an open window away, rather than
  // leaving a preview over the transition.
  revealWindow.setInteractive(active)
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
function raf(time: number) {
  const progress = scene.update(time, state)
  updateIntro(progress)
  updateScene2Row(progress)
  revealWindow.update(state)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
