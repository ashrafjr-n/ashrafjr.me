/**
 * 02 — IDENTITY: three words on one vertical axis, moved by the scroll like a
 * lens pulling focus. Type and motion only — no boxes, images or gradients.
 *
 * A single focus position `f` runs past the words as the scroll does. Each
 * word's distance from it, `d`, sets everything about how it draws: at 0 it is
 * centred, full size and sharp; either side it shrinks, dims, blurs and is
 * pulled toward the centre line (dividing by `1 + DEPTH * |d|` bunches the far
 * ones together, which is what reads as depth rather than as a slide). So the
 * word behind recedes while the next one arrives out of the distance.
 *
 * A pure function of the identity progress (`lib/phases.ts`), so scrolling
 * back up plays it backwards exactly. Driven from main.ts's one RAF loop.
 */

const WORDS = ['COMPUTER SCIENCE', 'FULL-STACK DEVELOPER', 'AI ENGINEER']

/** Where focus sits at the start and end of the scene, in word indices. */
const FOCUS_FROM = -0.7
const FOCUS_TO = WORDS.length - 1 + 0.7
/** Vertical distance, in vh, one word-step covers at the centre. */
const SPACING_VH = 30
/** How hard distant words are pulled together. */
const DEPTH = 0.35
/** Shrink, fade and blur per word-step away from focus. */
const SHRINK = 0.5
const FADE = 0.6
const BLUR_PX = 3
/** Fraction of the scene spent fading the whole thing in, and again out. */
const EDGE = 0.1

/**
 * The line between each pair of words is made of stars, not drawn: a column of
 * small glowing dots that flow down it as the scroll runs, so the line itself
 * moves. They fade at both ends of a segment, which is what keeps them clear
 * of the words.
 */
const STARS_PER_SEGMENT = 16
/** Gap left above and below each word, in vh at full size. */
const LINE_PAD_VH = 5
/** How many times a star travels the whole segment across the scene. */
const LINE_FLOW = 2

export interface Identity {
  el: HTMLDivElement
  /** `t` is the identity progress, 0..1. */
  update(t: number): void
}

export function createIdentity(): Identity {
  const el = document.createElement('div')
  el.className = 'identity'

  // One segment per pair of neighbouring words. Each star keeps its own size,
  // brightness and a hair of sideways jitter, so the line reads as stars.
  const segments = WORDS.slice(1).map(() =>
    Array.from({ length: STARS_PER_SEGMENT }, () => {
      const star = document.createElement('i')
      star.className = 'identity-star'
      const size = 1.4 + Math.random() * 1.4
      star.style.width = star.style.height = `${size}px`
      star.style.marginLeft = `${(Math.random() - 0.5) * 3 - size / 2}px`
      el.append(star)
      return { star, level: 0.45 + Math.random() * 0.55 }
    }),
  )

  const words = WORDS.map((text) => {
    const word = document.createElement('p')
    word.className = 'identity-word'
    word.textContent = text
    el.append(word)
    return word
  })

  let shown = -1

  function update(t: number): void {
    if (Math.abs(t - shown) < 0.0005) return // skip redundant style writes
    shown = t

    const fade = Math.min(t / EDGE, (1 - t) / EDGE, 1)
    el.style.opacity = String(fade)
    if (fade <= 0) return

    const f = FOCUS_FROM + t * (FOCUS_TO - FOCUS_FROM)
    const ys: number[] = []
    const scales: number[] = []
    const opacities: number[] = []
    words.forEach((word, i) => {
      const d = i - f
      const a = Math.abs(d)
      const y = (SPACING_VH * d) / (1 + DEPTH * a)
      const scale = 1 / (1 + SHRINK * a)
      const opacity = Math.max(0, 1 - FADE * a)
      ys.push(y)
      scales.push(scale)
      opacities.push(opacity)
      word.style.transform = `translate(-50%, -50%) translateY(${y}vh) scale(${scale})`
      word.style.opacity = String(opacity)
      word.style.filter = `blur(${Math.min(a * BLUR_PX, 6)}px)`
    })

    segments.forEach((stars, i) => {
      const top = ys[i] + LINE_PAD_VH * scales[i]
      const bottom = ys[i + 1] - LINE_PAD_VH * scales[i + 1]
      const strength = (opacities[i] + opacities[i + 1]) / 2
      stars.forEach(({ star, level }, k) => {
        const u = (k / STARS_PER_SEGMENT + t * LINE_FLOW) % 1
        star.style.transform = `translateY(${top + (bottom - top) * u}vh)`
        star.style.opacity = String(Math.sin(Math.PI * u) * level * strength)
      })
    })
  }

  return { el, update }
}
