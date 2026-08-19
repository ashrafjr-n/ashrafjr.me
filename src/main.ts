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
import { lockScroll, unlockScroll } from './lib/scroll-lock'
import { state, initPointer, initScroll } from './lib/state'
import { buildSocialBadges } from './ui/social'
import { createMark, type Mark } from './ui/mark'
import { createFolderIcon } from './ui/folder'
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

/** Scene 1 intro line, centred near the top of the viewport above the model. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
}

/**
 * One of the row's words. A real button, so Enter/Space come for free.
 *
 * `modifier` names the word for CSS. It carries nothing on desktop; the mobile
 * layout stacks the two in a column and needs to order them by identity, and
 * `nth-of-type` would tie that to where they happen to sit in the DOM.
 *
 * On tablets and desktop the button holds a folder icon (`ui/folder.ts`)
 * above the label; on phones the icon is hidden by CSS (`.scene2-folder-icon`
 * defaults to `display: none`, shown again only from the `min-width: 768px`
 * block) and the button reads as plain text, exactly as it did before —
 * mobile's layout and behaviour are untouched. The label lives in its own
 * span rather than as the button's direct text so the icon can sit beside it;
 * it carries no styling of its own; every font/color rule still comes from
 * `.scene2-word` and is inherited.
 */
function buildRowWord(text: string, modifier: string): HTMLButtonElement {
  const word = document.createElement('button')
  word.className = `scene2-word scene2-word--${modifier}`
  word.type = 'button'

  const label = document.createElement('span')
  label.className = 'scene2-folder-label'
  label.textContent = text

  word.append(createFolderIcon(), label)
  return word
}

/**
 * Scene 2 row: SYSTEM, the portrait, PROJECTS — three elements on one line,
 * vertically centred on each other. Horizontally centred on the screen too,
 * below the model in the levelled phone view and above the bottom-anchored
 * model from 768px up (style.css decides which). No cards, no frames, no
 * dividers: the two flush
 * bordered cards that used to be here were removed deliberately, so nothing in
 * this row may grow a background, border or rectangle of its own.
 */
function buildScene2Row(): {
  row: HTMLDivElement
  projects: HTMLButtonElement
  mark: Mark
} {
  const row = document.createElement('div')
  row.className = 'scene2-row'

  // SYSTEM is still deliberately inert as far as the projects reveal window
  // goes: it is built and styled exactly like PROJECTS but is not returned,
  // so nothing can bind it to that window. It does get the same click
  // plumbing PROJECTS gets from bindTrigger (stopPropagation, so a future
  // click-away listener doesn't fight it) so it is ready to be pointed at its
  // own target the moment one exists.
  const system = buildRowWord('SYSTEM', 'system')
  system.addEventListener('click', (e) => {
    e.stopPropagation()
  })
  const projects = buildRowWord('PROJECTS', 'projects')
  // The portrait draws and wipes itself; it is advanced from the RAF loop below
  // and only runs while the row is on screen.
  const mark = createMark('ASCII-art portrait of Ashraf')

  row.append(system, mark.el, projects)
  return { row, projects, mark }
}

// --- Mount ---
const app = document.querySelector<HTMLDivElement>('#app')!

/** Background WebGL canvas — fixed, full-screen, sits below everything else. */
const canvas = document.createElement('canvas')
canvas.id = 'scene'

const intro = buildIntro()
const { row: scene2Row, projects, mark } = buildScene2Row()
app.append(canvas, intro, scene2Row)

// --- Starfield + model, and the input they read ---
const scene = initScene(canvas)

/**
 * Whether the site behind the reveal window is standing still.
 *
 * The window covers the screen, so while it is open there is nothing back there
 * to see: Scene 1's starfield, model and transition are all paused, and only
 * the window's own scene keeps drawing. It is one flag rather than a second
 * loop — see `raf()` below.
 */
let isPaused = false

/**
 * Hand the page over to the window, and take it back.
 *
 * Two things go with it. The scroll, because the transition underneath is
 * driven by scroll position and nothing in the covered page would show it
 * moving — the viewer would close the window to find themselves somewhere else
 * entirely. And the loop, because every frame it spends on a scene nobody can
 * see is wasted, and because a spin that kept turning behind the window would
 * be a jump on the way back rather than continuity.
 */
function setPageTakenOver(open: boolean): void {
  if (open) {
    lockScroll()
    isPaused = true
    return
  }
  // Order matters on the way back: the clock is re-anchored before any frame
  // can run, so the paused stretch is never spent, and the scroll is handed
  // back at exactly the position it was taken at.
  scene.resync()
  isPaused = false
  unlockScroll()
}

// The reveal window mounts itself here and brings its own 3D layer with it. It
// has no resting box on screen: it grows out of the word that opened it, and
// PROJECTS is the only word that opens it.
const revealWindow = createRevealWindow(app, setPageTakenOver)
revealWindow.bindTrigger(projects)
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
//
// It keeps running while the reveal window is open — it is still the only loop
// in the app — but everything belonging to the covered page is skipped, and
// only the window's own scene is advanced. The scroll is frozen while that is
// true, so `progress` could not have moved anyway; skipping it is what also
// stops the model's spin and the portrait's cycle from running unseen.
function raf(time: number) {
  if (!isPaused) {
    const progress = scene.update(time, state)
    updateIntro(progress)
    updateScene2Row(progress)
    // `rowShown` is the row's own fade, so the portrait animates exactly while
    // Scene 2 is on screen and rewinds whenever it is scrolled away.
    mark.update(time, rowShown > 0)
  }
  revealWindow.update(state)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
