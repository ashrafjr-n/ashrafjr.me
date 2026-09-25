/**
 * App entry: mounts the page's elements, starts the scene and runs the single
 * RAF loop.
 */
import './style.css'
import { initScene } from './three/scene'
import { state, initPointer, initScroll } from './lib/state'
import { buildSocialBadges } from './ui/social'
import { createLoader } from './ui/loader'

/** How far the line drifts upward as it goes, in px. */
const INTRO_DRIFT = 70

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
app.append(canvas, intro)

const scene = initScene(canvas)

app.append(buildSocialBadges())

window.addEventListener('resize', () => scene.resize())

initPointer()
initScroll()

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
  scene.update(time, state, window.innerWidth)
  updateIntro(0)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
