/**
 * App entry: mounts the page's elements, starts the scenes and runs the single
 * RAF loop.
 *
 * The page is driven by `ui/split.ts`: the rope's x is read once a frame and
 * handed to the 3D scene as its stars/sky seam, and how far each world is open
 * drives the DOM side (intro, hands, EXPLORE, identity) off that same state.
 */
import './style.css'
import { initScene } from './three/scene'
import { lockScroll, unlockScroll } from './lib/scroll-lock'
import { state, initPointer, initScroll } from './lib/state'
import { buildSocialBadges } from './ui/social'
import { createCursor } from './ui/cursor'
import { createIdentity } from './ui/identity'
import { createExplore } from './ui/explore'
import { createSplit } from './ui/split'
import { createHands } from './ui/hands'
import { createProjects } from './ui/projects'
import { createLoader } from './ui/loader'

/**
 * The statements' share of the day's opening: they set off while the rope is
 * still leaving and finish as the day is fully open. `ui/identity.ts` eases
 * every beat of its own, so this stays linear.
 */
const DAY_FROM = 0.35
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
const split = createSplit()
const hands = createHands()
const identity = createIdentity()
const explore = createExplore()
app.append(canvas, split.el, hands.el, intro, identity.el, explore.el, split.controls)

// --- Starfield + model, and the input they read ---
const scene = initScene(canvas)

/**
 * Whether the site behind the projects page is standing still.
 *
 * The page covers the screen, so while it is open there is nothing back there
 * to see: the starfield and every scene are paused. It is one flag rather than
 * a stopped loop — see `raf()` below.
 */
let isPaused = false

/**
 * Hand the site over to the projects page, and take it back.
 *
 * Three things go with it. The scroll, because the scenes underneath are
 * driven by scroll position and the viewer would close the page to find
 * themselves somewhere else entirely — only the page's own list stays
 * scrollable. The loop, because every frame spent on a scene nobody can see is
 * wasted. And the inverting pointer, which is parked: the projects page keeps
 * the system cursor, and the sheet rising over EXPLORE sends it no
 * `pointerleave`, so the disc would stay live from the click that opened it.
 */
function setPageTakenOver(open: boolean): void {
  if (open) {
    lockScroll(projects.scroller)
    isPaused = true
    cursor.hide()
    return
  }
  // Order matters on the way back: the clock is re-anchored before any frame
  // can run, so the paused stretch is never spent, and the scroll is handed
  // back at exactly the position it was taken at.
  scene.resync()
  isPaused = false
  unlockScroll()
}

const socialBadges = buildSocialBadges()
app.append(socialBadges)

// Over everything but the social badges and the pointer. EXPLORE opens it.
const projects = createProjects(app, setPageTakenOver, [socialBadges])
explore.el.addEventListener('click', projects.open)

// **Last of everything, and it has to stay last.** The pointer negates what is
// painted under it, so anything mounted after it — or given a z-index above its
// 100 — is simply not inverted. See ui/cursor.ts for the other half of that
// rule: nothing on the way up to `<html>` may create a stacking context.
const cursor = createCursor(app, explore.el)

window.addEventListener('resize', () => scene.resize())
// Escape leaves a world. Capture phase, so it runs before the projects page's
// own Escape closes it — `isPaused` is still true then and this stands aside.
window.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && !isPaused) split.go('split')
  },
  { capture: true },
)

initPointer()
initScroll()
// Wheel, touch and the scroll keys pick a side too. Not while the loader is up
// or the projects page covers the site.
split.bindScroll(() => loaderGone && !isPaused)

let introShown = -1

/** Fade and lift the intro line as a world opens. */
function updateIntro(t: number): void {
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, ${-t * INTRO_DRIFT}px)`
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
//
// It keeps running while the projects page is open, but everything belonging
// to the covered site is skipped. The scroll is frozen while that is true, so
// `progress` could not have moved anyway; skipping it is what also stops the
// stars' drift from running unseen.
function raf(time: number) {
  if (!loaderGone) loaderGone = loader.update(time)
  if (!isPaused) {
    const ropeX = split.update(time)
    scene.update(time, state, ropeX)
    // Everything below reads the one scroll-driven value, through `night` and
    // `day`, so the whole scene moves with the scroll and stops with it.
    const night = split.night()
    const day = split.day()
    updateIntro(Math.max(night, day))
    hands.set(night)
    explore.set(night)
    identity.update(Math.max(0, (day - DAY_FROM) / (1 - DAY_FROM)), time)
  }
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
