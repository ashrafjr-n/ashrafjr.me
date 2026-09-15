/**
 * App entry: mounts the page's elements, starts the scenes and runs the single
 * RAF loop.
 *
 * The loop reads one number — the smoothed page scroll the 3D scene returns —
 * splits it into scenes with `lib/phases.ts`, and drives the DOM side (intro,
 * identity) off exactly that value, so nothing here can drift out of sync
 * with the spin or the stars. Never read `state.scroll` directly for animation.
 */
import './style.css'
import { toIdentity, toTransition } from './lib/phases'
import { initScene } from './three/scene'
import { lockScroll, unlockScroll } from './lib/scroll-lock'
import { state, initPointer, initScroll } from './lib/state'
import { buildSocialBadges } from './ui/social'
import { createIdentity } from './ui/identity'
import { createRevealWindow } from './ui/reveal-window'

/**
 * Scroll progress at which the intro line has fully gone. It clears early in
 * the transition so it is never left hanging over Scene 2.
 */
const INTRO_FADE_END = 0.28
/** How far the line drifts upward as it goes, in px. */
const INTRO_DRIFT = 70

/** Scene 1 intro line, dead centre of the viewport, inside the ring. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
}

// --- Mount ---
const app = document.querySelector<HTMLDivElement>('#app')!

/** Background WebGL canvas — fixed, full-screen, sits below everything else. */
const canvas = document.createElement('canvas')
canvas.id = 'scene'

const intro = buildIntro()
const identity = createIdentity()
app.append(canvas, intro, identity.el)

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

// The reveal window (the projects preview) mounts itself here and brings its own
// 3D layer with it. Nothing is bound to open it for now — the folders that did
// were removed, and what replaces them is still to be decided.
const revealWindow = createRevealWindow(app, setPageTakenOver)
app.append(buildSocialBadges())

window.addEventListener('resize', () => {
  scene.resize()
  revealWindow.resize()
})

initPointer()
initScroll()

let introShown = -1

/** Fade and lift the intro line, driven by the same progress as the scene. */
function updateIntro(progress: number): void {
  const t = Math.min(progress / INTRO_FADE_END, 1)
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, calc(-50% - ${t * INTRO_DRIFT}px))`
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
//
// It keeps running while the reveal window is open — it is still the only loop
// in the app — but everything belonging to the covered page is skipped, and
// only the window's own scene is advanced. The scroll is frozen while that is
// true, so `progress` could not have moved anyway; skipping it is what also
// stops the model's spin from running unseen.
function raf(time: number) {
  if (!isPaused) {
    const page = scene.update(time, state)
    const progress = toTransition(page)
    updateIntro(progress)
    identity.update(toIdentity(page))
  }
  revealWindow.update(state)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
