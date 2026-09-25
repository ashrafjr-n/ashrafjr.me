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
import { createThemeSwitch } from './ui/theme'
import { createExplore } from './ui/explore'

/** How far the line drifts upward as it goes, in px. */
const INTRO_DRIFT = 70
/** The share of the journey the intro line takes to leave. */
const INTRO_OUT = 0.1
/** Where EXPLORE leaves the heading once pressed, in screen heights from the top. */
const OPEN_TO = 0.1
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

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
 * to the top while the journey plays, holding PROJECTS and EXPLORE. The list
 * follows it, left out of the page until EXPLORE is pressed.
 */
const journey = document.createElement('div')
journey.className = 'journey'
const stage = document.createElement('div')
stage.className = 'journey-stage'
const title = createTitle()
const projects = createProjects()
projects.hidden = true
/** Open the list, then glide the heading up so the first card comes in under it. */
function openProjects(): void {
  projects.hidden = false
  const top = title.el.getBoundingClientRect().top - window.innerHeight * OPEN_TO
  scroller.scrollBy({ top, behavior: REDUCED_MOTION.matches ? 'instant' : 'smooth' })
}
const explore = createExplore(openProjects)
stage.append(title.el, explore.el)
journey.append(stage)
app.append(canvas, intro, journey, projects)

const scene = initScene(canvas)

const theme = createThemeSwitch()
app.append(buildSocialBadges(), theme.el)

window.addEventListener('resize', () => scene.resize())

initPointer()
// With nothing focused the scroll keys go to the document, which never scrolls
// (see `html` in style.css); focused, the body takes them.
scroller.tabIndex = -1
scroller.focus({ preventScroll: true })
// The journey is the stage's whole stuck stretch: over as it lets go.
initScroll(() => journey.offsetHeight - scroller.clientHeight)

let introShown = -1
let prevTime = performance.now()

/** Fade and lift the intro line as the journey starts. */
function updateIntro(t: number): void {
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, ${-t * INTRO_DRIFT}px)`
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
function raf(time: number) {
  const delta = Math.min((time - prevTime) / 1000, 0.1)
  prevTime = time
  if (!loaderGone) {
    loaderGone = loader.update(time)
    if (loaderGone) theme.show()
  }
  const p = scene.update(time, state, theme.update(delta))
  updateIntro(range(p, 0, INTRO_OUT))
  title.update(p, delta)
  explore.update(p)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
