/**
 * The opening: a figure balanced on a rope down the middle of the screen, night
 * to its right and day to its left, and the two buttons that pick a side.
 *
 * Picking one carries the rope and the figure out past the opposite edge, and
 * the world behind them opens across the whole screen. `update()` returns the
 * rope's x in CSS pixels, and that one number is both where the rope is drawn
 * and where `three/scene.ts` splits the canvas into stars and sky — so the seam
 * can never drift off the rope.
 */
import { clamp } from '../lib/math'

export type World = 'split' | 'night' | 'day'

/** Seconds for the rope to cross from the middle to off-screen. */
const TRAVEL = 1.9
/** How far past the edge the rope goes, in viewport heights: the figure's half-width and a margin. */
const CLEAR = 0.32
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

// Lucide `arrow-left` / `arrow-right` (ISC).
const svg = (d: string): string =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const ARROW_LEFT = svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>')
const ARROW_RIGHT = svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>')

function sideButton(side: 'left' | 'right', icon: string, label: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `side side--${side}`
  b.innerHTML = `<span class="side-ring">${icon}</span><span class="side-label">${label}</span>`
  return b
}

/** Ease in and out with zero acceleration at both ends — no jolt on start or landing. */
function smoother(u: number): number {
  const x = clamp(u, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

export interface Split {
  /** The rope and the figure. */
  el: HTMLDivElement
  /** The side buttons and the back button. */
  controls: HTMLDivElement
  /** Where the page is headed. */
  target(): World
  /** How far open each world is, 0..1: night > 0 means the rope has moved left. */
  night(): number
  day(): number
  go(world: World): void
  /** Advance the rope. Returns its x in CSS pixels. */
  update(time: number): number
}

export function createSplit(): Split {
  const el = document.createElement('div')
  el.className = 'rope-layer'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML =
    '<img class="rope" src="/assets/hero/h.png" alt="" decoding="async">' +
    '<img class="figure" src="/assets/hero/pro.png" alt="" decoding="async">'

  const controls = document.createElement('div')
  controls.className = 'sides'
  const dayBtn = sideButton('left', ARROW_LEFT, 'ABOUT<br>ME')
  const nightBtn = sideButton('right', ARROW_RIGHT, 'MY<br>WORK')
  const backBtn = sideButton('left', ARROW_RIGHT, 'BACK')
  backBtn.classList.add('side--back')
  controls.append(dayBtn, nightBtn, backBtn)

  /** -1 night (rope gone left), 0 split, +1 day (rope gone right). */
  let s = 0
  let from = 0
  let to = 0
  let startedAt = -1
  let goal: World = 'split'
  let now = 0

  function go(world: World): void {
    if (world === goal) return
    goal = world
    from = s
    to = world === 'night' ? -1 : world === 'day' ? 1 : 0
    startedAt = now
    dayBtn.classList.toggle('is-shown', world === 'split')
    nightBtn.classList.toggle('is-shown', world === 'split')
    backBtn.classList.remove('is-shown')
  }

  dayBtn.addEventListener('click', () => go('day'))
  nightBtn.addEventListener('click', () => go('night'))
  backBtn.addEventListener('click', () => go('split'))
  dayBtn.classList.add('is-shown')
  nightBtn.classList.add('is-shown')

  let drawnX = NaN

  function update(time: number): number {
    now = time
    if (startedAt >= 0) {
      const span = TRAVEL * Math.abs(to - from) * 1000
      const u = REDUCED_MOTION.matches || span === 0 ? 1 : (time - startedAt) / span
      s = from + (to - from) * smoother(u)
      if (u >= 1) {
        startedAt = -1
        if (goal !== 'split') {
          // The back button waits at the edge the rope left by, pointing it home.
          const left = goal === 'night'
          backBtn.classList.toggle('side--left', left)
          backBtn.classList.toggle('side--right', !left)
          backBtn.querySelector('.side-ring')!.innerHTML = left ? ARROW_RIGHT : ARROW_LEFT
          backBtn.classList.add('is-shown')
        }
      }
    }
    const w = window.innerWidth
    const x = w / 2 + s * (w / 2 + CLEAR * window.innerHeight)
    if (x !== drawnX) {
      drawnX = x
      el.style.translate = `${x.toFixed(1)}px 0`
    }
    return x
  }

  return {
    el,
    controls,
    target: () => goal,
    night: () => clamp(-s, 0, 1),
    day: () => clamp(s, 0, 1),
    go,
    update,
  }
}
