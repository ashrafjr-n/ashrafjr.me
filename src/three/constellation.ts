/**
 * Scene 2's folder constellations — the stars that fly in from the screen's
 * left and right edges, gather beside the model, and turn into the SYSTEM and
 * PROJECTS folder marks.
 *
 * The trick is that there is nothing to fake. `folder.svg` is ASCII art, and
 * at the size it is drawn each character lands under ~1.2 x 2.2 CSS pixels —
 * so the artwork already *is* a field of dots. Every star here is aimed at one
 * specific character's centre (`lib/ascii-points.ts`), so when the real SVG
 * cross-fades in underneath there is nothing to line up: the picture the stars
 * built and the picture the file draws stand in the same places.
 *
 * **A star is coloured like the site's other stars, not like the character it
 * lands on.** Each one rolls its grey from the shared `star-look.ts` range —
 * the same one the ambient orbiting field uses — and the layer carries that
 * module's `STAR_OPACITY`. An earlier version instead gave each star the grey
 * of the glyph it was about to become, plus a brightness boost while it flew,
 * on the theory that matching the artwork made the swap invisible. It did, but
 * it also made the two folders read as glaring bright patches against a sky of
 * calmer stars, which is the more visible problem of the two: these have to
 * read as *the site's own stars* arriving. What the swap loses is the
 * artwork's per-glyph shading, which appears as the file takes over — at ~2px
 * a cell that is texture, not structure, and both pictures are up together
 * through the whole cross-fade anyway.
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
 * Palette: grayscale only, from `star-look.ts`.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  OrthographicCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
} from 'three'
import type { CanvasTexture, PerspectiveCamera, WebGLRenderer } from 'three'
import { clamp, rand } from '../lib/math'
import { sampleGlyphPoints, toScreenPoints, type GlyphPoint } from '../lib/ascii-points'
import { createCircleTexture } from './sprite'
import { STAR_BRIGHT_MIN, STAR_BRIGHT_MAX, STAR_OPACITY, STAR_SIZE_PER_VH } from './star-look'

/** Which screen edge a constellation's stars come in from. */
export type Side = 'left' | 'right'

/**
 * Where the stars come *from*: the close-in band orbiting the model, described
 * by the layer that owns it.
 *
 * **The values are `scene.ts`'s and stay there.** This is the same one-way
 * arrangement `star-look.ts` sets up for the colours — the constellation reads
 * the ring's shape so it can leave from it, and never edits it to suit itself.
 * The band is protected work; see the top of CLAUDE.md.
 *
 * `camera` is the world layer's bird's-eye camera, which is what turns a point
 * on that ring into a point on screen. It never moves, so a departure point
 * only has to be re-solved when the viewport changes shape.
 */
export interface RingOrigin {
  camera: PerspectiveCamera
  /** The band's own orbit radius range, before any scroll scatter. */
  radiusMin: number
  radiusMax: number
  /** The heights its stars sit at. */
  yMin: number
  yMax: number
  /** Extra orbit radius a band star gains by full scroll, and its ease curve. */
  scatterMin: number
  scatterMax: number
  scatterEase: number
}

/**
 * Characters sampled per folder. Chosen against the artwork's own grid rather
 * than picked: folder.svg carries 10,448 glyphs, so this takes roughly every
 * second one, which puts the sampled points **~2.26px apart horizontally
 * against the ~2.22px the lines already sit apart vertically** — a square
 * grid.
 *
 * That evenness is the whole reason for the number, and it survived the stars
 * being shrunk to the size the orbiting ones draw at (see STAR_SIZE_PER_VH):
 * a ~1.06px dot on a square ~2.2px grid is an even stipple, where doubling the
 * count would only close the horizontal gaps — the line pitch is fixed by the
 * file — and turn the folder into dense scan lines with clear gaps between
 * them. Halving it reads as horizontal dashes for the same reason.
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
/**
 * How much of the window one star's own flight takes, and how much that varies
 * per star.
 *
 * **These two are what decide whether the stars arrive in a queue or as one
 * swarm, and the span is the lever — not the speed.** A star's delay is drawn
 * from whatever is left of the window after its own flight, so the spread of
 * departures and the length of a flight trade directly against each other:
 * peak concurrency is about `span / (1 - span)`. At the original 0.55 that
 * came out over 1, i.e. **every star in a folder was airborne at the same
 * instant** — 5188 of 5200, measured — so the whole cloud crossed the screen
 * as a single body and the folder went from 3% filled to 100% in the last
 * fifth of the window.
 *
 * At 0.26 the peak is ~60% (about 3100 stars), departures spread over 0.79 of
 * the window instead of 0.54, and the folder now fills progressively —
 * 5% / 38% / 83% at the same points it used to sit at 0% / 0% / 52%. Stars
 * land while others are still setting off, which is the whole point.
 *
 * **Do not push it much lower.** Concurrency falls off fast from here and the
 * stream thins toward a single file, which is a different, worse look. The
 * jitter (0.30, so flights vary 1.86x in length) is what keeps the front
 * ragged rather than a moving wall at any span.
 */
const TRAVEL_SPAN = 0.26
const TRAVEL_JITTER = 0.3
/**
 * How much of a star's departure point follows its place in the artwork rather
 * than chance. The folder fills from the edge the stars arrive at, inward, so
 * the stream reads as depositing itself; pure randomness reads as static.
 *
 * Lowered from 0.7 alongside the span above: at 0.7 a star's departure was
 * mostly a function of its x, so everything bound for the same column left
 * together and the front arrived as a coherent vertical wall. Half positional
 * is enough to keep the edge-inward fill legible while leaving the front
 * ragged.
 */
const ORDER_WEIGHT = 0.5
/** The left side sets off this much later than the right — mirrored looks mechanical. */
const SIDE_LEAD = 0.06
/**
 * Deceleration exponent. Strongly eased out: the stars arrive fast and settle
 * slowly, which is what sells them as coming to rest rather than stopping.
 */
const TRAVEL_EASE = 3.4

// --- Where they come from ---
//
// **A star leaves from the ring around the model, at the point the ring has
// reached by the moment it sets off.** That is the whole idea: the band
// scattering outward and the folders assembling are not two things that happen
// to overlap — the folders are made *of* the ring, and each star is shed from
// it as it goes past. It replaced a departure from off the screen's left and
// right edges, which read as a second, unrelated event arriving after the ring
// had broken up.
//
// The departure point is a pure function of the star's own constants, exactly
// like everything else here: its place on the ring, and the radius the ring has
// scattered to at that star's own delay. So a star that leaves early peels off
// close in, while the ring is still near the model, and a late one leaves from
// far out — the departure ellipse grows with the ring instead of sitting still
// off the frame. Where that lands on screen is read off the world camera by
// projecting the ring itself, so it follows the real band at any aspect; see
// `buildStart()`.
//
// **Nothing here touches the band.** It reads the band's shape through
// `RingOrigin` and leaves from it. See the note on that interface.
/**
 * How much of a star's own flight it spends fading up from nothing.
 *
 * **This is what makes the ring departure work at all, not a flourish.** A star
 * waiting for its delay sits parked at its departure point, and those points
 * are now *on screen* for everything leaving early — where the old off-screen
 * edges hid them for free. Parked stars would read as a static arc sitting over
 * the transition. Fading on travelled distance rather than on time keeps the
 * birth tight against the ring: at 5% of the way across, a star appears
 * essentially where the ring's own stars are, so it reads as one of them coming
 * loose rather than as a new star switching on.
 */
const BIRTH_SPAN = 0.05
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
 * Whether the real `folder.svg` is allowed to cross-fade in underneath at all.
 *
 * **A test switch, deliberately left in place.** The stars and the artwork
 * overlap for the last fifth of the window, so anything anyone says about how
 * the folder looks is a judgement about the two of them together. Turning this
 * off is the only way to see what the stars alone actually build — and whether
 * the file is carrying the picture or just standing behind it.
 *
 * It gates the *artwork* and nothing else. `live` is still computed from the
 * real cross-fade below, so the words go live and their labels appear exactly
 * when they always did, whichever way this is set.
 */
const SHOW_ARTWORK = false

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
  glyphs: GlyphPoint[]
  count: number
  /** Screen-space xyz per star, re-projected on every resize. */
  targets: Float32Array
  starts: Float32Array
  /** Per-star constants, all viewport-independent so a resize keeps them. */
  delays: Float32Array
  durations: Float32Array
  /** Where on the scattering ring this star rode, and how hard it scatters. */
  ringAngles: Float32Array
  ringRadii: Float32Array
  ringHeights: Float32Array
  ringScatter: Float32Array
  bows: Float32Array
  /** Each star's own grey, which `place()` scales by its birth fade. */
  greys: Float32Array
  positions: Float32Array
  posAttr: Float32BufferAttribute
  colors: Float32Array
  colAttr: Float32BufferAttribute
  mesh: Points
  material: PointsMaterial
  hostOpacity: number
  /** Targets measured against a laid-out page at least once. */
  aimed: boolean
}

export interface Constellation {
  /**
   * Register one folder: its injected `<svg>` (where the target points are
   * read from), the screen edge its stars arrive from, and the element whose
   * opacity is the other half of the cross-fade.
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

export function createConstellation(origin: RingOrigin): Constellation {
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

  /** Position in the ENTER_AT..FORM_AT window, 0..1. The only state there is. */
  let placedAt = -1
  let drawing = false
  let live = false

  /** Scratch for the world -> screen projection; nothing is allocated per star. */
  const worldPoint = new Vector3()
  const ringPx = { x: 0, y: 0 }
  const axisPx = { x: 0, y: 0 }

  /**
   * A world point through the model's own camera, in the same CSS pixels this
   * layer draws in — the browser's y-down screen coordinates, not Three's NDC.
   */
  function project(x: number, y: number, z: number, out: { x: number; y: number }): void {
    worldPoint.set(x, y, z).project(origin.camera)
    out.x = (worldPoint.x * 0.5 + 0.5) * window.innerWidth
    out.y = (1 - (worldPoint.y * 0.5 + 0.5)) * window.innerHeight
  }

  /**
   * Where this star comes off the ring: its own place on the band, carried out
   * to the radius the band has scattered to by the moment it sets off.
   *
   * The scattered radius is solved on screen rather than in the world, by
   * projecting the band at its *own* radius and then running that offset out
   * from the model's axis. A ring that has flown out to twenty-odd units is
   * partly behind this camera, where a projection folds back on itself and
   * gives nonsense; the band at rest never is. Extrapolating the offset instead
   * is exact where it matters — the departure ellipse's shape, tilt and centre
   * all come from the real projection, and only its size is scaled.
   */
  function buildStart(src: Source, i: number): void {
    const i3 = i * 3
    const angle = src.ringAngles[i]
    const radius = src.ringRadii[i]
    const height = src.ringHeights[i]

    project(0, height, 0, axisPx)
    project(Math.cos(angle) * radius, height, Math.sin(angle) * radius, ringPx)

    // The scroll position this star departs at, and therefore how far the band
    // has scattered by then — the same `progress ^ ease` curve `scene.ts`
    // advances the band on, read from RingOrigin rather than restated here.
    const departAt = ENTER_AT + src.delays[i] * (FORM_AT - ENTER_AT)
    const scattered = src.ringScatter[i] * Math.pow(departAt, origin.scatterEase)
    const reach = 1 + scattered / radius

    src.starts[i3] = axisPx.x + (ringPx.x - axisPx.x) * reach
    src.starts[i3 + 1] = axisPx.y + (ringPx.y - axisPx.y) * reach
  }

  /** Re-read where the artwork actually sits and re-aim every star at it. */
  function reaim(src: Source): void {
    // Sized off the viewport, not off the artwork's own scale: these have to
    // draw at exactly the width the orbiting stars do, and that is what
    // follows the viewport height. See STAR_SIZE_PER_VH.
    src.material.size = STAR_SIZE_PER_VH * window.innerHeight

    const scale = toScreenPoints(src.svg, src.glyphs, src.targets)
    if (!scale) return // not rendered (display: none, or not laid out yet)
    // The departure points are projected through the world camera, which is
    // only walked as part of a render — and the first reaim can land before one
    // has happened.
    origin.camera.updateMatrixWorld()
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
    const ringAngles = new Float32Array(count)
    const ringRadii = new Float32Array(count)
    const ringHeights = new Float32Array(count)
    const ringScatter = new Float32Array(count)
    const bows = new Float32Array(count)
    const greys = new Float32Array(count)

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
      bows[i] = rand(-BOW_PX, BOW_PX)

      // Its seat on the band, rolled the way `scene.ts` rolls the band's own:
      // a radius and a height inside the ring's window, and its own share of
      // the scatter. The half of the ring it sits on is the folder's own side,
      // so each mark is visibly drawn off the near arc rather than both of them
      // picking stars out of the same crowd. `x = cos(angle)`, so the quarter
      // turns either side of 0 are the half nearer the right-hand folder.
      ringAngles[i] = rand(-Math.PI / 2, Math.PI / 2) + (dir > 0 ? 0 : Math.PI)
      ringRadii[i] = rand(origin.radiusMin, origin.radiusMax)
      ringHeights[i] = rand(origin.yMin, origin.yMax)
      ringScatter[i] = rand(origin.scatterMin, origin.scatterMax)

      // Exactly the site's own star shading — the same grayscale range the
      // ambient orbiting field rolls from, per star, from the shared module.
      // These have to read as the site's stars arriving, so they get no
      // palette of their own. Kept, rather than only written into the buffer,
      // because `place()` scales it by the star's birth fade every frame.
      greys[i] = rand(STAR_BRIGHT_MIN, STAR_BRIGHT_MAX)
    }

    const geometry = new BufferGeometry()
    const posAttr = new Float32BufferAttribute(positions, 3)
    const colAttr = new Float32BufferAttribute(colors, 3)
    geometry.setAttribute('position', posAttr)
    geometry.setAttribute('color', colAttr)

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
      glyphs,
      count,
      // Read back off the attribute, never the array handed to it: a
      // Float32BufferAttribute copies, so keeping the original writes to an
      // orphan. Same trap as the starfield's layers in scene.ts.
      positions: posAttr.array as Float32Array,
      posAttr,
      colors: colAttr.array as Float32Array,
      colAttr,
      targets: new Float32Array(count * 3),
      starts: new Float32Array(count * 3),
      delays,
      durations,
      ringAngles,
      ringRadii,
      ringHeights,
      ringScatter,
      bows,
      greys,
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
    const col = src.colors
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

      // Born out of the ring over the first few percent of its own crossing —
      // so a star still waiting its turn contributes nothing, which is what
      // keeps the departure points from reading as a static arc parked over
      // the model. Scaling the grey does the work of an alpha: the material is
      // additively blended, so `colour * 0` is the same as not being there.
      const birth = eased < BIRTH_SPAN ? eased / BIRTH_SPAN : 1
      const v = src.greys[i] * birth
      col[i3] = v
      col[i3 + 1] = v
      col[i3 + 2] = v
    }
    src.posAttr.needsUpdate = true
    src.colAttr.needsUpdate = true
  }

  function update(progress: number): void {
    if (!sources.length) return

    // The whole state of this layer, from one number. Scrolling back up runs
    // every one of these backwards, which is the point.
    const p = clamp((progress - ENTER_AT) / (FORM_AT - ENTER_AT), 0, 1)
    // The stars only fade out because the artwork is there to be left behind.
    // With SHOW_ARTWORK off there is nothing to hand over to, so they stay —
    // otherwise the test would end on an empty screen rather than on the
    // picture it is meant to be judging.
    const starFade = SHOW_ARTWORK
      ? 1 - clamp((progress - FORM_AT) / (FADE_END - FORM_AT), 0, 1)
      : 1
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
      // The artwork's half of the cross-fade — and the only thing SHOW_ARTWORK
      // touches. `live` above is read off the real `swap` regardless.
      setHostOpacity(src, SHOW_ARTWORK ? swap : 0)
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
