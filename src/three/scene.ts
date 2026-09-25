/**
 * Base Three.js scene — the orbiting starfield, the day sky with its cloud ring
 * (`three/sky.ts`), and the world layer (the model, currently off).
 *
 * The frame is split at the rope (`ui/split.ts`): stars to its right, sky to
 * its left, both through the same fixed bird's-eye camera so the star ring and
 * the cloud ring read as one ellipse. The page no longer scrolls, so the scatter
 * (`lib/scatter.ts`) sits at page 0 — the protected opening composition.
 * **No camera moves.**
 *
 * Palette: white/silver/gray stars; the sky is the day side's blue.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { clamp, rand } from '../lib/math'

const TWO_PI = Math.PI * 2
import {
  CLOUD_SWIRL_TURNS,
  FILL_CHANCE,
  FILL_FAR,
  FILL_NEAR,
  FILL_REACH,
  REST_MAX,
  REST_MIN,
  TRAVEL_MAX,
  RING_SWIRL_TURNS,
  SCATTER_STAGGER,
  SPIRAL_MAX,
  SPIRAL_MIN,
  WAVE_SHARE,
  scatterAt,
  settleAt,
  spinAt,
  swirlAt,
} from '../lib/scatter'
import { toModel, toTransition } from '../lib/phases'
import type { InputState } from '../lib/state'
import { createCircleTexture } from './sprite'
import { createSky } from './sky'
import { createWorld, MODEL_SPIN_RATE } from './world'

export interface SceneController {
  /** Advances and renders a frame. Returns the smoothed 0..1 page scroll so
   *  DOM-side pieces stay on the exact same driver — map it through
   *  `lib/phases.ts` the same way this does. */
  update(time: number, state: InputState, split: number): number
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
 * The ambient field's shading: **pure white, at full opacity**, never tinted.
 *
 * It used to be a range (0.78..1.0 at 0.85 opacity), which put a silver-grey
 * cast and a veil of transparency over most of the field. Both were removed on
 * request — the stars are meant to read as white points, not as dimmed ones.
 * Keep r = g = b whatever these become; the palette allows nothing else.
 */
const STAR_BRIGHT_MIN = 1.0
const STAR_BRIGHT_MAX = 1.0
const STAR_OPACITY = 1.0

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
//
// All of that describes the **resting** composition, which is what it was
// solved for. On scroll the scatter disperses this ring into the field, and
// none of these bounds apply past that point — see `lib/scatter.ts`. They still apply at page 0, which is the frame they
// were derived against.
const BAND_COUNT = 600
/**
 * The ring at its largest — a wide screen. **Made a little bigger on request**
 * (it was 2.6..2.8), keeping the same 0.93 inner-to-outer ratio. 2.92 is as far
 * as the frame allows: the orbit's near side projects to the bottom of the
 * frame, and at 2.92 its lowest star sits at NDC -0.952 against -0.909 at 2.8
 * — past about 3.0 it leaves the screen. Computed from the fixed camera, not
 * by eye. The model's slab bound (2.47) no longer applies while the model is
 * off (`MODEL_ENABLED`).
 */
const BAND_RADIUS_MIN = 2.71
const BAND_RADIUS_MAX = 2.92
/**
 * **On a narrow screen the ring is scaled down to fit its width** — asked for
 * on phones and iPads, where at full size it ran well off both sides (NDC 2.0
 * on a 390x844 phone, 1.36 on an iPad in portrait) and only its two arcs
 * showed. It spans `BAND_FIT_WIDTH` of the screen's width there: 1.2 outer on
 * that phone, 1.8 on that iPad. A wide screen is bound by the frame's height
 * instead, so the scale caps at 1 and it keeps the radii above.
 *
 * `RING_NDC_PER_UNIT` is the ring's half-width in NDC, times aspect, per unit
 * of radius — measured off the fixed bird's-eye camera (0.335, taken up a hair
 * for the perspective of the near side). It is geometry, not taste: re-derive
 * it if the camera ever moves, which it must not.
 *
 * Applied on every resize, so an iPad turned from portrait to landscape gets
 * the larger ring back. It scales each star's radius and height together,
 * which is the whole ring scaled about the axis — the orbit is untouched.
 */
const BAND_FIT_WIDTH = 0.88
/**
 * **On a phone the ring runs a little past both sides**, on request: at 0.88 it
 * read as too small there. 1.1 puts its left and right edges ~5% of the width
 * off screen (1.5 outer on a 390x844 phone). Tablets keep `BAND_FIT_WIDTH`.
 * Same bound as the stylesheet's phone block.
 */
const BAND_FIT_WIDTH_PHONE = 1.1
const PHONE = window.matchMedia('(max-width: 767.98px)')
const RING_NDC_PER_UNIT = 0.34
function ringScale(aspect: number): number {
  const fit = PHONE.matches ? BAND_FIT_WIDTH_PHONE : BAND_FIT_WIDTH
  return Math.min(1, (fit * aspect) / (RING_NDC_PER_UNIT * BAND_RADIUS_MAX))
}
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
const BAND_BRIGHT_MIN = 1.0
const BAND_BRIGHT_MAX = 1.0
const BAND_OPACITY = 1.0

/**
 * A random ~60% of band stars are taken to full, clear white, so the ring reads
 * as mixed rather than uniformly faint. Rolled per star, so it is a different
 * scattering of stars on every load rather than a fixed pattern. The other ~40%
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
// **Raised from 0.35 on request, for a whiter ring** — along with
// BAND_BRIGHT_MIN from 0.96 to 1.0. Brightness only, like everything here.
const BAND_CLEAR_CHANCE = 0.6
const BAND_CLEAR_LEVEL = 4.0

// --- Scene 1 -> Scene 2 scroll transition ---
/**
 * How fast the page value chases raw scroll — the natural frequency of the
 * **critically damped spring** it is chased with, in radians per second.
 *
 * Every part of the transition reads this one smoothed value, so the spin, the
 * growth, the scatter, the fly-past and the identity scene stay locked
 * together. The spring is what that smoothing is done with, rather than a
 * first-order chase: a chase has no memory of its own speed, so the instant the
 * target moves the output's velocity moves with it — and a wheel delivers
 * scroll in coarse notches, so the output's velocity was a sawtooth even while
 * the value itself looked smooth. A critically damped spring carries velocity
 * as state, can only *accelerate* toward a new target, and never overshoots
 * past the position the reader chose.
 *
 * Integrated semi-implicitly (velocity first, then position), which stays
 * stable for any `OMEGA * delta` well under 2. The spring takes its own step
 * from `SPRING_MAX_STEP` rather than from the frame's `delta`, so the worst
 * case here is 0.4 however long a frame runs — see that constant.
 *
 * **24 is deliberately fast: the page is meant to feel like an ordinary
 * scroll.** Steady-state lag on a held scroll is `2 / OMEGA`, about 0.08s —
 * enough to take the notches off the wheel and nothing more. It ran at 7.0
 * with a second *trail* stage chased over it, together ~0.6s of coast, and
 * that read as heavy and slow; the trail is gone, and don't reintroduce a
 * second stage here or anywhere else (see `ui/identity.ts`).
 *
 * **It was 20, and the trail it left was read as lag.** That is 0.1s of
 * steady-state lag, but a spring's lag scales with how fast the target moves,
 * so a fast wheel put the page visibly behind the gesture — and on a reversal
 * it had to spend the velocity it was carrying before it could turn round,
 * which is a hesitation, not a smooth. It shows up worst under the identity
 * statements, where the fill sweep reads the scroll position back out across
 * the whole width of the screen. Frame rate was never the problem: measured
 * through the fill at 6x CPU throttling, not one frame ran long.
 *
 * **It went to 32 first, and that was too far the other way.** This is the one
 * number the two ends of the page pull against each other over: tight enough
 * and the identity fill answers the wheel at once, loose enough and the
 * scatter does not show the wheel's notches through it. Scene 1's driver is
 * steep now — the whole scatter is spent over 60% of the scene — so a notch
 * there moves the field nearly twice as far as it used to, and 32 let that
 * read as a stepped scroll. 24 is the middle of the two, and the rest of the
 * smoothness was bought by slowing the scatter itself rather than by putting
 * more lag between the reader and the page.
 */
const SCROLL_OMEGA = 24.0
/**
 * The longest step the spring will take, in seconds.
 *
 * The frame `delta` is clamped at 0.1s, which is right for the orbit — a
 * throttled tab should animate slower rather than jump — but it is also the
 * whole stability budget of this integrator, and at `OMEGA * delta` near 2 the
 * spring diverges instead of settling. A tighter clamp of its own is what buys
 * the headroom the faster OMEGA needs, and costs nothing: the spring is
 * chasing a target that did not move while the frames were missing.
 */
const SPRING_MAX_STEP = 1 / 60

/**
 * Whether the reader has asked their system for less motion.
 *
 * **The smoothing is the part that has to go.** Everything on this page is a
 * pure function of the page value, so the spring above is what puts any travel
 * at all between the reader's gesture and the screen — the scroll carries on
 * after the wheel stops, the model keeps rising, the stars keep streaming. That
 * is exactly the kind of uncommanded movement that triggers vestibular
 * symptoms. With this on, `page` *is* the scroll position: the page still moves
 * through all three scenes, but only while the reader is moving it, and it
 * stops dead when they do.
 *
 * `matches` is live, so it is read per frame rather than listened to — the
 * setting can be changed mid-session and the next frame honours it, and the
 * spring is held on the target so switching back cannot jump.
 */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

/**
 * Whether the `space_boi` model is in the page at all.
 *
 * **It is off, and paused rather than deleted.** Scene 2 is type-only now — the
 * three statements are the whole composition and the model was taking the
 * bottom of the frame out from under them — and Scene 3 has not been designed
 * past its transition. The world layer is still built, because the starfield is
 * drawn through its camera, but the model is neither advanced nor drawn.
 *
 * Everything about the rig is intact and turning this back on is the whole of
 * re-enabling it: the fit, the two lens compositions, the entrance, the turns
 * and the planet spins are all still there and still documented. The GLB is
 * not fetched while this is off (`createWorld`'s `loadModel`).
 *
 * Typed `boolean` rather than left to narrow to `false`, so the branches below
 * stay live code and `toModel` stays referenced.
 */
const MODEL_ENABLED: boolean = false

// --- Interaction tuning (mouse parallax; gentle / clamped) ---
const MAX_TILT = 0.09 // max parallax tilt from the mouse (~5°), radians
const TILT_LERP = 0.05 // how fast tilt eases toward the target
/**
 * The settled field's own slow turn, rad/s — ~3 minutes a revolution, clockwise
 * like the orbit. It takes over from the orbit as the orbit dies (`1 - spin`),
 * so the stars never actually stop: the scatter hands a dying orbit to a
 * whole-field turn with no frame where nothing moves. At page 0 its weight is
 * 0, so the protected opening is untouched.
 *
 * **It is a rotation of the `Points` about the model's axis, not a write into
 * the position buffer** — the same trick as the tilt, so the still-frame gate
 * keeps skipping the 20,600-star pass. Rotating the settled stars' angles
 * would do nothing anyway: every on-screen cloud star is pinned to its spread
 * target by `settled`, and the orbit only moves the angle under it.
 */
const DRIFT_RATE = 0.035

/** A set of stars orbiting the model's vertical axis, drawn as one Points. */
interface StarLayer {
  points: Points
  count: number
  radii: Float32Array
  heights: Float32Array
  angles: Float32Array
  speeds: Float32Array
  /**
   * What each star does across the scatter, rolled once at build. Only the
   * ring carries it; the cloud is the field it scatters into.
   */
  scatter: ScatterRolls | null
  /**
   * Where a star drifts to as the field settles, x/y/z interleaved, or `NaN`
   * for the great majority that stay where their orbit leaves them. Only the
   * ambient cloud carries one — see `FILL_CHANCE`.
   */
  spread: Float32Array | null
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
  /** The pointer's share of `points.rotation.y`; the drift is the rest. */
  tiltY: number
  /** Multiplies every star's radius and height — the band's `ringScale()`, 1 for the cloud. */
  radiusScale: number
}

/**
 * The four things rolled per star, once, at build. **No two stars do the same
 * thing at the same time, and that is the whole difference between this and a
 * crowd of dots flying apart** — see `lib/scatter.ts`.
 */
interface ScatterRolls {
  /** When it lets go, 0..SCATTER_STAGGER: a wave around the ring, plus jitter. */
  delay: Float32Array
  /**
   * The orbit radius it comes to rest at. Its travel is this less where it
   * started, worked out per frame: the ring's own size follows the screen
   * (`ringScale`), and the rest does not.
   */
  rest: Float32Array
  /**
   * `1 / (1 - delay)` — how much of the driver is left for it once it has
   * been let go, reciprocated at build so the hot loop multiplies. **Every
   * star's travel ends at the driver's end**, so this differs per star and is
   * not one shared span; see `SCATTER_STAGGER`.
   */
  rate: Float32Array
  /** Radians it winds on as it goes; most for the shortest travels. */
  spiral: Float32Array
}

/** Everything one layer needs for one frame of the scatter. Mutated in place. */
interface ScatterFrame {
  /** Extra orbit angle from the wind-up, in radians. Per layer. */
  swirl: number
  /** How far along its own travel each scattering star is, 0..1. */
  spread: number
  /** How far the settled field has spread out and grown, 0..1. */
  settled: number
  /** What is left of the orbit's rate — 1 turning, 0 at rest. */
  spin: number
}

/**
 * Advance every star in a layer along its own circle, then apply the scatter.
 *
 * The orbit angle is unbounded and only ever increases, so the underlying
 * motion stays a true endless 360° revolution — there is no clamp, wrap or
 * easing here by design. `spin` is the one thing that stops it, and it scales
 * the *rate*, so a field at rest simply stays where it is.
 *
 * **`swirl` is an extra angle, never an extra rate**, and that distinction is
 * why the wind-up rewinds. A rotational *speed* that rose with the scroll
 * would have to be integrated over time, so the total would depend on how long
 * the reader took and scrolling back up would not unwind it. An angle read
 * straight off the scroll looks identical on screen and comes back exactly.
 *
 * **The scatter is a change of orbit radius and nothing else.** A negative
 * value takes the star inward, and past the ring's own radius it carries on
 * through the centre and out the far side, because `cos(a) * -r` is the
 * antipode of `cos(a) * r`. Since the wind-up is still turning the star while
 * its radius changes, no star travels in a straight line — the two compose
 * into a spiral without either of them being written as one.
 *
 * **No star's depth is ever touched.** Everything here happens in the stars'
 * own orbital plane, seen from exactly where it was always seen. A version of
 * this pulled the whole field onto one plane facing the camera; it moved
 * nothing on screen but grew the far stars fourfold, and that reads as the
 * viewer moving in. See `lib/scatter.ts`.
 *
 * Everything but the orbit is computed *from* the scroll value rather than
 * accumulated, so scrubbing back up rewinds it exactly.
 */
function advance(layer: StarLayer, delta: number, frame: ScatterFrame): void {
  const arr = layer.positions
  const { swirl, spread, settled } = frame
  const spun = delta * frame.spin

  for (let i = 0; i < layer.count; i++) {
    const angle = layer.angles[i] + layer.speeds[i] * spun
    layer.angles[i] = angle

    // Each star reads its own delayed, differently-eased travel off the one
    // shared driver, so the ring comes apart progressively but settles all at
    // once — see `SCATTER_STAGGER` in lib/scatter.ts.
    const scale = layer.radiusScale
    let radius = layer.radii[i] * scale
    let shown = angle + swirl
    if (layer.scatter) {
      // Its own `rate` rather than one shared span: every star's travel ends
      // where the driver does, so they all come to rest on the same frame.
      const u = (spread - layer.scatter.delay[i]) * layer.scatter.rate[i]
      if (u > 0) {
        // **Linear in the driver, with no ease of its own.** That is what
        // makes every star decelerate on one curve and stop on one frame —
        // the slowing is `STOP_TAIL`'s and belongs to the whole field. See
        // the note where the per-star ease used to be rolled, in lib/scatter.
        const gone = u < 1 ? u : 1
        radius += (layer.scatter.rest[i] - radius) * gone
        shown += layer.scatter.spiral[i] * gone
      }
    }
    let x = Math.cos(shown) * radius
    let y = layer.heights[i] * scale
    let z = Math.sin(shown) * radius

    const i3 = i * 3
    // The even spread. Only a small slice of the ambient cloud carries a
    // target; the rest are marked NaN and skipped by the self-comparison.
    if (layer.spread) {
      const tx = layer.spread[i3]
      if (tx === tx) {
        x += (tx - x) * settled
        y += (layer.spread[i3 + 1] - y) * settled
        z += (layer.spread[i3 + 2] - z) * settled
      }
    }

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
   * The mipmapped sprite. The ambient cloud wears it **only in the resting
   * composition**, where its points range from ~2px at the field's far edge to
   * ~9px close in and mipmaps are what stop them shimmering as they orbit. The
   * press takes it off again on the first frame of scroll — see `setSprite`.
   */
  // --- Scene 1 world layer (the model), drawn over the starfield ---
  // Built before the star layers: the camera's basis is what aims their
  // settled spread targets, and it is fixed for the life of the page.
  const world = createWorld(window.innerWidth / window.innerHeight, MODEL_ENABLED)

  /**
   * A world-space point at a uniformly random place in the visible frame, at a
   * uniformly random depth — which is what makes the settled field even on
   * screen, since a star's screen position is exactly this `sx`/`sy`.
   */
  const camRight = new Vector3()
  const camUp = new Vector3()
  const camFwd = new Vector3()
  world.camera.updateMatrixWorld()
  world.camera.matrixWorld.extractBasis(camRight, camUp, camFwd)
  camFwd.negate() // the third basis column points *out of* the screen
  const TAN_HALF_FOV = Math.tan((world.camera.fov * Math.PI) / 360)
  function spreadTarget(into: Vector3): Vector3 {
    const depth = rand(FILL_NEAR, FILL_FAR)
    const halfH = TAN_HALF_FOV * depth * FILL_REACH
    const halfW = halfH * world.camera.aspect
    return into
      .copy(world.camera.position)
      .addScaledVector(camFwd, depth)
      .addScaledVector(camRight, rand(-halfW, halfW))
      .addScaledVector(camUp, rand(-halfH, halfH))
  }

  /**
   * Whether a world point is inside the frame, tested in NDC.
   *
   * **This is what makes a spread target legitimate, and it is not a
   * refinement.** A star that carries one drifts from where it orbits to where
   * its target is, and all but a fraction of a percent of the cloud orbits
   * *outside* the frame — so rolling the target blind sent stars flying in
   * over the edge of the picture. Nothing else in this scene enters the frame
   * from outside it: the ring disperses in its own plane and the rest of the
   * cloud stays where it is. Only stars already in the frame are
   * redistributed inside it, so the spread is a rearrangement of what is on
   * screen rather than an arrival.
   */
  const ndc = new Vector3()
  function onScreen(x: number, y: number, z: number): boolean {
    ndc.set(x, y, z).project(world.camera)
    return (
      ndc.z > -1 && ndc.z < 1 && ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1
    )
  }

  const mippedSprite = createCircleTexture()
  /**
   * The same artwork without mipmaps, worn by the ring always and by the cloud
   * from the first frame of scroll. Every ring star sits at the same ~10 units
   * and draws ~2.1 device pixels wide, so all 600 of them landed on the
   * smallest mips at once and the whole ring rendered at a few 255ths — which
   * is what made its stars read as uniformly dim whatever colour they carried.
   * The pressed field is that same case for every point on screen. Only the
   * minification filter differs; it is a second 64x64 upload and nothing more.
   */
  const plainSprite = createCircleTexture({ mipmaps: false })

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
    /**
     * Whether this layer's stars scatter. The ring's alone; the cloud is the
     * field they scatter into and it only winds up and slows down.
     */
    scatters = false,
    /** Whether a slice of this layer spreads evenly across the settled frame. */
    spreads = false,
  ): StarLayer {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const radii = new Float32Array(count)
    const heights = new Float32Array(count)
    const angles = new Float32Array(count)
    const speeds = new Float32Array(count)
    const scatter: ScatterRolls | null = scatters
      ? {
          delay: new Float32Array(count),
          rate: new Float32Array(count),
          rest: new Float32Array(count),
          spiral: new Float32Array(count),
        }
      : null
    const spread = spreads ? new Float32Array(count * 3) : null
    const target = new Vector3()
    const c = new Color()

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const { radius, y } = place()
      const angle = Math.random() * Math.PI * 2
      const px = Math.cos(angle) * radius
      const pz = Math.sin(angle) * radius

      radii[i] = radius
      heights[i] = y
      angles[i] = angle
      speeds[i] = randomOrbitSpeed()
      if (spread) {
        // NaN marks "stays put", which is nearly all of them; the loop tests
        // for it with `t === t` rather than carrying a second array. The
        // frustum test comes first: a star that is not already in the frame
        // would arrive over its edge — see `onScreen`.
        if (Math.random() < FILL_CHANCE && onScreen(px, y, pz)) {
          spreadTarget(target)
          spread[i3] = target.x
          spread[i3 + 1] = target.y
          spread[i3 + 2] = target.z
        } else {
          spread[i3] = NaN
        }
      }
      if (scatter) {
        // **Where it comes to rest is what is rolled here, not how far it
        // goes**, and the difference is the whole settled composition. The
        // draw is even by *area* — `sqrt` of a uniform over the squared
        // bounds — so the ring relaxes into a field with no knot in the middle
        // of it and no trace of the circle it came from. Rolling a signed
        // travel instead, off a ring only 0.2 units thick, put both of those
        // on screen: see `REST_MIN` in `lib/scatter.ts`.
        //
        // Which way a star goes is not rolled at all — it falls out of where
        // it already is against where it is going, so the ring turns inside
        // out through itself with no star picking a heading of its own.
        const rest = Math.sqrt(rand(REST_MIN * REST_MIN, REST_MAX * REST_MAX))
        scatter.rest[i] = rest
        // Against the full-size ring: the spiral is a flourish, and the few
        // tenths a smaller ring adds to a travel do not change its character.
        const travel = rest - radius
        // A wave running once around the ring's circumference, softened by a
        // jitter so its edge is ragged rather than a clean unzip. `angle` is
        // the star's own place on the ring, so the wave travels with it.
        const around = (angle % TWO_PI) / TWO_PI
        const delay =
          (around * WAVE_SHARE + Math.random() * (1 - WAVE_SHARE)) * SCATTER_STAGGER
        scatter.delay[i] = delay
        // Its travel runs from there to the driver's end, so whenever it was
        // let go it comes to rest on the same frame as everything else.
        scatter.rate[i] = 1 / (1 - delay)
        // **Most for the shortest travel, least for the longest** — what an
        // orbiting body actually does as its radius changes. This one
        // correlation is most of what makes the paths read as a system.
        const reach = Math.min(Math.abs(travel) / TRAVEL_MAX, 1)
        scatter.spiral[i] = (SPIRAL_MAX - (SPIRAL_MAX - SPIRAL_MIN) * reach) * TWO_PI
      }

      positions[i3] = px
      positions[i3 + 1] = y // fixed height: orbits stay level
      positions[i3 + 2] = pz

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
      map: look.sprite ?? mippedSprite,
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
      spread,
      // The attribute's copy of `positions`, not `positions` itself.
      positions: posAttr.array as Float32Array,
      posAttr,
      tiltY: 0,
      radiusScale: 1,
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
  }, {}, false, true) // does not scatter; a slice of it spreads evenly

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
    sprite: plainSprite,
  }, true) // the ring scatters; the cloud does not
  band.radiusScale = ringScale(world.camera.aspect)

  const sky = createSky(world.camera)
  sky.setScale(band.radiusScale)

  /** Both layers, in one array so the frame loop allocates nothing per frame. */
  const layers = [cloud, band]

  /** Rebuilt in place each frame, so the loop allocates nothing. */
  const frame: ScatterFrame = { swirl: 0, spread: 0, settled: 0, spin: 1 }
  /** Whether the settled field has already been written into the buffers. */
  let stillDrawn = false
  /** Last frame's scatter values, so an unchanged frame can be skipped. */
  let drawnSwirl = -1
  let drawnSpread = -1
  let drawnSettled = -1

  /**
   * Draw the frame split at the rope: stars to its right, the sky to its left.
   * `split` is the rope's x in CSS pixels — `setScissor` multiplies by the pixel
   * ratio itself, so it is never pre-multiplied here. Scissor y runs from the
   * bottom; both halves are full height.
   */
  function drawSplit(split: number): void {
    const width = window.innerWidth
    const height = window.innerHeight
    const x = clamp(Math.round(split), 0, width)
    if (x === 0) {
      renderer.render(starfield, world.camera)
      return
    }
    renderer.setScissorTest(true)
    if (x < width) {
      renderer.setScissor(x, 0, width - x, height)
      renderer.render(starfield, world.camera)
    }
    renderer.setScissor(0, 0, x, height)
    renderer.render(sky.scene, world.camera)
    renderer.setScissorTest(false)
  }

  /**
   * Chase the pointer with one layer's tilt, `reach` radians at the edges.
   *
   * It is a rotation on the `Points` object, not a write into the position
   * buffer, so it costs nothing per star and is **independent of the position
   * pass** — which is why the gate below can skip that pass while this keeps
   * answering the pointer.
   */
  function tiltToward(layer: StarLayer, state: InputState, reach: number): void {
    if (reach === 0) {
      // Snapped rather than chased, so the tilt actually reaches zero — a lerp
      // only approaches it, which would leave the layer permanently "moving".
      layer.tiltY = 0
      layer.points.rotation.x = 0
    } else {
      layer.tiltY += (state.mouseX * reach - layer.tiltY) * TILT_LERP
      layer.points.rotation.x += (-state.mouseY * reach - layer.points.rotation.x) * TILT_LERP
    }
    // Both about the same axis, so they simply add. Euler order XYZ applies
    // the y turn first and the x tilt over it, so the tilt stays screen-fixed
    // however far the field has drifted round.
    layer.points.rotation.y = layer.tiltY + drift
  }

  /** Run the scatter over both layers. */
  function advanceLayers(delta: number, wound: number): void {
    for (const layer of layers) {
      // The ring and the cloud wind up by very different amounts for the same
      // look on screen — see CLOUD_SWIRL_TURNS.
      frame.swirl =
        wound * Math.PI * 2 * (layer === band ? RING_SWIRL_TURNS : CLOUD_SWIRL_TURNS)
      advance(layer, delta, frame)
    }
  }

  // --- Animation: orbits, smoothed mouse parallax, scroll transition ---
  let prevTime = performance.now()
  /**
   * Smoothed page scroll, 0..1 — the spring's output. **The single driver for
   * every scene**, 3D and DOM alike.
   */
  let page = 0
  /** Its velocity, in page units per second — the spring's other half. */
  let pageVel = 0
  /** The settled field's accumulated turn — see `DRIFT_RATE`. */
  let drift = 0

  function update(time: number, state: InputState, split: number): number {
    const delta = Math.min((time - prevTime) / 1000, 0.1) // clamp big tab-switch gaps
    prevTime = time

    // One value, advanced once per frame, read by all four moving parts below
    // — that is what keeps them simultaneous rather than sequential. Driven by
    // a critically damped spring against elapsed time, so the transition
    // settles identically at 60Hz and at 120Hz and its velocity is continuous
    // however coarsely the wheel delivers the scroll — see SCROLL_OMEGA.
    if (REDUCED_MOTION.matches) {
      // No smoothing at all: the page goes exactly where the reader put it, and
      // stops when they do. The spring is held on the target, so turning the
      // setting back off mid-session resumes from here instead of springing in
      // from wherever it had been left.
      page = state.scroll
      pageVel = 0
    } else {
      const step = delta < SPRING_MAX_STEP ? delta : SPRING_MAX_STEP
      pageVel +=
        (SCROLL_OMEGA * SCROLL_OMEGA * (state.scroll - page) - 2 * SCROLL_OMEGA * pageVel) * step
      page += pageVel * step
      // Critical damping does not overshoot, but the integrator can by a hair
      // on a long frame, and past 1 the Scene 3 curve turns back on itself.
      if (page < 0 || page > 1) {
        page = clamp(page, 0, 1)
        pageVel = 0
      }
    }
    // Paused through the identity scene — see lib/phases.ts.
    const progress = toTransition(page)

    // --- The scatter, all four of its parts, all off `progress` ---
    frame.spread = scatterAt(progress)
    frame.spin = spinAt(progress)
    const wound = swirlAt(progress)
    const settled = settleAt(progress)
    frame.settled = settled
    // Negative for clockwise, the same convention as the model's spin.
    if (!REDUCED_MOTION.matches) drift -= DRIFT_RATE * (1 - frame.spin) * delta

    // Mouse parallax — a few degrees of tilt under the pointer, lerped.
    //
    // **It used to die with the settle and it no longer does.** That was the
    // press's rule: the field ended as a flat surface, and a surface does not
    // have parallax. The press is gone and what the scatter leaves is a
    // dispersed field in depth, so the pointer belongs on it — and once the
    // scroll has stopped moving the stars it is the only thing left that
    // does, on every scene. Asked for explicitly.
    //
    // **The band joins in as the field settles, and never before.** At rest
    // its whole point is a full orbit that stays on screen, which is solved
    // for a level plane — five degrees pushes its near side off frame. Once
    // it has dispersed there is no loop left to protect, and it has to move
    // with the cloud or half the field answers the pointer and half does not.
    // So Scene 1's opening frame is untouched and the settled one tilts whole.
    tiltToward(cloud, state, MAX_TILT)
    tiltToward(band, state, MAX_TILT * settled)

    // **Skip the position pass whenever nothing it reads has actually moved.**
    // That is 20,600 stars' worth of trig and writes plus the two buffer
    // uploads behind it (~250KB a frame), which together are all of this
    // loop's real cost, and it is skippable far more often than it looks:
    // through the whole of Scenes 2 and 3, where every press curve has clamped
    // and the orbit has stopped; through the press's own **still frame**,
    // where the field is deliberately doing nothing for 12% of Scene 1; and
    // any time the reader stops scrolling after the orbit has died.
    //
    // It is a comparison against the last frame's values rather than a test
    // for "past the end", because those are not the same question — every
    // driver is clamped inside the still frame but `releaseAt` has not reached
    // 1 yet, so a range test would keep redrawing a frame that cannot change.
    // The clamps are what make the comparison exact: page jitter from the
    // spring moves nothing once a curve has pinned at 0 or 1.
    //
    // **The render itself is deliberately not skipped**, and that is not an
    // oversight. The renderer is `preserveDrawingBuffer: false`, so the
    // contents of a frame that is not drawn are undefined — and Scene 3's
    // panel does not paint a white half, it inverts whatever the canvas is
    // already showing underneath it (`ui/invert.ts`). A dropped frame there
    // would take the stars out of the white half. Re-drawing points that have
    // not moved costs one draw call and no upload at all, which is not worth
    // trading that for.
    // **The orbit is the one thing on this page that moves without being
    // asked**, and it is the one thing this setting has never covered: the
    // spring was switched off, but the ring kept turning on a clock whether
    // the reader touched the page or not. Under reduced motion it is held
    // still, so the opening frame is a composition rather than an animation
    // and everything that does move is moved by the reader.
    if (REDUCED_MOTION.matches) frame.spin = 0

    const moved =
      wound !== drawnSwirl ||
      frame.spread !== drawnSpread ||
      settled !== drawnSettled
    // The tilt is deliberately **not** in this test. It is a rotation on the
    // `Points` objects, which the renderer applies and `advance()` never
    // reads, so the pointer can keep moving the field for the whole page
    // while the position pass stays skipped. It was in here when the tilt
    // died at the settle and cost nothing; now it would pin the pass on for
    // every frame of every scene.
    const moving = moved || frame.spin > 0 || MODEL_ENABLED
    if (moving || !stillDrawn) advanceLayers(delta, wound)
    stillDrawn = !moving
    drawnSwirl = wound
    drawnSpread = frame.spread
    drawnSettled = settled

    // The transition for the spin and the Scene 3 lift, and the page for the
    // rise into Scene 2 — the transition is frozen through identity, so it
    // cannot carry an entrance that happens inside it.
    if (MODEL_ENABLED) world.update(delta, progress, toModel(page))

    sky.update(delta, !REDUCED_MOTION.matches)
    renderer.clear()
    drawSplit(split)
    if (MODEL_ENABLED) {
      renderer.clearDepth() // world layer sits in front of the starfield
      renderer.render(world.scene, world.modelCamera) // front-on, not bird's-eye
    }

    return page
  }

  /**
   * Throw away the time that passed while this scene was not being updated.
   *
   * `update()` spends `time - prevTime` on the orbits and the model's spin, so
   * a paused stretch — the projects page covers the screen, and the loop stops
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
    // The canvas was covered while frames were skipped, and the still-frame
    // gate would otherwise trust a drawing nobody can vouch for.
    stillDrawn = false
    // The scroll was frozen for the whole pause, so the spring has nowhere
    // left to travel; whatever speed it was carrying when frames stopped would
    // only arrive as a kick on the first frame back.
    pageVel = 0
  }

  function resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    // A resized drawing buffer is a blank one, so the settled field has to be
    // drawn again even when nothing about it has changed.
    stillDrawn = false
    world.resize(w / h) // one camera drives the starfield and world passes
    band.radiusScale = ringScale(w / h)
    sky.setScale(band.radiusScale)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
  }

  return { update, resync, resize }
}
