/**
 * Base Three.js scene — an orbiting starfield, plus the Scene 1 world layer
 * (the model) composited on top of it.
 *
 * The stars orbit the model's centre on roughly the model's own orbital plane,
 * each at its own randomised speed, so they read as one system with the stars
 * embedded in the model rather than as a separate dolly-ing backdrop. Mouse
 * parallax is layered on top via shared input state, lerped for smooth motion.
 *
 * Two render passes share one renderer. The starfield is drawn through the
 * world layer's bird's-eye camera, then — behind a depth clear, so the model
 * always sits in front of the stars — the model through its own front-on
 * camera.
 * Palette: white/silver/gray only — no color pops.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { clamp, rand } from '../lib/math'
import { HOLD, toModel, toTransition } from '../lib/phases'
import type { InputState } from '../lib/state'
import { createCircleTexture } from './sprite'
import { createWorld, MODEL_SPIN_RATE } from './world'

export interface SceneController {
  /** Advances and renders a frame. Returns the smoothed 0..1 page scroll so
   *  DOM-side pieces stay on the exact same driver — map it through
   *  `lib/phases.ts` the same way this does. */
  update(time: number, state: InputState): number
  /**
   * Re-anchor the frame clock to now, after a stretch of frames was skipped.
   * Call it on the way back in, not on the way out — see the note on the
   * implementation.
   */
  resync(): void
  resize(): void
}

// The camera sits inside the cloud and only a narrow cone of it is ever on
// screen, so the count is high to keep the on-screen star density looking the
// way it did before. Points are cheap; only the angle is recomputed per frame.
const PARTICLE_COUNT = 20000

// --- Orbital cloud ---
// Distances are in the world layer's units, where the model spans ~3.5, so the
// stars sit in the same space as the model's own embedded stars.
//
// The shape is a flattened ball centred on the model, not a thin disc. The
// camera pitches ~63° down, so its frustum dives straight through a thin disc
// and out the underside within ~25 units — which leaves the frame empty. A
// squashed ball keeps stars all around the frustum while FLATTEN still biases
// them toward the model's own plane. Every star orbits the same Y axis either
// way, so the motion reads as one system regardless of the thickness.
const CLOUD_RADIUS = 62
const CLOUD_INNER = 3 // keeps stars off the camera's lens
/**
 * Three scales points as `size * 0.5 * drawingBufferHeight / distance` — fov
 * plays no part — so this is set from the old deep field's size/distance ratio
 * to keep dots the same size on screen.
 */
const CLOUD_POINT_SIZE = 0.11
const CLOUD_FLATTEN = 0.7 // y squash: < 1 favours the model's orbital plane
/**
 * Caps how close to the poles a star may sit, as |cos(polar angle)|. A star
 * near the rotation axis has a near-zero orbit radius, so it turns on the spot
 * and reads as frozen no matter how fast it spins — which is what made the
 * orbiting hard to see. Capping this gives every star a real orbit radius
 * (>= 0.6 x its distance) and flattens the cloud a little further toward the
 * model's own plane.
 */
const POLAR_LIMIT = 0.8

// Angular speeds, all in the model's own direction of spin, expressed as
// multiples of MODEL_SPIN_RATE — the rate the model's own embedded stars travel
// at. Anchoring here is what makes the two sets read as one system: the slow
// tier sits around the model's own rate rather than well below it, so no site
// star crawls while the model's stars sweep past it.
//
// Tiered, and randomised within each tier, so the field never looks mechanical.
const SPEED_TIERS = [
  { chance: 0.78, min: 0.8, max: 1.4 }, // most: near the model's own rate
  { chance: 0.18, min: 1.4, max: 2.6 }, // some: clearly quicker
  { chance: 0.04, min: 2.6, max: 5.0 }, // few: streak past
]

/**
 * The ambient field's shading: grayscale from pure white down to a slightly
 * dimmer silver-white, never tinted. Deliberately not the band's brighter look
 * (`BAND_BRIGHT_*` below).
 */
const STAR_BRIGHT_MIN = 0.78
const STAR_BRIGHT_MAX = 1.0
const STAR_OPACITY = 0.85

// --- Close-in orbit band ---
// The wide cloud can never show a full loop: the camera sits *inside* it
// (10.4 units from the centre, radii out to 62), so most of any orbit passes
// beside or behind the camera and the visible part is only a ~40° arc. This
// band is the set of orbits that *do* stay on screen for a whole revolution.
//
// The window is tight and was solved against the camera frustum — do not widen
// it without re-deriving:
//   inner bound: the model's slab is square, so its corners reach
//     MODEL_SPAN * sqrt(2)/2 = 2.47. Inside that the model draws over the band
//     (the world layer renders after a depth clear) and the loop breaks.
//   outer bound: beyond ~2.85 at y=0 the orbit's near side leaves the frame.
//   height: below y=-0.5 and above y=+1.5 the window closes completely.
const BAND_COUNT = 600
const BAND_RADIUS_MIN = 2.6
const BAND_RADIUS_MAX = 2.8
const BAND_Y_MIN = 0.0
const BAND_Y_MAX = 1.0
/**
 * The band sits ~10 units from the camera against the wide field's ~45, and
 * Three scales points by `size * 0.5 * height / distance`, so it needs its own
 * smaller size to draw dots the same size on screen.
 */
const BAND_POINT_SIZE = 0.025
/**
 * The band reads brighter and whiter than the ambient field: near-pure white
 * against the field's dimmer silver spread, at full opacity. Brightness only —
 * its size, motion, speed and scatter are untouched by these.
 */
const BAND_BRIGHT_MIN = 0.96
const BAND_BRIGHT_MAX = 1.0
const BAND_OPACITY = 1.0

/**
 * A random ~35% of band stars are taken to full, clear white, so the ring reads
 * as mixed rather than uniformly faint. Rolled per star, so it is a different
 * scattering of stars on every load rather than a fixed pattern. The other ~65%
 * keep their BAND_BRIGHT_* roll untouched.
 *
 * `BAND_CLEAR_LEVEL` deliberately pushes the vertex colour **far above 1**. The
 * band's base is already near-pure white at full opacity, so there is no
 * headroom left inside 0..1; with additive blending and the soft radial sprite,
 * an over-1 colour drives more of each dot's falloff to full white, which is
 * what makes a dot read as a clear point rather than a dim smudge. It stays
 * grayscale, so the palette holds.
 *
 * It is one flat value, not a range: the chosen stars are meant to be fully
 * bright, and a random multiplier left some of them only part of the way there.
 * Brightness only — count, motion, orbit and scatter are untouched by these.
 */
const BAND_CLEAR_CHANCE = 0.35
const BAND_CLEAR_LEVEL = 4.0

// --- Scene 1 -> Scene 2 scroll transition ---
/**
 * How fast the page value chases raw scroll — the natural frequency of the
 * **critically damped spring** it is chased with, in radians per second.
 *
 * Every part of the transition reads this one smoothed value, so the spin, the
 * growth, the scatter, the fly-past and the identity scene stay locked
 * together. What it is smoothed *with* is what decides whether the scroll
 * feels smooth:
 *
 * - The old form was a first-order chase, `page += (target - page) * (1 -
 *   exp(-rate * delta))`. That has no memory of its own speed, so the instant
 *   the target moves the output's velocity moves with it. Scroll does not
 *   arrive continuously — a wheel delivers it in coarse notches — so the
 *   output's velocity was a sawtooth even while the value itself looked
 *   smooth, and that is what reads as a rough scroll.
 * - A critically damped spring carries velocity as state, so it can only
 *   *accelerate* toward a new target. Velocity is continuous whatever shape
 *   the input arrives in, and critical damping is what guarantees it settles
 *   without ever overshooting past the scroll position the reader chose.
 *
 * Integrated semi-implicitly (velocity first, then position), which stays
 * stable for any `OMEGA * delta` well under 2 — `delta` is clamped to 0.1s
 * upstream, so the worst case here is 0.7.
 *
 * 7.0 tracks a held scroll with the same ~0.29s lag the old rate-5 chase had,
 * so the transition has not been slowed down; only its velocity was smoothed.
 */
const SCROLL_OMEGA = 7.0

/**
 * Per-second rate the page value trails the spring at — the **second** stage of
 * the smoothing, and the one that gives the whole site its coast.
 *
 * The spring alone is already velocity-continuous, but it still arrives with
 * the scroll: stop the wheel and it is essentially there. Chasing its output
 * with a time-based exponential adds a stage whose *acceleration* is continuous
 * too, so nothing on the page ever changes speed abruptly — the motion carries
 * on past the gesture and eases down into its resting place instead of landing
 * with it.
 *
 * **This is not new behaviour, it is the identity scene's own smoothing made
 * shared.** That scene used to chase the page value privately at this exact
 * rate, which is why its fill read better than everything else on the page.
 * Doing it once here means the stars, the model, the intro line and the
 * statements are all on the identical curve rather than the type being smoother
 * than the thing behind it — and the identity scene's fill is unchanged to the
 * frame, since it was already the composition of these two stages.
 *
 * Together they cost about 0.6s of lag on a held scroll. That is deliberate and
 * it is the top of the usable range: the page still tracks the reader, but it
 * finishes the sentence they started.
 */
const SCROLL_TRAIL = 3.2

/**
 * Whether the reader has asked their system for less motion.
 *
 * **The smoothing is the part that has to go.** Everything on this page is a
 * pure function of the page value, so the two stages above are what put ~0.6s
 * of travel between the reader's gesture and the screen — the scroll carries on
 * after the wheel stops, the model keeps rising, the stars keep streaming. That
 * coast is the whole point of the effect and it is exactly the kind of
 * uncommanded movement that triggers vestibular symptoms. With this on, `page`
 * *is* the scroll position: the page still moves through all three scenes, but
 * only while the reader is moving it, and it stops dead when they do.
 *
 * `matches` is live, so it is read per frame rather than listened to — the
 * setting can be changed mid-session and the next frame honours it, and both
 * stages are kept synced so switching back cannot jump.
 */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

/**
 * Extra orbit radius each band star gains by full scroll — it flies apart.
 *
 * These ranges and the easing exponents below were solved against the frustum
 * rather than guessed: displacement that is too large empties the frame within
 * the first fifth of the scroll and leaves nothing to watch for the rest of it.
 * Both layers stay populated the whole way down with these values. Re-check
 * with the same method before changing them.
 */
const BAND_SCATTER_MIN = 8
const BAND_SCATTER_MAX = 26
/** Ease-in on the scatter, so the ring holds its shape before breaking up. */
const BAND_SCATTER_EASE = 2.2
/**
 * Extra orbit angle the band sweeps by full scroll, on the same eased curve as
 * the scatter — so the ring spirals outward instead of flying straight apart.
 * Positive: the band's own clockwise direction. Pure function of progress, so
 * scrolling back up unwinds it exactly.
 */
const BAND_SWIRL = Math.PI * 2

/**
 * The ring **leaves the screen** before identity arrives — it is never faded.
 *
 * This was a fade once and that was wrong: the stars dimmed in place and read
 * as being switched off rather than as going somewhere. They keep their full
 * brightness the whole way now and simply fly out of frame, exactly as the
 * ambient cloud does, so the two layers clear the screen the same way.
 *
 * The scatter alone cannot do it. It is eased (`BAND_SCATTER_EASE`) so the ring
 * holds its shape early, which leaves it only ~17% of the way out at HOLD —
 * radius ~4 to 7, still well inside the frame — and the honest fix is not to
 * flatten that easing, which is what gives Scene 1's break-up its shape. So the
 * band gets the cloud's other move as well: a straight run along the
 * model -> camera axis, ramped in late and hard, that takes it past the lens
 * and out. Measured against the frustum, **anything past radius 8 from the
 * model's axis is off screen at every angle and height the band occupies**, and
 * these distances clear the camera itself (10.4 units) several times over.
 *
 * It is monotonic and clamps at HOLD, so the ring is gone the frame identity's
 * stretch begins and never comes back.
 */
const BAND_EXIT_FROM = 0.26
const BAND_EXIT_MIN = 28
const BAND_EXIT_MAX = 46
/** Ease-in, so the ring drifts off before it streaks off. */
const BAND_EXIT_EASE = 2.0

/**
 * How far out the band is, 0..1 of each star's scatter, at a transition value.
 *
 * It holds at its HOLD value for good. The ring used to gather back in across
 * Scene 3, unwinding the swirl; the ring now leaves the screen entirely at the
 * end of Scene 1 and there is nothing left up there to gather.
 */
function bandScatterAt(p: number): number {
  return Math.pow(Math.min(p, HOLD), BAND_SCATTER_EASE)
}

/** How far along its run off the screen the band is, 0..1. Monotonic. */
function bandExitAt(p: number): number {
  return Math.pow(clamp((p - BAND_EXIT_FROM) / (HOLD - BAND_EXIT_FROM), 0, 1), BAND_EXIT_EASE)
}

/**
 * How far each ambient star travels toward the camera by full scroll. The
 * furthest a star can start behind the camera along this axis is 62 (cloud
 * radius) + 10.2 (the camera's own offset) = 72.2. Sizing the travel just under
 * that is deliberate: successively deeper stars sweep through the visible cone
 * as the scroll runs, so the field keeps streaming instead of emptying at once,
 * and is fully past the camera by Scene 2.
 */
const FLY_DISTANCE_MIN = 60
const FLY_DISTANCE_MAX = 75
/** Ease-in on the fly-past, so stars build up speed rather than lurching off. */
const FLY_EASE = 1.6

// --- Interaction tuning (mouse parallax; gentle / clamped) ---
const MAX_TILT = 0.09 // max parallax tilt from the mouse (~5°), radians
const TILT_LERP = 0.05 // how fast tilt eases toward the target

/** A set of stars orbiting the model's vertical axis, drawn as one Points. */
interface StarLayer {
  points: Points
  count: number
  radii: Float32Array
  heights: Float32Array
  angles: Float32Array
  speeds: Float32Array
  /** Per-star extra orbit radius at full scroll — the band flying apart. */
  scatter: Float32Array | null
  /** Per-star travel toward the camera at full scroll — the ambient fly-past. */
  fly: Float32Array | null
  /** Extra orbit angle at full scroll — the band spiralling as it scatters. */
  swirl: number
  /** Maps scroll progress to how far along this layer's displacement is. */
  curve: (progress: number) => number
  /**
   * The same, for the fly-past alone, when it is not on the same curve as the
   * scatter. The band needs both: an eased scatter that holds its ring shape
   * early, and a late, hard run off the screen. Defaults to `curve`.
   */
  flyCurve: (progress: number) => number
  /**
   * The attribute's **own** backing array, written directly each frame.
   *
   * This must be read back off the attribute, never kept from the array passed
   * to the constructor: `Float32BufferAttribute` does `new Float32Array(array)`,
   * so it copies. Holding the pre-fill array instead writes to an orphan copy
   * and freezes every layer — the band visibly, the cloud silently.
   */
  positions: Float32Array
  /** Flagged after each write so Three re-uploads the buffer. */
  posAttr: Float32BufferAttribute
}

/**
 * Advance every star in a layer along its own circle, then apply whichever
 * scroll-driven displacement that layer carries.
 *
 * The orbit angle is unbounded and only ever increases, so the underlying
 * motion stays a true endless 360° revolution — there is no clamp, wrap or
 * easing here by design.
 *
 * Both displacements are computed *from* `progress` rather than accumulated
 * frame to frame. That makes the whole transition a pure function of scroll
 * position, so scrubbing back up rewinds it exactly instead of drifting — and
 * it is why the fly-past needs no wrap-around: a star that has passed the
 * camera simply keeps going, and nothing brings it back into view.
 *
 * `flyX/Y/Z` is the unit vector from the model toward the camera.
 */
function advance(
  layer: StarLayer,
  delta: number,
  progress: number,
  flyX: number,
  flyY: number,
  flyZ: number,
): void {
  const arr = layer.positions
  // Same scroll value for every layer; each just responds on its own curve —
  // and the band's two displacements are on two different ones.
  const t = layer.curve(progress)
  const flyT = layer.flyCurve(progress)

  for (let i = 0; i < layer.count; i++) {
    const angle = layer.angles[i] + layer.speeds[i] * delta
    layer.angles[i] = angle

    const radius = layer.scatter ? layer.radii[i] + layer.scatter[i] * t : layer.radii[i]
    const shown = angle + layer.swirl * t
    let x = Math.cos(shown) * radius
    let y = layer.heights[i]
    let z = Math.sin(shown) * radius

    if (layer.fly) {
      const travelled = layer.fly[i] * flyT
      x += flyX * travelled
      y += flyY * travelled
      z += flyZ * travelled
    }

    const i3 = i * 3
    arr[i3] = x
    arr[i3 + 1] = y
    arr[i3 + 2] = z
  }
  layer.posAttr.needsUpdate = true
}

/**
 * Pick an orbital speed from the weighted tiers, randomised within the tier.
 * Tier bounds are multiples of the model's own spin rate.
 */
function randomOrbitSpeed(): number {
  let roll = Math.random()
  for (const tier of SPEED_TIERS) {
    if (roll < tier.chance) return rand(tier.min, tier.max) * MODEL_SPIN_RATE
    roll -= tier.chance
  }
  const last = SPEED_TIERS[SPEED_TIERS.length - 1]
  return rand(last.min, last.max) * MODEL_SPIN_RATE
}

export function initScene(canvas: HTMLCanvasElement): SceneController {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.setClearColor(0x000000, 0) // transparent: the CSS black shows through
  renderer.autoClear = false // three passes per frame, cleared manually below

  // Named for what it holds: the star layers only. The model lives in the
  // world layer's own scene, which is rendered separately below.
  const starfield = new Scene()

  /**
   * The ambient cloud's sprite. Its points range from ~2px out at the cloud's
   * far edge to ~9px close in, so it keeps mipmaps — see `sprite.ts`.
   */
  const sprite = createCircleTexture()
  /**
   * The band's own sprite, without mipmaps. Every band star sits at the same
   * ~10 units and draws ~2.1 device pixels wide, so all 600 of them landed on
   * the smallest mips at once and the whole ring rendered at a few 255ths —
   * which is what made its stars read as uniformly dim whatever colour they
   * carried. Same artwork, same size on screen; only the minification filter
   * differs. It is a second 64x64 upload and nothing more.
   */
  const bandSprite = createCircleTexture({ mipmaps: false })

  /**
   * Build a layer of orbiting stars. `place` supplies each star's orbit radius
   * and its fixed height; angle and speed are assigned here, so every layer
   * shares one motion style regardless of where its stars sit.
   */
  function createStarLayer(
    count: number,
    pointSize: number,
    place: () => { radius: number; y: number },
    look: {
      brightMin?: number
      brightMax?: number
      opacity?: number
      clearChance?: number
      clearLevel?: number
      /** Defaults to the mipmapped cloud sprite; the band passes its own. */
      sprite?: CanvasTexture
    } = {},
    transition: {
      scatter?: () => number
      fly?: () => number
      swirl?: number
      curve?: (progress: number) => number
      flyCurve?: (progress: number) => number
    } = {},
  ): StarLayer {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const radii = new Float32Array(count)
    const heights = new Float32Array(count)
    const angles = new Float32Array(count)
    const speeds = new Float32Array(count)
    const scatter = transition.scatter ? new Float32Array(count) : null
    const fly = transition.fly ? new Float32Array(count) : null
    const c = new Color()

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const { radius, y } = place()
      const angle = Math.random() * Math.PI * 2

      radii[i] = radius
      heights[i] = y
      angles[i] = angle
      speeds[i] = randomOrbitSpeed()
      if (scatter) scatter[i] = transition.scatter!()
      if (fly) fly[i] = transition.fly!()

      positions[i3] = Math.cos(angle) * radius
      positions[i3 + 1] = y // fixed height: orbits stay level
      positions[i3 + 2] = Math.sin(angle) * radius

      // White/silver only — grayscale, no color tint whatever the range.
      // A rolled subset is taken to one flat `clearLevel` rather than being
      // multiplied by a random factor: "fully bright" is a single definite
      // value, so every chosen star reads the same clear white instead of
      // spreading over a range of brightnesses. The rest keep their own roll.
      const v =
        look.clearChance && Math.random() < look.clearChance
          ? look.clearLevel ?? 1
          : rand(look.brightMin ?? STAR_BRIGHT_MIN, look.brightMax ?? STAR_BRIGHT_MAX)
      c.setRGB(v, v, v)
      colors[i3] = c.r
      colors[i3 + 1] = c.g
      colors[i3 + 2] = c.b
    }

    const posAttr = new Float32BufferAttribute(positions, 3)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', posAttr)
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))

    const material = new PointsMaterial({
      size: pointSize,
      sizeAttenuation: true,
      map: look.sprite ?? sprite,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      opacity: look.opacity ?? STAR_OPACITY,
    })

    const points = new Points(geometry, material)
    // The scroll transition moves stars far outside the bounds they were built
    // with (the band scatters out to ~29, the cloud flies up to 75 toward the
    // camera). Three only computes a geometry's bounding sphere once, so
    // leaving culling on would let it test against stale bounds and pop the
    // whole layer out of view mid-scroll. These layers always fill the frame,
    // so culling buys nothing.
    points.frustumCulled = false
    starfield.add(points)

    return {
      points,
      count,
      radii,
      heights,
      angles,
      speeds,
      scatter,
      fly,
      swirl: transition.swirl ?? 0,
      curve: transition.curve ?? ((p) => p),
      flyCurve: transition.flyCurve ?? transition.curve ?? ((p) => p),
      // The attribute's copy of `positions`, not `positions` itself.
      positions: posAttr.array as Float32Array,
      posAttr,
    }
  }

  // The wide ambient field — a flattened ball around the model. Its stars each
  // show only an arc, because the camera sits inside it.
  const cloud = createStarLayer(PARTICLE_COUNT, CLOUD_POINT_SIZE, () => {
    // A point spread evenly through the volume of a ball: cbrt for the
    // distance (volume grows with r^3) and an even direction on the sphere,
    // then squash y. Without cbrt the centre reads as a dense blob.
    const dist = CLOUD_INNER + Math.cbrt(Math.random()) * (CLOUD_RADIUS - CLOUD_INNER)
    const cosPolar = rand(-POLAR_LIMIT, POLAR_LIMIT)
    const sinPolar = Math.sqrt(1 - cosPolar * cosPolar)
    // Orbit radius is the distance from the model's *vertical axis*, so height
    // drops out of it — that is what keeps each star on a level circle.
    return { radius: dist * sinPolar, y: dist * cosPolar * CLOUD_FLATTEN }
  }, {}, {
    // On scroll these fly toward and past the camera, and are never wrapped
    // back around — the field thins out as Scene 1 is left behind.
    fly: () => rand(FLY_DISTANCE_MIN, FLY_DISTANCE_MAX),
    curve: (p) => Math.pow(p, FLY_EASE),
  })

  // The close-in band — the orbits that stay on screen for a whole revolution.
  const band = createStarLayer(BAND_COUNT, BAND_POINT_SIZE, () => ({
    radius: rand(BAND_RADIUS_MIN, BAND_RADIUS_MAX),
    y: rand(BAND_Y_MIN, BAND_Y_MAX),
  }), {
    brightMin: BAND_BRIGHT_MIN,
    brightMax: BAND_BRIGHT_MAX,
    opacity: BAND_OPACITY,
    clearChance: BAND_CLEAR_CHANCE,
    clearLevel: BAND_CLEAR_LEVEL,
    sprite: bandSprite,
  }, {
    // On scroll these spiral out of their tight orbit, then run past the
    // camera and off the screen — two displacements on two curves.
    scatter: () => rand(BAND_SCATTER_MIN, BAND_SCATTER_MAX),
    swirl: BAND_SWIRL,
    curve: bandScatterAt,
    fly: () => rand(BAND_EXIT_MIN, BAND_EXIT_MAX),
    flyCurve: bandExitAt,
  })

  // --- Scene 1 world layer (the model), drawn over the starfield ---
  const world = createWorld(window.innerWidth / window.innerHeight)

  /** Both layers, in one array so the frame loop allocates nothing per frame. */
  const layers = [cloud, band]

  // --- Animation: orbits, smoothed mouse parallax, scroll transition ---
  let prevTime = performance.now()
  /** The spring's own output — the first smoothing stage. */
  let springPage = 0
  /** Its velocity, in page units per second — the spring's other half. */
  let springVel = 0
  /**
   * Smoothed page scroll, 0..1: the spring's output with the trail chased over
   * it. **The single driver for every scene**, 3D and DOM alike.
   */
  let page = 0
  const flyDir = new Vector3()
  const layerFly = new Vector3()
  const invRotation = new Quaternion()

  function update(time: number, state: InputState): number {
    const delta = Math.min((time - prevTime) / 1000, 0.1) // clamp big tab-switch gaps
    prevTime = time

    // One value, advanced once per frame, read by all four moving parts below
    // — that is what keeps them simultaneous rather than sequential. Driven by
    // a critically damped spring against elapsed time, so the transition
    // settles identically at 60Hz and at 120Hz and its velocity is continuous
    // however coarsely the wheel delivers the scroll — see SCROLL_OMEGA.
    if (REDUCED_MOTION.matches) {
      // No smoothing at all: the page goes exactly where the reader put it, and
      // stops when they do. Both stages are held on the target, so turning the
      // setting back off mid-session resumes from here instead of springing in
      // from wherever the spring had been left.
      page = state.scroll
      springPage = state.scroll
      springVel = 0
    } else {
      springVel +=
        (SCROLL_OMEGA * SCROLL_OMEGA * (state.scroll - springPage) - 2 * SCROLL_OMEGA * springVel) *
        delta
      springPage += springVel * delta
      // Critical damping does not overshoot, but the integrator can by a hair
      // on a long frame, and past 1 the Scene 3 curve turns back on itself.
      if (springPage < 0 || springPage > 1) {
        springPage = clamp(springPage, 0, 1)
        springVel = 0
      }
      // Second stage: the trail. Time-based, so it is identical at 60Hz and
      // 120Hz, and it can only ever approach the spring — which is already
      // clamped — so the result stays inside 0..1 without a clamp of its own.
      page += (springPage - page) * (1 - Math.exp(-SCROLL_TRAIL * delta))
    }
    // Paused through the identity scene — see lib/phases.ts.
    const progress = toTransition(page)

    // Mouse parallax — tilt the wide field a few degrees, lerped. The band is
    // deliberately left untilted: its full-loop visibility was solved for a
    // level plane and a 5° tilt is enough to push its near side off frame. It
    // also reads as an extension of the model's own rings, which do not react
    // to the mouse either.
    const tiltY = state.mouseX * MAX_TILT
    const tiltX = -state.mouseY * MAX_TILT
    cloud.points.rotation.y += (tiltY - cloud.points.rotation.y) * TILT_LERP
    cloud.points.rotation.x += (tiltX - cloud.points.rotation.x) * TILT_LERP

    // The camera moves during the transition, so the fly-past direction is
    // re-read each frame: model -> camera, normalised.
    flyDir.copy(world.camera.position).normalize()

    // Advance both layers along their orbits, and apply their scroll
    // displacement in the same pass. Increasing the angle with x = cos,
    // z = sin turns them clockwise from the camera — the same direction the
    // model spins.
    //
    // The offsets are written into each layer's own buffer, which the mouse
    // tilt then rotates, so the world-space direction is converted into that
    // layer's local space first — otherwise the stars fly a few degrees wide
    // of the camera instead of straight past it.
    for (const layer of layers) {
      layerFly.copy(flyDir).applyQuaternion(invRotation.copy(layer.points.quaternion).invert())
      advance(layer, delta, progress, layerFly.x, layerFly.y, layerFly.z)
    }

    // The transition for the spin and the Scene 3 lift, and the page for the
    // rise into Scene 2 — the transition is frozen through identity, so it
    // cannot carry an entrance that happens inside it.
    world.update(delta, progress, toModel(page))

    renderer.clear()
    renderer.render(starfield, world.camera) // same vantage -> same orbital plane
    renderer.clearDepth() // world layer sits in front of the starfield
    renderer.render(world.scene, world.modelCamera) // front-on, not bird's-eye

    return page
  }

  /**
   * Throw away the time that passed while this scene was not being updated.
   *
   * `update()` spends `time - prevTime` on the orbits and the model's spin, so
   * a paused stretch — the reveal window covers the screen, and the loop stops
   * calling in — would otherwise arrive as one enormous delta and jump the
   * model forward the moment it came back. The 0.1s clamp in `update()` caps
   * how bad that is, not whether it happens; this removes it. RAF timestamps
   * share `performance.now()`'s origin, so re-anchoring here is exact to
   * whatever fraction of a frame separates this call from the next one.
   *
   * Call it when frames resume, not when they stop: `prevTime` has to name the
   * last moment that was actually spent, and until the pause ends nobody knows
   * when that is.
   */
  function resync(): void {
    prevTime = performance.now()
    // The scroll was frozen for the whole pause, so neither stage has anywhere
    // left to travel; whatever speed the spring was carrying when frames
    // stopped would only arrive as a kick on the first frame back, and the
    // trail would spend the first moments back chasing a target it had already
    // reached.
    springVel = 0
    page = springPage
  }

  function resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    world.resize(w / h) // one camera drives the starfield and world passes
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
  }

  return { update, resync, resize }
}
