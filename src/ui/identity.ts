/**
 * 02 — IDENTITY: three statements on one vertical axis, moved by the scroll
 * like a lens pulling focus. Type and motion only — no boxes, images or
 * gradients.
 *
 * A single focus position `f` walks the list, and it **dwells**: each
 * statement holds, sharp and centred, for part of the scroll before focus
 * travels on. A statement's distance from focus, `d`, sets how it draws, and
 * the two sides are deliberately not mirror images:
 *   - ahead (d > 0): below, small, blurred and wide-tracked — still forming;
 *   - in focus (d = 0): centred, full size, sharp, tight tracking;
 *   - behind (d < 0): above, small and dim but crisp — settled.
 *
 * **Only transform and opacity ever change per frame.** Each statement is two
 * stacked copies — a sharp, tightly tracked one and a blurred, wide-tracked
 * one — and focus crossfades between them. Animating `filter` and
 * `letter-spacing` directly re-rasterised big glowing type every frame, which
 * is what made this scene's scroll stutter.
 *
 * Behind it runs a thread of stars down the axis. It drifts on the clock as
 * well as with the scroll, so it never stops, and every way a star appears or
 * goes — the thread's own fade, the gaps around statements, the screen edges —
 * is a smooth ramp. While focus travels between two statements a comet runs
 * down the thread from one to the next. Two small labels hold the corners.
 *
 * Driven from main.ts's one RAF loop. The identity progress is chased with its
 * own time-based smoothing (on top of the page's), so the motion stays soft
 * however the wheel arrives; scrolling back plays it backwards.
 */
import { clamp } from '../lib/math'

const ITEMS = [
  { label: 'ACADEMIC ROOT', text: 'COMPUTER SCIENCE' },
  { label: 'CURRENT CRAFT', text: 'FULL-STACK DEVELOPER' },
  { label: 'DIRECTION', text: 'BUILDING TOWARD AI' },
]

/** Per-second rate the drawn progress chases the scroll at (`1 - exp(-rate * dt)`). */
const CHASE_RATE = 3.2
/** Focus runs from one step before the first statement to one after the last. */
const RUN_FROM = -0.8
const RUN_TO = ITEMS.length - 1 + 0.8
/** Fraction of each step spent holding still, split either side of the statement. */
const DWELL = 0.36
/** Vertical distance, in vh, one step covers near the centre. */
const GAP_VH = 40
/** How hard further statements are pulled toward the centre line. */
const DEPTH = 0.22
/** Fraction of the scene spent fading the whole thing in, and again out. */
const EDGE = 0.12

/** Stars in the thread, top of the screen to the bottom. */
const THREAD_STARS = 72
/** Star-spacings the thread drifts per second on its own, and across the whole scene with the scroll. */
const THREAD_DRIFT = 0.35
const THREAD_FLOW = 10
/** Half-height, in vh at full size, of the gap the thread leaves around a statement, and the soft edge beyond it. */
const CLEAR_VH = 8
const CLEAR_SOFT_VH = 9
/** Fraction of the scene the thread itself takes to fade in, and again out. */
const THREAD_EDGE = 0.22
/** Stars trailing the comet, and the vh between them. */
const TAIL = 7
const TAIL_STEP_VH = 0.9

function smooth(u: number): number {
  const x = clamp(u, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** Keep each step's ends flat for `DWELL` of it, and ease across the middle. */
function dwell(x: number): number {
  const k = Math.floor(x)
  return k + smooth((x - k - DWELL / 2) / (1 - DWELL))
}

export interface Identity {
  el: HTMLDivElement
  /** `t` is the identity progress, 0..1; `time` is the RAF timestamp. */
  update(t: number, time: number): void
}

export function createIdentity(): Identity {
  const el = document.createElement('div')
  el.className = 'identity'

  // The thread first, so the statements paint over it.
  const thread = Array.from({ length: THREAD_STARS }, (_, k) => {
    const star = document.createElement('i')
    star.className = 'identity-star'
    const size = 1.4 + Math.random() * 1.4
    star.style.width = star.style.height = `${size}px`
    star.style.marginLeft = `${(Math.random() - 0.5) * 2.5 - size / 2}px`
    el.append(star)
    return { star, k, level: 0.5 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2 }
  })

  const items = ITEMS.map(({ label, text }, i) => {
    const item = document.createElement('div')
    item.className = 'identity-item'
    const caption = document.createElement('p')
    caption.className = 'identity-caption'
    caption.textContent = `0${i + 1} — ${label}`
    const words = document.createElement('div')
    words.className = 'identity-words'
    const sharp = document.createElement('p')
    sharp.className = 'identity-word'
    sharp.textContent = text
    const soft = document.createElement('p')
    soft.className = 'identity-word identity-word--soft'
    soft.textContent = text
    soft.setAttribute('aria-hidden', 'true')
    words.append(sharp, soft)
    item.append(caption, words)
    el.append(item)
    return { item, caption, sharp, soft }
  })

  // The comet: a head and a tail of fading, shrinking stars above it.
  const comet = Array.from({ length: TAIL + 1 }, (_, j) => {
    const star = document.createElement('i')
    star.className = j === 0 ? 'identity-star identity-comet' : 'identity-star'
    const size = j === 0 ? 4 : 2.6 - (1.4 * j) / TAIL
    star.style.width = star.style.height = `${size}px`
    star.style.marginLeft = `${-size / 2}px`
    el.append(star)
    return star
  })

  const name = document.createElement('p')
  name.className = 'identity-meta identity-meta--name'
  name.textContent = '02 — IDENTITY'
  const counter = document.createElement('p')
  counter.className = 'identity-meta identity-meta--count'
  el.append(name, counter)
  let counted = -1

  const ys = new Float64Array(ITEMS.length)
  const scales = new Float64Array(ITEMS.length)
  /** The drawn progress, chasing the scroll's. */
  let tt = 0
  let prevTime = 0
  let hidden = true

  function drawThread(time: number): void {
    const step = 100 / THREAD_STARS
    const flow = (((time / 1000) * THREAD_DRIFT + tt * THREAD_FLOW) % 1 + 1) % 1
    const strength = smooth(tt / THREAD_EDGE) * smooth((1 - tt) / THREAD_EDGE)
    for (const { star, k, level, phase } of thread) {
      const y = (k + flow) * step // 0..100vh
      const centred = y - 50
      let clear = 1
      for (let i = 0; i < ITEMS.length; i++) {
        const gap = Math.abs(centred - ys[i]) - CLEAR_VH * scales[i]
        clear = Math.min(clear, smooth(gap / CLEAR_SOFT_VH))
      }
      const twinkle = 0.75 + 0.25 * Math.sin(phase + time / 700)
      star.style.transform = `translateY(${centred}vh)`
      star.style.opacity = String(Math.sin((Math.PI * y) / 100) * level * twinkle * clear * strength)
    }
  }

  function update(t: number, time: number): void {
    const dt = Math.min((time - prevTime) / 1000, 0.1)
    prevTime = time
    tt += (t - tt) * (1 - Math.exp(-CHASE_RATE * dt))
    if (Math.abs(t - tt) < 1e-4) tt = t

    const fade = smooth(tt / EDGE) * smooth((1 - tt) / EDGE)
    if (fade <= 0) {
      if (!hidden) {
        hidden = true
        el.style.visibility = 'hidden'
      }
      return
    }
    if (hidden) {
      hidden = false
      el.style.visibility = 'visible'
    }
    el.style.opacity = String(fade)

    const f = dwell(RUN_FROM + tt * (RUN_TO - RUN_FROM))

    items.forEach(({ item, caption, sharp, soft }, i) => {
      const d = i - f
      const a = Math.abs(d)
      const ahead = d > 0
      // How far "out of focus" an upcoming statement is, 0..1.
      const blur = ahead ? smooth(Math.min(a, 1)) : 0

      const y = ((ahead ? 1 : -1) * GAP_VH * a) / (1 + DEPTH * a)
      const scale = 1 - (ahead ? 0.42 : 0.5) * Math.min(a, 1.4)
      ys[i] = y
      scales[i] = scale

      item.style.transform = `translate(-50%, -50%) translateY(${y}vh) scale(${scale})`
      item.style.opacity = String(ahead ? Math.max(0, 1 - 0.8 * a) : Math.max(0, 1 - 0.72 * a))
      sharp.style.opacity = String(1 - blur)
      soft.style.opacity = String(blur)
      caption.style.opacity = String(Math.max(0, 1 - a * 2.2))
    })

    drawThread(time)

    // Between statements k and k+1, `u` runs 0..1 and the comet descends from
    // just below k to just above k+1 — both measured where they stand now.
    const k = clamp(Math.floor(f), 0, ITEMS.length - 2)
    const u = clamp(f - k, 0, 1)
    const from = ys[k] + CLEAR_VH * scales[k]
    const to = ys[k + 1] - CLEAR_VH * scales[k + 1]
    const head = from + (to - from) * u
    const glow = Math.sin(Math.PI * u)
    comet.forEach((star, j) => {
      star.style.transform = `translateY(${head - j * TAIL_STEP_VH}vh)`
      star.style.opacity = String(glow * (1 - j / (TAIL + 1)))
    })

    const current = clamp(Math.round(f), 0, ITEMS.length - 1)
    if (current !== counted) {
      counted = current
      counter.textContent = `0${current + 1} / 0${ITEMS.length}`
    }
  }

  return { el, update }
}
