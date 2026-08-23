/**
 * Scene 2's folder constellations — the stars that fly in from the screen's
 * left and right edges, gather beside the model, and turn into the SYSTEM and
 * PROJECTS folder marks.
 *
 * The trick is that there is nothing to fake. `folder.svg` is ASCII art, and
 * at the size it is drawn each character lands under ~1.2 x 2.2 CSS pixels —
 * so the artwork already *is* a field of dots. Every star here is aimed at one
 * specific character's centre (`lib/ascii-points.ts`) and carries that
 * character's own grey, so when the real SVG cross-fades in underneath there
 * is no seam to hide: the picture the stars built and the picture the file
 * draws are the same picture.
 *
 * **Screen space, not world space.** The targets are DOM elements, so the
 * whole layer is an OrthographicCamera mapped one-to-one onto CSS pixels with
 * y running down — the same coordinate system `getBoundingClientRect()` and
 * `getScreenCTM()` speak. That is what makes the landing exact rather than
 * approximately right. It is still drawn by the site's one renderer, as a
 * third pass in `scene.ts`, so it inherits the same additive blending, the
 * same soft sprite and the same PointsMaterial as the rest of the site's
 * stars: these read as the *same* stars arriving, which is the entire point.
 *
 * **One shot, then it holds.** It fires once when the scroll crosses
 * TRIGGER_AT, runs on wall-clock time from there, and retires — scrolling back
 * up and down again finds the folders already built, never rebuilding them.
 * Same shape as `lib/ascii-reveal.ts`'s draw-once-and-hold, including the
 * pause: the clock only advances while the layer is actually on screen.
 *
 * Palette: grayscale only, straight off the artwork's own grey ramp.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  OrthographicCamera,
  Points,
  PointsMaterial,
  Scene,
} from 'three'
import type { CanvasTexture, WebGLRenderer } from 'three'
import { clamp, rand } from '../lib/math'
import { sampleGlyphPoints, toScreenPoints, type GlyphPoint } from '../lib/ascii-points'
import { createCircleTexture } from './sprite'

/** Which screen edge a constellation's stars come in from. */
export type Side = 'left' | 'right'

/**
 * Characters sampled per folder. Chosen against the artwork's own grid rather
 * than picked: folder.svg carries 10,448 glyphs, so this takes roughly every
 * second one, which puts the sampled points ~2.3px apart horizontally against
 * the ~2.2px the lines already sit apart vertically. An even grid at the
 * target is what lets the constellation read as a continuous mass instead of
 * scan lines. Halve it and the folder reads as horizontal dashes.
 */
const STARS_PER_FOLDER = 5200

/** Scroll progress at which the whole thing fires, once. */
const TRIGGER_AT = 0.62

/**
 * The layer's own scroll gate — separate from the Scene 2 row's fade, and
 * deliberately much earlier than it, because the stars have to be on screen
 * well before the row arrives. Reaches 1 exactly at TRIGGER_AT, so the effect
 * always begins fully visible; below GATE_START everything here is gone, which
 * is what keeps Scene 1 clean if the reader scrolls back up.
 */
const GATE_START = 0.52
const GATE_END = TRIGGER_AT

// --- The flight ---
/** How long one star's own flight lasts, and how much that varies per star. */
const TRAVEL_MS = 2000
const TRAVEL_JITTER = 0.18
/** Spread of departure times across a folder's stars. */
const STAGGER_MS = 1100
/**
 * How much of that stagger follows the star's place in the artwork rather than
 * chance. The folder fills from the edge the stars arrive at, inward, so the
 * stream reads as depositing itself; pure randomness reads as static.
 */
const ORDER_WEIGHT = 0.7
/** The left side sets off this much after the right — mirrored looks mechanical. */
const SIDE_LEAD_MS = 240
/**
 * Deceleration exponent. Strongly eased out: the stars arrive fast and settle
 * slowly, which is what sells them as coming to rest rather than stopping.
 */
const TRAVEL_EASE = 3.4

// --- Where they come from ---
/** Nearest star starts this far outside its edge; the stream reaches this deep. */
const ENTRY_GAP_PX = 80
const ENTRY_DEPTH_PX = 620
/** Vertical scatter at the start, as a fraction of the viewport height, +/-. */
const ENTRY_SPREAD_H = 0.34
/** How far a path bows off the straight line at its midpoint. */
const BOW_PX = 90

// --- The settle ---
/** A small decaying wobble as each star lands, so nothing arrives dead. */
const SETTLE_PX = 0.7
const SETTLE_MS = 620
const SETTLE_RATE = 0.017 // radians per ms

// --- The swap ---
/** Latest a star can land: the whole formation is done by here. */
const FORM_MS = STAGGER_MS + SIDE_LEAD_MS + TRAVEL_MS * (1 + TRAVEL_JITTER)
/**
 * The artwork fades in *while the last stars are still landing* and reaches
 * full exactly as the formation completes, so the two pictures overlap rather
 * than hand over. The stars then hold a moment on top of it before fading —
 * additive, so the overlap just reads as the constellation settling to its
 * final brightness.
 */
const SWAP_MS = 900
const SWAP_AT = FORM_MS - SWAP_MS
const STAR_HOLD_MS = 250
const STAR_FADE_MS = 800
const STAR_FADE_AT = FORM_MS + STAR_HOLD_MS
const END_MS = STAR_FADE_AT + STAR_FADE_MS

/**
 * Extra brightness while the stars are still travelling, easing back to 1 as
 * the folder forms. Global rather than per-star: a uniform multiplier is
 * already at 1 by the time the artwork takes over, so it cannot show up as a
 * step at the swap the way a random per-star boost would.
 */
const TRAVEL_BOOST = 1.35

/**
 * Point size, in viewBox units of the artwork rather than pixels — so it is
 * derived from the same `getScreenCTM()` scale as the targets and stays
 * correct against the glyph grid at every viewport size. 10 units is a little
 * over one sampled cell, which is what makes the landed constellation
 * continuous instead of stippled.
 */
const POINT_SIZE_UNITS = 10

/** Smallest opacity change worth writing to the DOM. */
const OPACITY_EPSILON = 0.004

/** Longest frame gap honoured, so a backgrounded tab doesn't skip the flight. */
const MAX_DELTA_MS = 100

interface Source {
  svg: SVGSVGElement
  host: HTMLElement
  /** +1 enters from the right edge, -1 from the left. */
  dir: number
  glyphs: GlyphPoint[]
  count: number
  /** Screen-space xyz per star, re-projected on every resize. */
  targets: Float32Array
  starts: Float32Array
  /** Per-star constants, all viewport-independent so a resize keeps them. */
  delays: Float32Array
  durations: Float32Array
  spreads: Float32Array
  depths: Float32Array
  bows: Float32Array
  phases: Float32Array
  positions: Float32Array
  posAttr: Float32BufferAttribute
  mesh: Points
  material: PointsMaterial
  hostOpacity: number
}

export interface Constellation {
  /**
   * Register one folder: its injected `<svg>` (the source of both the target
   * points and their greys), the screen edge its stars arrive from, and the
   * element whose opacity is the other half of the cross-fade.
   */
  addSource(svg: SVGSVGElement, side: Side, host: HTMLElement): void
  /** Advance the one-shot. Cheap no-op before it fires and after it retires. */
  update(time: number, progress: number): void
  /** Draw, if there is anything to draw. */
  render(renderer: WebGLRenderer): void
  resize(): void
  /**
   * Whether the folders are formed and on screen — i.e. whether it makes sense
   * for them to accept a click. False again if the reader scrolls back toward
   * Scene 1, even though the formation itself never replays.
   */
  readonly live: boolean
}

export function createConstellation(): Constellation {
  const scene = new Scene()
  // CSS pixels with y running down, exactly like the DOM: left/right 0..width,
  // top/bottom 0..height. Three maps `top` to +1 and `bottom` to -1, so giving
  // it top < bottom is what flips the axis.
  const camera = new OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, 0.1, 100)
  camera.position.z = 10

  /**
   * Mipmaps off, and this is not optional — every point here draws ~2px wide,
   * which is exactly the case documented on the site's close-in star band: at
   * that size the GPU samples a mip level where this radial sprite has been
   * averaged away to nothing and the whole layer renders at a few 255ths
   * whatever colour it carries. See `three/sprite.ts`.
   */
  const sprite: CanvasTexture = createCircleTexture({ mipmaps: false })

  const sources: Source[] = []
  const color = new Color()

  /** ms since the trigger; only advances while the layer is on screen. */
  let elapsed = 0
  let prevTime = 0
  let started = false
  let finished = false
  let gate = 0
  let live = false

  function buildStart(src: Source, i: number): void {
    const i3 = i * 3
    const w = window.innerWidth
    const h = window.innerHeight
    const depth = ENTRY_GAP_PX + src.depths[i] * ENTRY_DEPTH_PX
    src.starts[i3] = src.dir > 0 ? w + depth : -depth
    src.starts[i3 + 1] = src.targets[i3 + 1] + src.spreads[i] * ENTRY_SPREAD_H * h
  }

  /**
   * Re-read where the artwork actually sits and re-aim every star at it. Also
   * where the point size comes from, since both follow the same matrix.
   */
  function reaim(src: Source): void {
    const scale = toScreenPoints(src.svg, src.glyphs, src.targets)
    if (!scale) return // not rendered (display: none, or not laid out yet)
    src.material.size = scale * POINT_SIZE_UNITS
    for (let i = 0; i < src.count; i++) buildStart(src, i)
  }

  function addSource(svg: SVGSVGElement, side: Side, host: HTMLElement): void {
    const glyphs = sampleGlyphPoints(svg, STARS_PER_FOLDER)
    if (!glyphs.length) return

    const count = glyphs.length
    const dir = side === 'right' ? 1 : -1

    // Normalised horizontal place in the artwork, which is what orders the
    // fill: the edge the stars arrive at is the edge that fills first.
    let minX = Infinity
    let maxX = -Infinity
    for (const g of glyphs) {
      if (g.x < minX) minX = g.x
      if (g.x > maxX) maxX = g.x
    }
    const span = maxX - minX || 1

    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const delays = new Float32Array(count)
    const durations = new Float32Array(count)
    const spreads = new Float32Array(count)
    const depths = new Float32Array(count)
    const bows = new Float32Array(count)
    const phases = new Float32Array(count)

    const lead = dir > 0 ? 0 : SIDE_LEAD_MS
    for (let i = 0; i < count; i++) {
      const g = glyphs[i]
      const nx = (g.x - minX) / span
      const order = dir > 0 ? 1 - nx : nx
      delays[i] = lead + STAGGER_MS * (order * ORDER_WEIGHT + Math.random() * (1 - ORDER_WEIGHT))
      durations[i] = TRAVEL_MS * rand(1 - TRAVEL_JITTER, 1 + TRAVEL_JITTER)
      spreads[i] = rand(-1, 1)
      depths[i] = Math.random()
      bows[i] = rand(-BOW_PX, BOW_PX)
      phases[i] = rand(0, Math.PI * 2)

      // The star wears the grey of the character it is going to become.
      color.setRGB(g.level, g.level, g.level)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    const geometry = new BufferGeometry()
    const posAttr = new Float32BufferAttribute(positions, 3)
    geometry.setAttribute('position', posAttr)
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))

    const material = new PointsMaterial({
      size: 2,
      // Screen space: `size` is then in CSS pixels, which is the only unit
      // that means anything against a glyph grid measured in CSS pixels.
      sizeAttenuation: false,
      map: sprite,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      opacity: 0,
    })

    const mesh = new Points(geometry, material)
    mesh.frustumCulled = false // the stars start far outside the frame
    mesh.visible = false
    scene.add(mesh)

    const src: Source = {
      svg,
      host,
      dir,
      glyphs,
      count,
      // Read back off the attribute, never the array handed to it: a
      // Float32BufferAttribute copies, so keeping the original writes to an
      // orphan. Same trap as the starfield's layers in scene.ts.
      positions: posAttr.array as Float32Array,
      posAttr,
      targets: new Float32Array(count * 3),
      starts: new Float32Array(count * 3),
      delays,
      durations,
      spreads,
      depths,
      bows,
      phases,
      mesh,
      material,
      hostOpacity: -1,
    }

    reaim(src)
    sources.push(src)
  }

  function setHostOpacity(src: Source, value: number): void {
    if (Math.abs(value - src.hostOpacity) < OPACITY_EPSILON) return
    src.hostOpacity = value
    src.host.style.opacity = String(value)
  }

  function advance(src: Source, t: number): void {
    const pos = src.positions
    const targets = src.targets
    const starts = src.starts

    for (let i = 0; i < src.count; i++) {
      const i3 = i * 3
      const local = clamp((t - src.delays[i]) / src.durations[i], 0, 1)
      const eased = 1 - Math.pow(1 - local, TRAVEL_EASE)

      const tx = targets[i3]
      const ty = targets[i3 + 1]
      let x = starts[i3] + (tx - starts[i3]) * eased
      let y = starts[i3 + 1] + (ty - starts[i3 + 1]) * eased + Math.sin(Math.PI * local) * src.bows[i]

      if (local >= 1) {
        // Landed: a wobble that dies out over SETTLE_MS, so the arrival reads
        // as settling rather than as a hard stop on a grid.
        const age = t - src.delays[i] - src.durations[i]
        if (age < SETTLE_MS) {
          const damp = (1 - age / SETTLE_MS) * SETTLE_PX
          const phase = src.phases[i] + age * SETTLE_RATE
          x += Math.cos(phase) * damp
          y += Math.sin(phase * 1.3) * damp
        }
      }

      pos[i3] = x
      pos[i3 + 1] = y
    }
    src.posAttr.needsUpdate = true
  }

  function update(time: number, progress: number): void {
    gate = clamp((progress - GATE_START) / (GATE_END - GATE_START), 0, 1)

    if (finished) {
      // Retired: the stars are gone for good, but the artwork underneath still
      // has to answer to the scroll so it never hangs over Scene 1.
      for (const src of sources) setHostOpacity(src, gate)
      live = gate > 0.99
      return
    }

    if (!started) {
      if (progress < TRIGGER_AT || !sources.length) return
      started = true
      prevTime = time
      for (const src of sources) {
        // Re-aim on the way in, not just at registration: the folders are
        // measured the moment their file lands, and the row can still settle
        // after that (a webfont arriving changes the label's height, and the
        // button is centred on it). This is the last chance to be exact, and
        // it costs one pass over the points, once.
        reaim(src)
        src.mesh.visible = true
      }
    }

    const delta = Math.min(time - prevTime, MAX_DELTA_MS)
    prevTime = time
    // Paused, not rewound, while the layer is off screen — the same treatment
    // ascii-reveal gives its draw.
    if (gate > 0) elapsed += delta

    const t = elapsed
    const forming = clamp(t / FORM_MS, 0, 1)
    const starFade = 1 - clamp((t - STAR_FADE_AT) / STAR_FADE_MS, 0, 1)
    const swap = clamp((t - SWAP_AT) / SWAP_MS, 0, 1)
    const boost = 1 + (TRAVEL_BOOST - 1) * (1 - forming)

    for (const src of sources) {
      advance(src, t)
      src.material.opacity = gate * starFade * boost
      setHostOpacity(src, gate * swap)
    }

    live = swap >= 1 && gate > 0.99

    if (t >= END_MS) {
      finished = true
      for (const src of sources) {
        src.mesh.visible = false
        src.material.opacity = 0
      }
    }
  }

  function render(renderer: WebGLRenderer): void {
    if (!started || finished) return
    renderer.render(scene, camera)
  }

  function resize(): void {
    camera.right = window.innerWidth
    camera.bottom = window.innerHeight
    camera.updateProjectionMatrix()
    for (const src of sources) reaim(src)
  }

  return {
    addSource,
    update,
    render,
    resize,
    get live() {
      return live
    },
  }
}
