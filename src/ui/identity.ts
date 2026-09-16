/**
 * 02 — IDENTITY: the three statements as one object in depth, with the camera
 * travelling through them.
 *
 * The words are not animated — the **camera is**. Each statement is sampled
 * into a cloud of particles standing on one axis in front of the viewer, and
 * the scroll drives a fly-through: a statement starts far off and nearly
 * hidden, swells until its letters run off all four edges, blows apart as it
 * passes, and the same cloud gathers again further down the axis as the next
 * one. The last statement does not blow past; it collapses into a single lit
 * point deep in the field — the thing being built toward.
 *
 * **This replaced three stacked headings that scrolled past each other**, and
 * the difference is the perspective divide: everything on screen here is one
 * cloud at one depth, projected. Nothing is laid out, nothing is centred, and
 * a statement is never a heading.
 *
 * Deleted with that: the thread of stars down the axis (and the hairline and
 * comet before it), the per-statement captions, and the two stacked DOM copies
 * of each word that used to crossfade sharp against blurred. The type is
 * rasterised once per statement and lives as points from then on; the DOM
 * keeps only a screen-reader copy and the corner label.
 *
 * Driven from main.ts's one RAF loop. The identity progress is chased with its
 * own time-based smoothing (on top of the page's), so the motion stays soft
 * however the wheel arrives; scrolling back flies the camera out again.
 */
import { clamp } from '../lib/math'

const PHRASES = ['COMPUTER SCIENCE', 'FULL-STACK DEVELOPER', 'BUILDING TOWARD AI']

/** Per-second rate the drawn progress chases the scroll at (`1 - exp(-rate * dt)`). */
const CHASE_RATE = 3.2
/**
 * Fraction of the scene spent fading the whole thing back out at the end.
 *
 * Deliberately short: the ending is the collapse into a point, not a fade, and
 * at the 0.1 this started on the fade took the point away at exactly the
 * moment it had finished forming. This is only the cut at the very end, after
 * the point has been sitting there for a while.
 */
const EDGE = 0.05

// --- The fly-through ---
/**
 * Depth of a statement, in focal lengths, as the camera arrives at it and as
 * it leaves. One statement's `D_NEAR` is the next one's `D_FAR`: the camera
 * runs the same stretch of axis three times, and that is what makes the
 * hand-over read as one continuous travel rather than as three entrances.
 *
 * `D_NEAR` is small but never zero — at zero the projection divides by nothing
 * and the cloud covers the screen in a single frame.
 */
const D_FAR = 9
const D_NEAR = 0.42
/**
 * Projected size of one world unit at one focal length, as a fraction of the
 * frame (see `frameSize`). A statement is normalised to exactly one unit
 * **wide**, so at `d = 1` it spans this much of the frame — and by `D_NEAR` it
 * is more than twenty times that, which is what runs the letters off every
 * edge.
 */
const FOCAL = 0.56
/**
 * What "the frame" means for that: the viewport's width, unless the window is
 * wide and short enough that the width would put the type taller than the
 * screen.
 *
 * **It has to be the width, because a statement is normalised by its width.**
 * Sizing it off the height instead looked right on a desktop only by
 * coincidence of aspect — on a phone it made every statement several times
 * wider than the screen, so the fly-through never showed a readable word at
 * all, just a passing fragment of one.
 */
const FRAME_TALLEST = 1.8

/**
 * Fraction of a statement's own stretch spent gathering at the start and
 * flying apart at the end. The rest of it is the statement whole, growing.
 */
const MORPH = 0.3
/**
 * The last statement runs to its own timetable, because it has three things to
 * do in one stretch where the others have one: arrive, collapse, and then
 * **hold as a point long enough to be seen**.
 *
 * Splitting it this way is the fix for an ending nobody ever saw. Sharing the
 * others' timing put the point at full collapse only at the very last of the
 * scene, which is exactly where the scene's own fade is — it formed and was
 * taken away in the same breath. Now it is complete by 72% of the stretch and
 * simply sits there for the rest.
 */
const LAST_APPROACH = 0.45
const LAST_COLLAPSE = 0.27
/**
 * How far along the shared depth run the last statement gets before it
 * collapses. Short of the lens on purpose: it is not there to blow past, and
 * past this it would be inside the near fade and going out anyway.
 */
const LAST_REACH = 0.72
/** How far a particle strays from its letter while the cloud is apart, in world units. */
const SCATTER_XY = 0.42
/** And in depth, which is what makes the cloud pass *through* the camera rather than across it. */
const SCATTER_Z = 2.6
/** How far a flying particle is smeared along its own travel, at full scatter. */
const STREAK = 2.6

/**
 * Where each statement stands off the axis, in world units, and what the
 * camera pans between.
 *
 * The camera arrives at each statement's own offset, so a statement is square
 * on as it approaches and swings off to one side as it blows past — which is
 * what keeps the big one off centre. Dead-centre framing on all three was the
 * thing that made this read as a slideshow.
 */
const STATIONS = [
  { x: 0.07, y: -0.03 },
  { x: -0.13, y: 0.04 },
  { x: 0.05, y: -0.02 },
]

// --- The particles ---
const COUNT = 2600
/** Radius of a particle at one focal length, in fractions of the viewport height. */
const PARTICLE_R = 0.0021
/** Clamp on the drawn radius, so a particle at the lens does not fill the frame. */
const PARTICLE_R_MAX_VH = 0.02
/**
 * Floor on the drawn radius, in CSS px. A statement out at `D_FAR` projects a
 * tenth of the viewport height wide, which puts its particles under half a
 * pixel each — the cloud is meant to read as a faint dust at that distance,
 * not to disappear.
 */
const PARTICLE_R_MIN_PX = 0.85
const LEVEL_MIN = 0.45
const LEVEL_MAX = 1

// --- The ending ---
/**
 * Depth the collapsed point recedes to.
 *
 * **It has to sit inside the far fade, not past it.** Anything beyond
 * `D_FAR * 1.5` is faded to nothing by distance, and at the 16 this was first
 * given the point was drawn perfectly and then multiplied by zero — the
 * ending simply did not appear.
 */
const D_DEEP = 6
/**
 * The point is a small cloud, not a mathematical dot: each particle keeps its
 * own offset from the centre, in world units. Isotropic, so what is left reads
 * as a round entity rather than as the flattened remains of a wide word.
 */
const POINT_SPREAD = 0.016
/**
 * How much bigger a particle draws once it belongs to the point.
 *
 * At this depth a particle is under the minimum radius and the whole point
 * came out as a two-pixel speck. It is meant to be the one lit thing left in
 * the field, so it is given the size back here rather than by hauling `D_DEEP`
 * closer, which would make it a blob instead of something far away.
 */
const POINT_R_BOOST = 4.2
/** How bright the point is, against a particle's own level. */
const POINT_GLOW = 2.4

function smooth(u: number): number {
  const x = clamp(u, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function mix(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

/** A statement, rasterised once and kept as points. */
interface Layout {
  /** `COUNT` pairs of world-space offsets from the statement's own centre. */
  xy: Float32Array
  /** Where "AI" sits in it — what the field collapses into at the end. */
  aiX: number
  aiY: number
}

/**
 * Rasterise a statement and take `COUNT` points off its ink.
 *
 * The result is normalised so the statement is exactly **one world unit wide**,
 * centred on its own ink rather than on the canvas — so every statement
 * projects to the same width at the same depth however long its text is, and
 * the fly-through is paced by the camera alone.
 */
function sampleText(text: string): Layout {
  const FONT_PX = 200
  const PAD = 30
  const TRACKING = '0.06em'
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const font = `300 ${FONT_PX}px "Space Grotesk", sans-serif`

  // Letter spacing has to be set *before* measuring as well as before drawing:
  // `measureText` honours it, so measuring without it and then drawing with it
  // sizes the canvas too narrow and the last glyph is clipped off the edge.
  ctx.font = font
  ctx.letterSpacing = TRACKING
  const width = Math.ceil(ctx.measureText(text).width) + PAD * 2
  const height = Math.ceil(FONT_PX * 1.7)
  canvas.width = width
  canvas.height = height
  // Resizing the canvas resets the context, so everything is set again here.
  ctx.font = font
  ctx.letterSpacing = TRACKING
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, PAD, height / 2)

  const data = ctx.getImageData(0, 0, width, height).data
  const ink: number[] = []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  // Every other pixel in each direction: four times fewer to walk, and still
  // far more candidates than there are particles to place.
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] < 128) continue
      ink.push(x, y)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  const span = maxX - minX || 1
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const xy = new Float32Array(COUNT * 2)
  const points = ink.length / 2
  for (let i = 0; i < COUNT; i++) {
    const p = ((Math.random() * points) | 0) * 2
    xy[i * 2] = (ink[p] - cx) / span
    xy[i * 2 + 1] = (ink[p + 1] - cy) / span
  }

  // Where "AI" sits, measured rather than guessed — the collapse aims at it.
  const at = text.lastIndexOf('AI')
  let aiX = 0
  if (at >= 0) {
    const before = PAD + ctx.measureText(text.slice(0, at)).width
    aiX = (before + ctx.measureText('AI').width / 2 - cx) / span
  }
  return { xy, aiX, aiY: (height / 2 - cy) / span }
}

export interface Identity {
  el: HTMLDivElement
  /** `t` is the identity progress, 0..1; `time` is the RAF timestamp. */
  update(t: number, time: number): void
}

export function createIdentity(): Identity {
  const el = document.createElement('div')
  el.className = 'identity'

  const canvas = document.createElement('canvas')
  canvas.className = 'identity-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  el.append(canvas)
  const ctx = canvas.getContext('2d')!

  // The statements still have to be readable to a screen reader and to a
  // crawler; on the canvas they are only ink.
  const sr = document.createElement('p')
  sr.className = 'identity-sr'
  sr.textContent = PHRASES.join('. ') + '.'
  el.append(sr)

  const name = document.createElement('p')
  name.className = 'identity-meta identity-meta--name'
  name.textContent = '02 — IDENTITY'
  el.append(name)

  /** One soft dot, drawn once and stamped per particle. */
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 32
  {
    const g = sprite.getContext('2d')!
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.95)')
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
  }

  /** Per particle, rolled once: how far it strays when the cloud is apart, and how bright it is. */
  const stray = new Float32Array(COUNT * 3)
  const level = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    // A direction on the sphere, at a random radius — so the cloud comes apart
    // as a ball rather than as a shell.
    const a = Math.random() * Math.PI * 2
    const z = Math.random() * 2 - 1
    const r = Math.cbrt(Math.random()) * Math.sqrt(1 - z * z)
    stray[i * 3] = Math.cos(a) * r
    stray[i * 3 + 1] = Math.sin(a) * r
    stray[i * 3 + 2] = z
    level[i] = LEVEL_MIN + Math.random() * (LEVEL_MAX - LEVEL_MIN)
  }

  /** Filled once the font is in — nothing can be sampled before then. */
  let layouts: Layout[] = []
  document.fonts
    // The font is no longer used by any rule, so it has to be asked for by
    // name or the browser never fetches it and the type rasterises as a
    // fallback.
    .load(`300 200px "Space Grotesk"`)
    .then(() => {
      layouts = PHRASES.map(sampleText)
    })
    .catch(() => {
      layouts = PHRASES.map(sampleText)
    })

  /** The drawn progress, chasing the scroll's. */
  let tt = 0
  let prevTime = 0
  let hidden = true
  let cssW = 0
  let cssH = 0

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
   * Fly the camera one step down the axis and draw whatever the cloud is
   * being at that moment.
   *
   * `travel` runs 0..PHRASES.length. Its whole part picks the statement, its
   * fraction is the camera's run at that statement: depth falls from `D_FAR`
   * to `D_NEAR` across it, so the statement swells the whole way, and the
   * cloud is apart at both ends of the run and whole in the middle. The jump
   * from one statement's near depth back to the next one's far depth happens
   * while the cloud is fully apart and at its dimmest, which is what hides it.
   */
  function draw(fade: number): void {
    ctx.clearRect(0, 0, cssW, cssH)
    if (layouts.length === 0) return

    const last = PHRASES.length - 1
    const travel = tt * PHRASES.length
    const k = clamp(Math.floor(travel), 0, last)
    const u = clamp(travel - k, 0, 1)
    const layout = layouts[k]

    // Apart at the start of the run (gathering) and at the end (flying past),
    // whole in between.
    const isLast = k === last
    const gather = 1 - smooth(u / MORPH)
    const burst = smooth((u - (1 - MORPH)) / MORPH)
    // The last statement never blows past: it arrives, draws in to where "AI"
    // sits, and holds there as one lit point deep in the field.
    const collapse = isLast ? smooth((u - LAST_APPROACH) / LAST_COLLAPSE) : 0
    const apart = isLast ? gather : Math.max(gather, burst)
    const approach = isLast ? Math.min(u / LAST_APPROACH, 1) * LAST_REACH : u

    // **Geometric, not linear.** A camera at constant speed covers depth
    // linearly, and apparent size goes as 1 / d — so a linear run spends
    // almost all of itself with the statement too small to read and then
    // crosses the whole legible range in its last fifth. Stepping the depth by
    // a constant *ratio* instead makes the statement grow at a steady rate on
    // screen, which is what the eye reads as travel.
    const depth = mix(D_FAR * Math.pow(D_NEAR / D_FAR, approach), D_DEEP, collapse)
    const station = STATIONS[k]
    const next = STATIONS[Math.min(k + 1, last)]
    // The camera arrives at the next statement's offset as it reaches it, so
    // this one swings aside as it passes.
    const camX = mix(station.x, next.x, smooth(u))
    const camY = mix(station.y, next.y, smooth(u))

    const halfW = cssW / 2
    const halfH = cssH / 2
    const unit = FOCAL * Math.min(cssW, cssH * FRAME_TALLEST)
    
    const maxR = PARTICLE_R_MAX_VH * cssH
    // Dimmed while apart, and taken to a hard glow once it is one point.
    const spread = 1 - 0.4 * apart
    const glow = mix(1, POINT_GLOW, collapse)

    for (let i = 0; i < COUNT; i++) {
      const sx = stray[i * 3]
      const sy = stray[i * 3 + 1]
      const sz = stray[i * 3 + 2]

      const tx = mix(layout.xy[i * 2], layout.aiX + sx * POINT_SPREAD, collapse)
      const ty = mix(layout.xy[i * 2 + 1], layout.aiY + sy * POINT_SPREAD, collapse)
      const d = depth + sz * SCATTER_Z * apart
      if (d < 0.08) continue

      const scale = unit / d
      const x = halfW + (tx + sx * SCATTER_XY * apart + station.x - camX) * scale
      const y = halfH + (ty + sy * SCATTER_XY * apart + station.y - camY) * scale

      const r = Math.min(
        Math.max(PARTICLE_R * scale, PARTICLE_R_MIN_PX) * mix(1, POINT_R_BOOST, collapse),
        maxR,
      )
      // Smeared along its own travel while it flies — the word coming apart in
      // streaks rather than in dots.
      const w = r * (1 + STREAK * apart * Math.abs(sx))
      const h = r * (1 + STREAK * apart * Math.abs(sy))
      if (x + w < 0 || x - w > cssW || y + h < 0 || y - h > cssH) continue

      // Fades up out of the far distance and back down as it reaches the lens,
      // so nothing ever arrives or leaves as a hard edge.
      const near = smooth((d - D_NEAR) / (D_NEAR * 1.4))
      const far = smooth((D_FAR * 1.5 - d) / (D_FAR * 0.7))
      const alpha = level[i] * near * far * spread * glow * fade
      if (alpha <= 0.006) continue

      ctx.globalAlpha = Math.min(alpha, 1)
      ctx.drawImage(sprite, x - w, y - h, w * 2, h * 2)
    }
    ctx.globalAlpha = 1
  }

  function update(t: number, time: number): void {
    const dt = Math.min((time - prevTime) / 1000, 0.1)
    prevTime = time
    tt += (t - tt) * (1 - Math.exp(-CHASE_RATE * dt))
    if (Math.abs(t - tt) < 1e-4) tt = t

    const fade = smooth((1 - tt) / EDGE)
    if (tt <= 0 || fade <= 0) {
      if (!hidden) {
        hidden = true
        el.style.visibility = 'hidden'
      }
      return
    }
    if (hidden) {
      hidden = false
      el.style.visibility = 'visible'
      // `.identity` rests at opacity 0; written once, never per frame.
      el.style.opacity = '1'
    }
    sizeCanvas()
    name.style.opacity = (smooth(tt / 0.08) * fade).toFixed(3)
    draw(fade)
  }

  return { el, update }
}
