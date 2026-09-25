/**
 * App entry: mounts the page's elements, starts the scene and runs the single
 * RAF loop.
 */
import './style.css'
import { initScene } from './three/scene'
import { range } from './lib/math'
import { state, initPointer, initScroll, scroller } from './lib/state'
import { buildSocialBadges } from './ui/social'
import { createLoader } from './ui/loader'
import { createProjects } from './ui/projects'
import { createTitle } from './ui/title'

/** How far the line drifts upward as it goes, in px. */
const INTRO_DRIFT = 70
/** The share of the journey the intro line takes to leave. */
const INTRO_OUT = 0.1

/** Scene 1 intro line, centred near the top of the viewport. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
}

// First, so the page's scroll is held from the moment the bundle runs.
const loader = createLoader()
let loaderGone = false

// --- Mount ---
const app = document.querySelector<HTMLDivElement>('#app')!

/** Background WebGL canvas — fixed, full-screen, sits below everything else. */
const canvas = document.createElement('canvas')
canvas.id = 'scene'

const intro = buildIntro()
/**
 * The journey's scroll range. Its one child is a screen-high stage that sticks
 * to the top while the journey plays, holding the PROJECTS heading; the list
 * follows it and rises under the heading once the journey is over.
 */
const journey = document.createElement('div')
journey.className = 'journey'
const stage = document.createElement('div')
stage.className = 'journey-stage'
const title = createTitle()
stage.append(title.el)
journey.append(stage)
const projects = createProjects()
app.append(canvas, intro, journey, projects)

const scene = initScene(canvas)

app.append(buildSocialBadges())

window.addEventListener('resize', () => scene.resize())

initPointer()
// With nothing focused the scroll keys go to the document, which never scrolls
// (see `html` in style.css); focused, the body takes them.
scroller.tabIndex = -1
scroller.focus({ preventScroll: true })
// The journey is over when the list's top reaches the bottom of the screen.
initScroll(() => projects.offsetTop - scroller.clientHeight)

let introShown = -1

/** Fade and lift the intro line as the journey starts. */
function updateIntro(t: number): void {
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, ${-t * INTRO_DRIFT}px)`
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
function raf(time: number) {
  if (!loaderGone) loaderGone = loader.update(time)
  const p = scene.update(time, state)
  updateIntro(range(p, 0, INTRO_OUT))
  title.update(p)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
