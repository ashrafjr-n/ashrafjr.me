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
const ARROW_UP = svg('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>')
const ARROW_DOWN = svg('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>')

/**
 * Scroll picks a side: down opens the night, up opens the day, and the
 * opposite direction brings a world back to the split. **One gesture, one
 * transition** — the gesture triggers the same timed move the buttons do and
 * never scrubs it. `WHEEL_STEP` px of wheel in one direction fires it; after
 * that input is ignored until the move has landed *and* the wheel has been
 * quiet for `QUIET_MS`, which is what swallows a trackpad's inertia tail so
 * one swipe cannot open a world and close it again.
 */
const WHEEL_STEP = 40
const SWIPE_STEP = 50
const QUIET_MS = 260
const KEYS_DOWN = new Set(['ArrowDown', 'PageDown', ' '])
const KEYS_UP = new Set(['ArrowUp', 'PageUp'])

function sideButton(
  side: 'left' | 'right',
  world: 'day' | 'night',
  icon: string,
  label: string,
): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `side side--${side} side--${world}`
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
  /** Let wheel, touch and the scroll keys pick a side while `canNavigate()`. */
  bindScroll(canNavigate: () => boolean): void
  /** Advance the rope. Returns its x in CSS pixels. */
  update(time: number): number
}

export function createSplit(): Split {
  const el = document.createElement('div')
  el.className = 'rope-layer'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML =
    '<img class="rope rope--top" src="/assets/hero/h.png" alt="" decoding="async">' +
    '<img class="rope rope--bottom" src="/assets/hero/h.png" alt="" decoding="async">' +
    '<img class="figure" src="/assets/hero/pro.png" alt="" decoding="async">'

  const controls = document.createElement('div')
  controls.className = 'sides'
  // The labels name the gesture; the buttons stay clickable for a keyboard or
  // anyone who never scrolls.
  const dayBtn = sideButton('left', 'day', ARROW_UP, 'SCROLL<br>UP')
  const nightBtn = sideButton('right', 'night', ARROW_DOWN, 'SCROLL<br>DOWN')
  const backBtn = sideButton('left', 'night', ARROW_UP, 'BACK')
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
    // The picked button shows its arrow as it leaves; the other just fades.
    dayBtn.classList.toggle('is-picked', world === 'day')
    nightBtn.classList.toggle('is-picked', world === 'night')
    backBtn.classList.toggle('is-picked', world === 'split' && backBtn.classList.contains('is-shown'))
    backBtn.classList.remove('is-shown')
  }

  dayBtn.addEventListener('click', () => go('day'))
  nightBtn.addEventListener('click', () => go('night'))
  backBtn.addEventListener('click', () => go('split'))
  dayBtn.classList.add('is-shown')
  nightBtn.classList.add('is-shown')

  let drawnX = NaN
  /** Set by a gesture; cleared once the move has landed and input is quiet. */
  let locked = false
  let lastInput = -Infinity
  let wheelSum = 0

  /** +1 is scrolling down, -1 up. */
  function step(dir: number): void {
    const next: World | null =
      dir > 0
        ? goal === 'split' ? 'night' : goal === 'day' ? 'split' : null
        : goal === 'split' ? 'day' : goal === 'night' ? 'split' : null
    if (!next) return
    go(next)
    locked = true
  }

  function bindScroll(canNavigate: () => boolean): void {
    window.addEventListener(
      'wheel',
      (e) => {
        if (!canNavigate()) return
        const t = performance.now()
        if (t - lastInput > QUIET_MS) wheelSum = 0
        lastInput = t
        if (locked) return
        // `deltaMode` is lines (1) or pages (2) on some mice in Firefox.
        wheelSum += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1)
        if (Math.abs(wheelSum) < WHEEL_STEP) return
        step(Math.sign(wheelSum))
        wheelSum = 0
      },
      { passive: true },
    )
    let touchY = NaN
    window.addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true })
    window.addEventListener(
      'touchend',
      (e) => {
        const dy = touchY - e.changedTouches[0].clientY
        touchY = NaN
        if (!canNavigate() || locked || !(Math.abs(dy) >= SWIPE_STEP)) return
        lastInput = performance.now()
        step(Math.sign(dy)) // finger up = scroll down
      },
      { passive: true },
    )
    window.addEventListener('keydown', (e) => {
      if (!canNavigate() || locked || e.defaultPrevented) return
      const dir = KEYS_DOWN.has(e.key) ? 1 : KEYS_UP.has(e.key) ? -1 : 0
      // Space on a focused button is that button's own press.
      if (!dir || (e.key === ' ' && (e.target as Element).closest?.('button, a'))) return
      e.preventDefault()
      lastInput = performance.now()
      step(dir)
    })
  }

  function update(time: number): number {
    now = time
    if (locked && startedAt < 0 && time - lastInput > QUIET_MS) locked = false
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
          // Coloured for the world it sits in.
          backBtn.classList.toggle('side--night', left)
          backBtn.classList.toggle('side--day', !left)
          backBtn.classList.remove('is-picked')
          // Pointing the way the scroll back goes: up out of the night, down out of the day.
          backBtn.querySelector('.side-ring')!.innerHTML = left ? ARROW_UP : ARROW_DOWN
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
    bindScroll,
    update,
  }
}
