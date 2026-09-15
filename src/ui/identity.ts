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
 * So arriving reads as a lens racking in and leaving reads as memory.
 *
 * Behind it all runs a thread of stars down the screen's axis, hidden where it
 * would cross a statement. While focus travels between two statements a comet
 * runs down that thread from one to the next, arriving as the next one sharpens.
 * Two small labels hold the bottom corners: the scene's name and a counter.
 *
 * A pure function of the identity progress (`lib/phases.ts`), so scrolling
 * back up plays it backwards exactly. Driven from main.ts's one RAF loop.
 */
import { clamp } from '../lib/math'

const ITEMS = [
  { label: 'ACADEMIC ROOT', text: 'COMPUTER SCIENCE' },
  { label: 'CURRENT CRAFT', text: 'FULL-STACK DEVELOPER' },
  { label: 'DIRECTION', text: 'BUILDING TOWARD AI' },
]

/** Focus runs from one step before the first statement to one after the last. */
const RUN_FROM = -0.8
const RUN_TO = ITEMS.length - 1 + 0.8
/** Fraction of each step spent holding still, split either side of the statement. */
const DWELL = 0.5
/** Vertical distance, in vh, one step covers near the centre. */
const GAP_VH = 27
/** How hard further statements are pulled toward the centre line. */
const DEPTH = 0.3
/** Letter-spacing in focus, and for a statement one step ahead (em). */
const TRACK_FOCUS = 0.16
const TRACK_AHEAD = 0.85
/** Fraction of the scene spent fading the whole thing in, and again out. */
const EDGE = 0.08

/** Stars in the thread, top of the screen to the bottom. */
const THREAD_STARS = 72
/** How many star-spacings the thread flows across the whole scene. */
const THREAD_FLOW = 22
/** Half-height, in vh at full size, of the gap the thread leaves around a statement. */
const CLEAR_VH = 7.5
/** Stars trailing the comet, and the vh between them. */
const TAIL = 7
const TAIL_STEP_VH = 0.9

/** Keep `u`'s ends flat for `DWELL` of the step, and ease across the middle. */
function dwell(x: number): number {
  const k = Math.floor(x)
  const u = clamp((x - k - DWELL / 2) / (1 - DWELL), 0, 1)
  return k + u * u * (3 - 2 * u)
}

export interface Identity {
  el: HTMLDivElement
  /** `t` is the identity progress, 0..1. */
  update(t: number): void
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
    const word = document.createElement('p')
    word.className = 'identity-word'
    word.textContent = text
    item.append(caption, word)
    el.append(item)
    return { item, caption, word }
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
  let shown = -1

  /**
   * Stars evenly down the axis, flowing with the scroll, each twinkling on its
   * own phase. A star fades out as it nears any statement (its clearance
   * shrinks with the statement's scale) and toward the top and bottom edges.
   */
  function drawThread(t: number): void {
    const step = 100 / THREAD_STARS
    const flow = (t * THREAD_FLOW) % 1
    for (const { star, k, level, phase } of thread) {
      const y = (k + flow) * step // 0..100vh
      const centred = y - 50
      let clear = 1
      for (let i = 0; i < ITEMS.length; i++) {
        clear = Math.min(clear, clamp((Math.abs(centred - ys[i]) - CLEAR_VH * scales[i]) / 4, 0, 1))
      }
      const twinkle = 0.75 + 0.25 * Math.sin(phase + t * 60)
      star.style.transform = `translateY(${centred}vh)`
      star.style.opacity = String(Math.sin((Math.PI * y) / 100) * level * twinkle * clear)
    }
  }

  function update(t: number): void {
    if (Math.abs(t - shown) < 0.0003) return // skip redundant style writes
    shown = t

    const fade = Math.min(t / EDGE, (1 - t) / EDGE, 1)
    el.style.opacity = String(fade)
    if (fade <= 0) return

    const f = dwell(RUN_FROM + t * (RUN_TO - RUN_FROM))

    items.forEach(({ item, caption, word }, i) => {
      const d = i - f
      const a = Math.abs(d)
      const near = Math.min(a, 1)
      const ahead = d > 0

      const y = ((ahead ? 1 : -1) * GAP_VH * a) / (1 + DEPTH * a)
      const scale = 1 - (ahead ? 0.42 : 0.5) * Math.min(a, 1.4)
      ys[i] = y
      scales[i] = scale

      item.style.transform = `translate(-50%, -50%) translateY(${y}vh) scale(${scale})`
      item.style.opacity = String(ahead ? Math.max(0, 1 - 0.8 * a) : Math.max(0, 1 - 0.72 * a))
      item.style.filter = `blur(${ahead ? near * 7 : near * 1.2}px)`
      word.style.letterSpacing = `${TRACK_FOCUS + (ahead ? near * (TRACK_AHEAD - TRACK_FOCUS) : 0)}em`
      word.style.paddingLeft = word.style.letterSpacing
      caption.style.opacity = String(Math.max(0, 1 - a * 2.2))
    })

    drawThread(t)

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
