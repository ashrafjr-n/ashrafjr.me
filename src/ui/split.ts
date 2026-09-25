/**
 * The opening: a figure balanced on a rope down the middle of the screen, night
 * to its right and day to its left.
 *
 * **Scroll drives it.** One value, `s`, runs from -1 (night open, rope gone
 * left) through 0 (the split) to +1 (day open, rope gone right). The wheel,
 * a touch drag and the keys move its target; `s` follows the target on a
 * critically damped spring, and every element on the page reads `s` — the rope,
 * the figure, the canvas seam, the hands, EXPLORE and the statements — so the
 * whole scene moves *with* the scroll and stops when it stops. Clicking a side
 * glides the target there over `TRAVEL` seconds instead of jumping it.
 *
 * `update()` returns the rope's x in CSS pixels, and that one number is both
 * where the rope is drawn and where `three/scene.ts` splits the canvas into
 * stars and sky — so the seam can never drift off the rope.
 */
import { clamp } from '../lib/math'

export type World = 'split' | 'night' | 'day'

/** How far past the edge the rope goes, in viewport heights: the figure's half-width and a margin. */
const CLEAR = 0.32
/** Wheel pixels to open a world fully from the split — about ten mouse notches. */
const WORLD_PX = 1000
/** A touch drag this many viewport heights long opens a world fully. */
const WORLD_TOUCH = 0.9
/**
 * The spring `s` follows its target on, rad/s. ~0.25s of lag: enough to smooth
 * a wheel's notches into one motion, not so much that it feels detached.
 */
const OMEGA = 8
const MAX_STEP = 1 / 60
/** Seconds a click or a key takes to glide the target to its world. */
const TRAVEL = 1.7
/**
 * Stopping this close to a world (or the split) settles onto it after
 * `SNAP_IDLE_MS` without input, so a scroll that stops a hair short of the end
 * still lands. Anywhere further out stays exactly where it was left.
 */
const SNAP = 0.15
const SNAP_IDLE_MS = 450
const KEYS_DOWN = new Set(['ArrowDown', 'PageDown', ' '])
const KEYS_UP = new Set(['ArrowUp', 'PageUp'])
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

// Lucide `arrow-up` / `arrow-down` (ISC).
const svg = (d: string): string =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const ARROW_UP = svg('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>')
const ARROW_DOWN = svg('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>')

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

const valueOf = (world: World): number => (world === 'night' ? -1 : world === 'day' ? 1 : 0)

export interface Split {
  /** The rope and the figure. */
  el: HTMLDivElement
  /** The side buttons and the back button. */
  controls: HTMLDivElement
  /** How far open each world is, 0..1: night > 0 means the rope has moved left. */
  night(): number
  day(): number
  /** Glide to a world, as a click does. */
  go(world: World): void
  /** Let wheel, touch and the scroll keys drive the scene while `canNavigate()`. */
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

  /** The scene's position, -1..1, and its velocity — the spring. */
  let s = 0
  let vel = 0
  /** Where the scroll has put the scene; `s` chases it. */
  let aim = 0
  /** A click's glide of `aim`, or none. */
  let glideFrom = 0
  let glideTo = 0
  let glideAt = -1
  let now = 0
  let lastInput = -Infinity

  function go(world: World): void {
    glideFrom = aim
    glideTo = valueOf(world)
    glideAt = now
    if (world !== 'split') (world === 'day' ? dayBtn : nightBtn).classList.add('is-picked')
  }

  /** Scrolled by `amount` of a world: positive is down, toward the night. */
  function nudge(amount: number): void {
    glideAt = -1
    aim = clamp(aim - amount, -1, 1)
    lastInput = performance.now()
  }

  dayBtn.addEventListener('click', () => go('day'))
  nightBtn.addEventListener('click', () => go('night'))
  backBtn.addEventListener('click', () => go('split'))

  function bindScroll(canNavigate: () => boolean): void {
    window.addEventListener(
      'wheel',
      (e) => {
        if (!canNavigate()) return
        // `deltaMode` is lines (1) or pages (2) on some mice in Firefox.
        const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1)
        nudge(px / WORLD_PX)
      },
      { passive: true },
    )
    let touchY = NaN
    window.addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true })
    window.addEventListener(
      'touchmove',
      (e) => {
        const y = e.touches[0].clientY
        // Finger up is scrolling down, as on any page.
        if (canNavigate() && touchY === touchY) nudge((touchY - y) / (window.innerHeight * WORLD_TOUCH))
        touchY = y
      },
      { passive: true },
    )
    window.addEventListener('keydown', (e) => {
      if (!canNavigate() || e.defaultPrevented) return
      const dir = KEYS_DOWN.has(e.key) ? 1 : KEYS_UP.has(e.key) ? -1 : 0
      // Space on a focused button is that button's own press.
      if (!dir || (e.key === ' ' && (e.target as Element).closest?.('button, a'))) return
      e.preventDefault()
      // A key goes one world along, from wherever the scene is nearest.
      const at = Math.round(aim)
      go(dir > 0 ? (at === 1 ? 'split' : 'night') : at === -1 ? 'split' : 'day')
    })
  }

  let drawnX = NaN
  let sidesShown: boolean | null = null
  let backShown: -1 | 0 | 1 | null = null

  function syncButtons(): void {
    const split = Math.abs(s) < 0.12
    if (split !== sidesShown) {
      sidesShown = split
      dayBtn.classList.toggle('is-shown', split)
      nightBtn.classList.toggle('is-shown', split)
      if (split) {
        dayBtn.classList.remove('is-picked')
        nightBtn.classList.remove('is-picked')
      }
    }
    const back = s < -0.97 ? -1 : s > 0.97 ? 1 : 0
    if (back === backShown) return
    backShown = back
    if (back) {
      // At the edge the rope left by, coloured for its world, pointing the
      // way the scroll back goes: up out of the night, down out of the day.
      const night = back < 0
      backBtn.classList.toggle('side--left', night)
      backBtn.classList.toggle('side--right', !night)
      backBtn.classList.toggle('side--night', night)
      backBtn.classList.toggle('side--day', !night)
      backBtn.querySelector('.side-ring')!.innerHTML = night ? ARROW_UP : ARROW_DOWN
    }
    backBtn.classList.toggle('is-shown', back !== 0)
  }

  function update(time: number): number {
    const delta = now === 0 ? 0 : Math.min((time - now) / 1000, 0.1)
    now = time

    if (glideAt >= 0) {
      const u = REDUCED_MOTION.matches ? 1 : (time - glideAt) / (TRAVEL * 1000 * Math.max(0.35, Math.abs(glideTo - glideFrom)))
      aim = glideFrom + (glideTo - glideFrom) * smoother(u)
      if (u >= 1) glideAt = -1
    } else if (performance.now() - lastInput > SNAP_IDLE_MS) {
      const rest = Math.round(aim)
      if (aim !== rest && Math.abs(aim - rest) < SNAP) go(rest < 0 ? 'night' : rest > 0 ? 'day' : 'split')
    }

    if (REDUCED_MOTION.matches) {
      s = aim
      vel = 0
    } else {
      for (let left = delta; left > 0; left -= MAX_STEP) {
        const h = left < MAX_STEP ? left : MAX_STEP
        vel += (OMEGA * OMEGA * (aim - s) - 2 * OMEGA * vel) * h
        s += vel * h
      }
      if (Math.abs(aim - s) < 1e-4 && Math.abs(vel) < 1e-3) {
        s = aim
        vel = 0
      }
    }
    syncButtons()

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
    night: () => clamp(-s, 0, 1),
    day: () => clamp(s, 0, 1),
    go,
    bindScroll,
    update,
  }
}
