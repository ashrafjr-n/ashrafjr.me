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
 * **Every position here is a pure function of the scroll**, like the rest of
 * the transition — nothing is accumulated, nothing runs on a clock. Scroll
 * down and the stars fly in and build the folder; scroll back up and they take
 * it apart and leave the way they came, exactly reversed. This replaced a
 * one-shot that played on wall-clock time the first time the scroll crossed a
 * threshold; the version that reads the scroll is both better to watch and the
 * one that matches how everything else in `scene.ts` works.
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
import { STAR_BRIGHT_MIN, STAR_BRIGHT_MAX, STAR_OPACITY } from './star-look'

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

// --- The scroll window ---
/**
 * Scroll progress at which the first stars start entering, and at which the
 * last one lands.
 *
 * `ENTER_AT` is measured against when the sky actually empties, not guessed.
 * Counting stars inside the frustum across the scroll: the ambient cloud is
 * gone by ~0.42, and the close-in band still has **33% of its stars on screen
 * at 0.45**, 21% at 0.50 and 5% at 0.60. Starting here means the arriving
 * stream genuinely crosses the departing one during the band's last stretch,
 * rather than waiting for a blank sky — which is the point, and which is what
 * a later start got wrong.
 *
 * `FORM_AT` leaves the last 8% of the scroll as a settled folder.
 */
const ENTER_AT = 0.45
const FORM_AT = 0.92
/** Progress at which the stars themselves have fully gone, leaving the artwork. */
const FADE_END = 0.97

// --- The flight, all in fractions of the ENTER_AT..FORM_AT window ---
/** How much of the window one star's own flight takes, and its per-star spread. */
const TRAVEL_SPAN = 0.55
const TRAVEL_JITTER = 0.18
/**
 * How much of a star's departure point follows its place in the artwork rather
 * than chance. The folder fills from the edge the stars arrive at, inward, so
 * the stream reads as depositing itself; pure randomness reads as static.
 */
const ORDER_WEIGHT = 0.7
/** The left side sets off this much later than the right — mirrored looks mechanical. */
const SIDE_LEAD = 0.06
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

// --- The swap ---
/**
 * Where in the window the artwork starts fading in. It reaches full exactly at
 * the end of it — i.e. as the last stars land — so the two pictures overlap
 * rather than hand over. Additive blending means the overlap just reads as the
 * constellation settling to its final brightness.
 *
 * There is deliberately **no settle wobble** on a landed star. The one this
 * had was a decaying oscillation in wall-clock time, which cannot survive
 * being driven by the scroll: it would freeze mid-wobble the moment the reader
 * stopped scrolling. A star lands and stays exactly landed.
 */
const SWAP_START = 0.78

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

/**
 * Smallest change in window position worth re-walking the points for. The
 * scroll is lerped, so it keeps moving for a moment after the reader stops and
 * then settles — below this the positions are already right and the whole
 * per-frame pass is skipped.
 */
const STEP_EPSILON = 0.0002

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
  positions: Float32Array
  posAttr: Float32BufferAttribute
  mesh: Points
  material: PointsMaterial
  hostOpacity: number
  /** Targets measured against a laid-out page at least once. */
  aimed: boolean
}

export interface Constellation {
  /**
   * Register one folder: its injected `<svg>` (the source of both the target
   * points and their greys), the screen edge its stars arrive from, and the
   * element whose opacity is the other half of the cross-fade.
   */
  addSource(svg: SVGSVGElement, side: Side, host: HTMLElement): void
  /**
   * Place everything for this scroll position. Pure — the same `progress`
   * always produces the same frame — and a cheap no-op outside the window.
   */
  update(progress: number): void
  /** Draw, if there is anything to draw. */
  render(renderer: WebGLRenderer): void
  resize(): void
  /**
   * Whether the folders are formed and on screen — i.e. whether it makes sense
   * for them to accept a click. False again the moment the reader scrolls back
   * up far enough to start taking them apart.
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

  /** Position in the ENTER_AT..FORM_AT window, 0..1. The only state there is. */
  let placedAt = -1
  let drawing = false
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
    src.aimed = true
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

    const lead = dir > 0 ? 0 : SIDE_LEAD
    for (let i = 0; i < count; i++) {
      const g = glyphs[i]
      const nx = (g.x - minX) / span
      const order = dir > 0 ? 1 - nx : nx
      const duration = TRAVEL_SPAN * rand(1 - TRAVEL_JITTER, 1 + TRAVEL_JITTER)
      // Delay + duration can never exceed the window: the slack left over
      // after this star's own flight is all there is to spend on waiting, so
      // the last star lands exactly at FORM_AT however the dice fell.
      const slack = Math.max(0, 1 - duration - lead)
      durations[i] = duration
      delays[i] = lead + slack * (order * ORDER_WEIGHT + Math.random() * (1 - ORDER_WEIGHT))
      spreads[i] = rand(-1, 1)
      depths[i] = Math.random()
      bows[i] = rand(-BOW_PX, BOW_PX)

      // Exactly the site's own star shading — the same grayscale range the
      // ambient orbiting field rolls from, per star, from the shared module.
      // These have to read as the site's stars arriving, so they get no
      // palette of their own.
      const v = rand(STAR_BRIGHT_MIN, STAR_BRIGHT_MAX)
      color.setRGB(v, v, v)
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
      mesh,
      material,
      hostOpacity: -1,
      aimed: false,
    }

    reaim(src)
    sources.push(src)
  }

  function setHostOpacity(src: Source, value: number): void {
    if (Math.abs(value - src.hostOpacity) < OPACITY_EPSILON) return
    src.hostOpacity = value
    src.host.style.opacity = String(value)
  }

  /** Place every star for window position `p` (0..1). No state, no history. */
  function place(src: Source, p: number): void {
    const pos = src.positions
    const targets = src.targets
    const starts = src.starts

    for (let i = 0; i < src.count; i++) {
      const i3 = i * 3
      const local = clamp((p - src.delays[i]) / src.durations[i], 0, 1)
      const eased = 1 - Math.pow(1 - local, TRAVEL_EASE)

      const sx = starts[i3]
      const sy = starts[i3 + 1]
      pos[i3] = sx + (targets[i3] - sx) * eased
      pos[i3 + 1] =
        sy + (targets[i3 + 1] - sy) * eased + Math.sin(Math.PI * local) * src.bows[i]
    }
    src.posAttr.needsUpdate = true
  }

  function update(progress: number): void {
    if (!sources.length) return

    // The whole state of this layer, from one number. Scrolling back up runs
    // every one of these backwards, which is the point.
    const p = clamp((progress - ENTER_AT) / (FORM_AT - ENTER_AT), 0, 1)
    const starFade = 1 - clamp((progress - FORM_AT) / (FADE_END - FORM_AT), 0, 1)
    const swap = clamp((p - SWAP_START) / (1 - SWAP_START), 0, 1)
    const opacity = STAR_OPACITY * starFade

    live = swap >= 1
    drawing = p > 0 && opacity > OPACITY_EPSILON

    const moved = Math.abs(p - placedAt) >= STEP_EPSILON
    if (moved) placedAt = p

    for (const src of sources) {
      // Aim on the way in rather than only at registration: a folder is
      // measured the moment its file lands, and the row can still settle after
      // that (a webfont arriving changes the label's height, and the button is
      // centred on it). Cheap, and it happens once per source.
      if (drawing && !src.aimed) reaim(src)
      src.mesh.visible = drawing
      if (drawing && moved) place(src, p)
      src.material.opacity = opacity
      setHostOpacity(src, swap)
    }
  }

  function render(renderer: WebGLRenderer): void {
    if (!drawing) return
    renderer.render(scene, camera)
  }

  function resize(): void {
    camera.right = window.innerWidth
    camera.bottom = window.innerHeight
    camera.updateProjectionMatrix()
    for (const src of sources) reaim(src)
    placedAt = -1 // every start position moved; the next frame has to re-place
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
