/**
 * Base Three.js scene — an orbiting starfield, plus the Scene 1 world layer
 * (the model) composited on top of it.
 *
 * The stars orbit the model's centre on roughly the model's own orbital plane,
 * each at its own randomised speed, so they read as one system with the stars
 * embedded in the model rather than as a separate dolly-ing backdrop. Mouse
 * parallax is layered on top via shared input state, lerped for smooth motion.
 *
 * Two render passes share one renderer, both drawn through the world layer's
 * bird's-eye camera — sharing the vantage is what makes the star orbits line up
 * with the model's. Depth is cleared between them so the model always sits in
 * front of the stars.
 * Palette: white/silver/gray only — no color pops.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { rand } from '../lib/math'
import type { InputState } from '../lib/state'
import { createCircleTexture } from './sprite'
import { createWorld, MODEL_SPIN_RATE } from './world'

export interface SceneController {
  /** Advances and renders a frame. Returns the smoothed 0..1 scroll progress
   *  so DOM-side pieces of the transition stay on the exact same driver. */
  update(time: number, state: InputState): number
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
 * A random ~30% of band stars are lifted brighter still, so the ring reads as
 * mixed rather than uniform. Rolled per star, so it is a different scattering
 * of stars on every load rather than a fixed pattern.
 *
 * The multiplier deliberately pushes the vertex colour **above 1**. The band's
 * base is already near-pure white at full opacity, so there is no headroom left
 * inside 0..1; with additive blending and the soft radial sprite, an over-1
 * colour drives more of each dot's falloff to full white, which is what reads
 * as a brighter, whiter star. It stays grayscale, so the palette holds.
 */
const BAND_BOOST_CHANCE = 0.3
const BAND_BOOST_MIN = 2.4
const BAND_BOOST_MAX = 3.6

// Default star shading — grayscale brightness from pure white down to a
// slightly dimmer silver-white, no color tint. Used by the ambient field.
const STAR_BRIGHT_MIN = 0.78
const STAR_BRIGHT_MAX = 1.0
const STAR_OPACITY = 0.85

// --- Scene 1 -> Scene 2 scroll transition ---
/**
 * How fast the transition value chases raw scroll. Scroll events arrive in
 * coarse jumps; every part of the transition reads this one smoothed value, so
 * the camera, the spin, the scatter and the fly-past stay locked together.
 */
const SCROLL_LERP = 0.08

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
  /** Exponent applied to scroll progress before displacing this layer. */
  ease: number
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
  // Same scroll value for every layer; each just responds on its own curve.
  const t = layer.ease === 1 ? progress : Math.pow(progress, layer.ease)

  for (let i = 0; i < layer.count; i++) {
    const angle = layer.angles[i] + layer.speeds[i] * delta
    layer.angles[i] = angle

    const radius = layer.scatter ? layer.radii[i] + layer.scatter[i] * t : layer.radii[i]
    let x = Math.cos(angle) * radius
    let y = layer.heights[i]
    let z = Math.sin(angle) * radius

    if (layer.fly) {
      const travelled = layer.fly[i] * t
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
  renderer.autoClear = false // two passes per frame, cleared manually below

  // Named for what it holds: the star layers only. The model lives in the
  // world layer's own scene, which is rendered separately below.
  const starfield = new Scene()

  const sprite = createCircleTexture()

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
      boostChance?: number
      boostMin?: number
      boostMax?: number
    } = {},
    transition: { scatter?: () => number; fly?: () => number; ease?: number } = {},
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
      let v = rand(look.brightMin ?? STAR_BRIGHT_MIN, look.brightMax ?? STAR_BRIGHT_MAX)
      if (look.boostChance && Math.random() < look.boostChance) {
        v *= rand(look.boostMin ?? 1, look.boostMax ?? 1)
      }
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
      map: sprite,
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
      ease: transition.ease ?? 1,
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
    ease: FLY_EASE,
  })

  // The close-in band — the orbits that stay on screen for a whole revolution.
  const band = createStarLayer(BAND_COUNT, BAND_POINT_SIZE, () => ({
    radius: rand(BAND_RADIUS_MIN, BAND_RADIUS_MAX),
    y: rand(BAND_Y_MIN, BAND_Y_MAX),
  }), {
    brightMin: BAND_BRIGHT_MIN,
    brightMax: BAND_BRIGHT_MAX,
    opacity: BAND_OPACITY,
    boostChance: BAND_BOOST_CHANCE,
    boostMin: BAND_BOOST_MIN,
    boostMax: BAND_BOOST_MAX,
  }, {
    // On scroll these widen out of their tight orbit and scatter away.
    scatter: () => rand(BAND_SCATTER_MIN, BAND_SCATTER_MAX),
    ease: BAND_SCATTER_EASE,
  })

  // --- Scene 1 world layer (the model), drawn over the starfield ---
  const world = createWorld(window.innerWidth / window.innerHeight)

  /** Both layers, in one array so the frame loop allocates nothing per frame. */
  const layers = [cloud, band]

  // --- Animation: orbits, smoothed mouse parallax, scroll transition ---
  let prevTime = performance.now()
  /** Smoothed scroll position. The single driver for the whole transition. */
  let progress = 0
  const flyDir = new Vector3()
  const layerFly = new Vector3()
  const invRotation = new Quaternion()

  function update(time: number, state: InputState): number {
    const delta = Math.min((time - prevTime) / 1000, 0.1) // clamp big tab-switch gaps
    prevTime = time

    // One value, advanced once per frame, read by all four moving parts below
    // — that is what keeps them simultaneous rather than sequential.
    progress += (state.scroll - progress) * SCROLL_LERP

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

    world.update(delta, progress)

    renderer.clear()
    renderer.render(starfield, world.camera) // same vantage -> same orbital plane
    renderer.clearDepth() // world layer sits in front of the starfield
    renderer.render(world.scene, world.camera)

    return progress
  }

  function resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    world.resize(w / h) // one camera now drives both passes
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
  }

  return { update, resize }
}
