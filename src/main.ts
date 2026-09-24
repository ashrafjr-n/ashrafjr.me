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
import { HOLD, toIdentity, toTransition } from './lib/phases'
import { SCATTER_END, SETTLE_TO } from './lib/scatter'
import { initScene } from './three/scene'
import { SCROLL_KEYS, lockScroll, unlockScroll } from './lib/scroll-lock'
import { state, scroller, initPointer, initScroll } from './lib/state'
import { buildSocialBadges } from './ui/social'
import { createCursor } from './ui/cursor'
import { createIdentity } from './ui/identity'
import { createInvert } from './ui/invert'
import { createExplore } from './ui/explore'
import { createProjects } from './ui/projects'
import { createLoader } from './ui/loader'

/**
 * Scroll progress at which the intro line has fully gone.
 *
 * **Derived rather than picked**, so it cannot drift out of step with the
 * scene it belongs to: it lands where the field finishes settling. The scatter
 * now stops at `SCATTER_END` of Scene 1 rather than running its full stretch,
 * so that share is part of the expression. It was a hand-set 0.28.
 */
const INTRO_FADE_END = HOLD * SCATTER_END * SETTLE_TO
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
const identity = createIdentity()
const invert = createInvert()
const explore = createExplore()
// The inversion panel is appended last of the page's own layers: it blends with
// everything painted before it, so document order is part of what it does.
app.append(canvas, intro, identity.el, invert.el, explore.el)

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
 * the system cursor, and the paused loop would otherwise leave the disc live if
 * EXPLORE was pressed from inside the white half.
 */
function setPageTakenOver(open: boolean): void {
  if (open) {
    lockScroll(projects.scroller)
    isPaused = true
    cursor.update(Infinity)
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
const cursor = createCursor(app)

window.addEventListener('resize', () => scene.resize())

initPointer()
initScroll()
// The page scrolls in `body` rather than the document, and a browser only
// sends the scroll keys to an element once something inside it has focus —
// with nothing focused they go to the document, which cannot scroll. Focusing
// the scroller up front keeps Space / PageDown / the arrows working from the
// first key, as they did when the document scrolled. -1 keeps it out of the
// Tab order.
scroller.tabIndex = -1
scroller.focus({ preventScroll: true })
// The same goes for a key pressed on a focused control. The badges and
// EXPLORE are `position: fixed`, and a browser walks a fixed element's scroll
// chain straight to the document, skipping `body` — so PageUp from EXPLORE
// (where focus lands when the projects page closes) scrolled nothing. Handing
// focus back to the scroller before the key's default action runs is what
// sends it there. Space on a button is that button's own press, and a key the
// scroll lock has refused, or one inside the projects list, is left alone.
window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || !SCROLL_KEYS.has(e.key)) return
  const target = e.target
  if (!(target instanceof HTMLElement) || target === scroller) return
  if (projects.scroller.contains(target)) return
  if (e.key === ' ' && target.closest('button')) return
  scroller.focus({ preventScroll: true })
})

let introShown = -1

/** Fade and lift the intro line, driven by the same progress as the scene. */
function updateIntro(progress: number): void {
  const t = Math.min(progress / INTRO_FADE_END, 1)
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
    const page = scene.update(time, state)
    const progress = toTransition(page)
    updateIntro(progress)
    identity.update(toIdentity(page), time)
    invert.update(page)
    explore.update(page)
    // The disc is the pointer only inside the panel, so it is told where the
    // panel's edge is every frame — it moves under a stationary pointer as the
    // page scrolls. Must follow `invert.update()`, which is what moves it.
    cursor.update(invert.topEdge())
  }
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
