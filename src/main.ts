import './style.css'
import 'lenis/dist/lenis.css'
import Lenis from 'lenis'
import { initHero } from './sections/hero'
import { initTransition } from './sections/transition'
import { initWork } from './sections/work'
import { initScene } from './three/scene'
import { state, initPointer } from './lib/state'
import { registerSection, updateDepth, getSectionCount } from './lib/depth'

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const app = document.querySelector<HTMLDivElement>('#app')!

// --- Perspective world that holds all depth items ---
const world = document.createElement('div')
world.className = 'world'

// Persistent fixed overlays (canvas, HUD, scroll hint, cinematic layers) +
// the Hero content, which becomes depth item 0.
const { canvas, heroContent, scrollHint } = initHero(app)
app.append(world)

const heroItem = document.createElement('div')
heroItem.className = 'depth-item depth-item--hero'
heroItem.append(heroContent)
world.append(heroItem)
registerSection(heroItem, 0)

// A brief "Selected Work" label becomes depth item 1, between Hero and the
// first project.
initTransition(world, 1)

// Work projects become depth items 2..N+1.
initWork(world, 2)

// --- Invisible scroll proxy: the only thing that generates page height.
//     One extra viewport of trailing distance lets the last section pass. ---
const sectionCount = getSectionCount()
const proxy = document.createElement('div')
proxy.className = 'scroll-proxy'
proxy.style.height = `${(sectionCount + 1) * 100}vh`
app.append(proxy)

// --- Particle starfield (unchanged) ---
const scene = initScene(canvas)
window.addEventListener('resize', () => scene.resize())

// --- Pointer parallax input ---
initPointer()

// --- HUD live readouts ---
const fpsEl = document.querySelector<HTMLElement>('#fps')
const coordEl = document.querySelector<HTMLElement>('#coord')

// --- Smooth scroll (Lenis) reads the scroll proxy ---
const lenis = new Lenis({
  lerp: 0.08, // heavy, cinematic glide
  smoothWheel: true,
  orientation: 'vertical',
})

lenis.on('scroll', (e) => {
  state.scroll = e.scroll
  state.targetVel = e.velocity
})

// Reduced motion keeps the depth navigation but tones down the particle warp.
const velScale = prefersReducedMotion ? 0.25 : 1

// --- Single RAF loop: Lenis -> state -> scene -> depth -> HUD ---
let lastTime = performance.now()
let fps = 60

function raf(time: number) {
  lenis.raf(time)

  // Smooth velocity toward the latest raw value (decays back to 0 when idle).
  state.velocity += (state.targetVel * velScale - state.velocity) * 0.1

  scene.update(time, state)
  updateDepth(state.scroll)

  // Fade the scroll hint out once the camera starts moving.
  scrollHint.classList.toggle('is-hidden', state.scroll > 40)

  // Rough fps estimate from frame delta, smoothed a little.
  const delta = time - lastTime
  lastTime = time
  if (delta > 0) fps += ((1000 / delta) - fps) * 0.1
  if (fpsEl) fpsEl.textContent = String(Math.round(fps))

  // Current scroll position, zero-padded for the cinematic readout.
  if (coordEl) coordEl.textContent = Math.round(state.scroll).toString().padStart(3, '0') + '.000'

  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
