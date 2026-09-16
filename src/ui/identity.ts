/**
 * 02 — IDENTITY: three statements on one vertical axis, moved by the scroll
 * like a lens pulling focus. Type and motion only — no boxes, images or
 * gradients.
 *
 * A single focus position `f` walks the list **linearly with the scroll**. It
 * used to dwell — each statement held still for part of its step before focus
 * travelled on — and that read as the page snapping between the statements
 * rather than as scrolling through them. Nothing here paces the reader now;
 * the scroll is the scroll. A statement's distance from focus, `d`, sets how
 * it draws, and the two sides are deliberately not mirror images:
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
 * Behind the type runs a **thread of stars on a canvas** — see `drawThread`.
 * Not a line, and not a comet riding one: both were tried and both read as a
 * scroll indicator rather than as scenery. The scene opens by drawing that
 * thread up from the bottom edge, and the statements rise in behind it while
 * it is still climbing.
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
/** Vertical distance, in vh, one step covers near the centre. */
const GAP_VH = 40
/** How hard further statements are pulled toward the centre line. */
const DEPTH = 0.22
/** Fraction of the scene spent fading the whole thing back out at the end. */
const EDGE = 0.12

// --- The entrance ---
/**
 * The scene opens in two overlapping beats: the thread draws itself up from
 * the bottom edge, and the statements rise in behind it while it is still
 * climbing. Both are fractions of the identity scene.
 *
 * The overlap is the point — `ITEMS_FROM` sits inside the climb, so the type
 * arrives *with* the thread rather than behind it, and the scene never stands
 * still waiting for one of them to finish.
 */
const RISE_END = 0.2
/** Softness of the climbing front, as a fraction of the screen's height. */
const RISE_SOFT = 0.14
const ITEMS_FROM = 0.11
const ITEMS_IN = 0.15
/** How far, in vh, a statement is lifted from as it arrives. */
const ENTRY_LIFT_VH = 9
/** Scroll left at the end for the last statement to settle before the scene goes. */
const EXIT_PAD = 0.06

// --- The thread ---
/**
 * Stars in the thread, and how far either side of the axis they may sit.
 *
 * They are drawn on a canvas rather than as elements, which is what lets there
 * be this many: as DOM this was 44 boxes with `will-change` on each, and a
 * thread that sparse reads as loose dots. They sit close enough together to
 * suggest a line without ever touching — that scattered spacing is what keeps
 * it a thread of stars rather than a dotted rule.
 */
const THREAD_STARS = 420
const THREAD_SPREAD = 7
/**
 * Star radius range, in CSS px, and the shades they are drawn at.
 *
 * These are radii of a *soft* dot, so most of that width is falloff — at the
 * 0.4..1.7 they were first written at, a star was a 2px stamp of a gradient
 * that is near-transparent everywhere but its centre, and the whole thread
 * read as a smudge. Size it against what the sprite actually inks.
 */
const STAR_R_MIN = 0.9
const STAR_R_MAX = 2.6
const STAR_LEVEL_MIN = 0.3
const STAR_LEVEL_MAX = 1
/** Screen-heights the stars flow per second on the clock, and across the whole scene with the scroll. */
const THREAD_DRIFT = 0.012
const THREAD_FLOW = 0.16
/** Half-height, in vh at full size, of the gap the thread leaves around a statement, and the soft edge beyond it. */
const CLEAR_VH = 8
const CLEAR_SOFT_VH = 9

function smooth(u: number): number {
  const x = clamp(u, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * One soft white dot, drawn once and stamped per star.
 *
 * A radial gradient per star per frame would be the expensive way to do this.
 * The site's 3D fields solve the same problem the same way, with one sprite.
 */
function createDotSprite(): HTMLCanvasElement {
  const size = 32
  const dot = document.createElement('canvas')
  dot.width = dot.height = size
  const ctx = dot.getContext('2d')!
  // A solid core out to nearly half the radius, then falloff. A gradient that
  // starts dropping at the centre has almost no ink left by the time it is
  // stamped two pixels wide.
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
  grad.addColorStop(0.42, 'rgba(255, 255, 255, 0.98)')
  grad.addColorStop(0.62, 'rgba(255, 255, 255, 0.45)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return dot
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
  const canvas = document.createElement('canvas')
  canvas.className = 'identity-thread'
  canvas.setAttribute('aria-hidden', 'true')
  el.append(canvas)
  const ctx = canvas.getContext('2d')!
  const sprite = createDotSprite()

  /**
   * Every star's own place and look, rolled once.
   *
   * `u` is a position along the thread rather than an index, so the stars are
   * scattered along it instead of evenly spaced — and it is what flows: a
   * star's place is `(u + flow) mod 1`, so each one walks the whole height and
   * re-enters at the top alone, where the envelope has it at nothing.
   */
  const stars = Array.from({ length: THREAD_STARS }, () => ({
    u: Math.random(),
    // Biased toward the axis — three rolls averaged — so the thread has a
    // dense core and a few strays rather than an even band.
    x: ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2 * THREAD_SPREAD,
    r: STAR_R_MIN + Math.random() * (STAR_R_MAX - STAR_R_MIN),
    level: STAR_LEVEL_MIN + Math.random() * (STAR_LEVEL_MAX - STAR_LEVEL_MIN),
    phase: Math.random() * Math.PI * 2,
    // Its own twinkle rate, so the thread never pulses as one.
    rate: 0.7 + Math.random() * 1.6,
  }))

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

  const name = document.createElement('p')
  name.className = 'identity-meta identity-meta--name'
  name.textContent = '02 — IDENTITY'
  el.append(name)

  const ys = new Float64Array(ITEMS.length)
  const scales = new Float64Array(ITEMS.length)
  /** The drawn progress, chasing the scroll's. */
  let tt = 0
  let prevTime = 0
  let hidden = true
  let cssW = 0
  let cssH = 0

  /** Match the backing store to the viewport, and keep drawing in CSS pixels. */
  function sizeCanvas(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    if (w === cssW && h === cssH) return
    cssW = w
    cssH = h
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /**
   * The thread: stars scattered down the axis, drawn as one canvas.
   *
   * Four things multiply into a star's brightness, and every one of them is a
   * smooth ramp, so nothing ever pops:
   *   - the climbing front, which is the scene's entrance — the thread draws
   *     upward from the bottom edge, so `front` runs from below the screen to
   *     above it and a star lights only once the front has passed it;
   *   - an envelope that fades the thread out at both screen edges;
   *   - the gap it leaves around each statement, so it never crosses type;
   *   - its own twinkle, on its own clock rather than the thread's.
   */
  function drawThread(time: number, fade: number): void {
    ctx.clearRect(0, 0, cssW, cssH)

    // Runs from 1 + RISE_SOFT (wholly below the bottom edge) to -RISE_SOFT
    // (wholly above the top), so the thread is fully out at one end of the
    // climb and fully in at the other rather than clipped at either.
    const front = (1 + 2 * RISE_SOFT) * (1 - smooth(tt / RISE_END)) - RISE_SOFT

    const seconds = time / 1000
    const flow = seconds * THREAD_DRIFT + tt * THREAD_FLOW
    const axis = cssW / 2

    for (const star of stars) {
      const yn = (((star.u + flow) % 1) + 1) % 1 // 0 at the top, 1 at the bottom
      const reveal = smooth((yn - front) / RISE_SOFT)
      if (reveal <= 0) continue

      const centred = yn * 100 - 50 // vh from the middle, as the statements are measured
      let clear = 1
      for (let i = 0; i < ITEMS.length; i++) {
        const gap = Math.abs(centred - ys[i]) - CLEAR_VH * scales[i]
        clear = Math.min(clear, smooth(gap / CLEAR_SOFT_VH))
      }
      if (clear <= 0) continue

      const twinkle = 0.72 + 0.28 * Math.sin(star.phase + seconds * star.rate)
      const alpha = Math.sin(Math.PI * yn) * star.level * twinkle * clear * reveal * fade
      if (alpha <= 0.004) continue

      ctx.globalAlpha = alpha
      ctx.drawImage(sprite, axis + star.x - star.r, yn * cssH - star.r, star.r * 2, star.r * 2)
    }
    ctx.globalAlpha = 1
  }

  function update(t: number, time: number): void {
    const dt = Math.min((time - prevTime) / 1000, 0.1)
    prevTime = time
    tt += (t - tt) * (1 - Math.exp(-CHASE_RATE * dt))
    if (Math.abs(t - tt) < 1e-4) tt = t

    const out = smooth((1 - tt) / EDGE)
    const wordsFade = smooth((tt - ITEMS_FROM) / ITEMS_IN) * out
    // The thread has no fade of its own on the way in — the climb *is* its
    // entrance — so the scene is up as soon as there is any of it to draw.
    if (tt <= 0 || out <= 0) {
      if (!hidden) {
        hidden = true
        el.style.visibility = 'hidden'
      }
      return
    }
    if (hidden) {
      hidden = false
      el.style.visibility = 'visible'
      // `.identity` rests at opacity 0; the layer is fully on from here and
      // every fade is applied per child, so this is written once, not per frame.
      el.style.opacity = '1'
    }
    sizeCanvas()

    // Linear in the scroll, over whatever is left once the entrance has run
    // and before the exit — no dwell, nothing held.
    const fu = clamp((tt - RISE_END) / (1 - RISE_END - EXIT_PAD), 0, 1)
    const f = RUN_FROM + fu * (RUN_TO - RUN_FROM)
    // Lifted from below as they arrive, settling as the thread finishes.
    const lift = (1 - smooth((tt - ITEMS_FROM) / ITEMS_IN)) * ENTRY_LIFT_VH

    items.forEach(({ item, caption, sharp, soft }, i) => {
      const d = i - f
      const a = Math.abs(d)
      const ahead = d > 0
      // How far "out of focus" an upcoming statement is, 0..1. It is fully
      // sharp for the last stretch of its approach, so the two copies only
      // overlap while the statement is still small and dim.
      const blur = ahead ? smooth((a - 0.4) / 0.5) : 0

      const y = ((ahead ? 1 : -1) * GAP_VH * a) / (1 + DEPTH * a)
      const scale = 1 - (ahead ? 0.42 : 0.5) * Math.min(a, 1.4)
      ys[i] = y
      scales[i] = scale

      item.style.transform = `translate(-50%, -50%) translateY(${(y + lift).toFixed(2)}vh) scale(${scale.toFixed(4)})`
      const near = ahead ? Math.max(0, 1 - 0.8 * a) : Math.max(0, 1 - 0.72 * a)
      item.style.opacity = (near * wordsFade).toFixed(3)
      sharp.style.opacity = (1 - blur).toFixed(3)
      soft.style.opacity = blur.toFixed(3)
      caption.style.opacity = Math.max(0, 1 - a * 2.2).toFixed(3)
    })

    name.style.opacity = wordsFade.toFixed(3)
    drawThread(time, out)
  }

  return { el, update }
}
