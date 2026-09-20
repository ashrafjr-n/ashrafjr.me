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
import {
  PRESS_DIST,
  PRESS_MIN_DEPTH,
  RELEASE_SPREAD,
  SETTLED_POINT_SIZE,
  faceAt,
  isMoving,
  pressAt,
  releaseAt,
  settleAt,
  spinAt,
} from '../lib/press'
import { toModel, toTransition } from '../lib/phases'
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
 * together. The spring is what that smoothing is done with, rather than a
 * first-order chase: a chase has no memory of its own speed, so the instant the
 * target moves the output's velocity moves with it — and a wheel delivers
 * scroll in coarse notches, so the output's velocity was a sawtooth even while
 * the value itself looked smooth. A critically damped spring carries velocity
 * as state, can only *accelerate* toward a new target, and never overshoots
 * past the position the reader chose.
 *
 * Integrated semi-implicitly (velocity first, then position), which stays
 * stable for any `OMEGA * delta` well under 2 — `delta` is clamped to 0.1s
 * upstream, so the worst case here is 2.0.
 *
 * **20 is deliberately fast: the page is meant to feel like an ordinary
 * scroll.** Steady-state lag on a held scroll is `2 / OMEGA`, so this is about
 * 0.1s — enough to take the notches off the wheel and nothing more. It ran at
 * 7.0 with a second *trail* stage chased over it, together ~0.6s of coast, and
 * that read as heavy and slow. The trail is gone; don't reintroduce a second
 * stage here or anywhere else (see `ui/identity.ts`).
 */
const SCROLL_OMEGA = 20.0

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
 * still fetched, which is the one thing this does not save.
 *
 * Typed `boolean` rather than left to narrow to `false`, so the branches below
 * stay live code and `toModel` stays referenced.
 */
const MODEL_ENABLED: boolean = false

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
  /**
   * Per-star drift as the ring lets go and joins the field, x/z interleaved
   * and in the layer's own plane — which, by the time it is used, is the plane
   * facing the camera. Only the ring carries one.
   */
  release: Float32Array | null
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

/** Everything the press needs for one layer, for one frame. Mutated in place. */
interface PressFrame {
  /** How flat the field is: 0 is Scene 1's depth, 1 is a single plane. */
  press: number
  /** What is left of the orbit's speed — 1 turning, 0 stopped. */
  spin: number
  /** How far the ring has dispersed into the field, 0..1. */
  release: number
  /** The camera's position, in the layer's own local space. */
  camX: number
  camY: number
  camZ: number
  /** The view axis, in the layer's own local space. */
  fwdX: number
  fwdY: number
  fwdZ: number
}

/**
 * Advance every star in a layer along its own circle, then press the result
 * flat by however far the scroll has taken it.
 *
 * The orbit angle is unbounded and only ever increases, so the underlying
 * motion stays a true endless 360° revolution — there is no clamp, wrap or
 * easing here by design. `spin` is the one thing that stops it, and it does so
 * by scaling the *rate*, so a stopped field simply stays where it is.
 *
 * **The press moves a star along its own sightline, not along the view axis**,
 * and that distinction is the whole design. Scaling the star's offset *from
 * the camera* leaves its direction — and so its exact place on screen —
 * untouched while taking its depth to `PRESS_DIST`. The field therefore does
 * not rearrange itself as it flattens: it keeps Scene 1's composition, already
 * tuned for density, and only loses the size and brightness spread that made
 * it read as a space. Pressing along the view axis instead would have thrown
 * the deep stars outward off the frame and emptied the picture.
 *
 * Everything but the orbit is computed *from* the scroll value rather than
 * accumulated, so scrubbing back up rewinds it exactly.
 */
function advance(layer: StarLayer, delta: number, frame: PressFrame): void {
  const arr = layer.positions
  const { press, release, camX, camY, camZ, fwdX, fwdY, fwdZ } = frame
  const spun = delta * frame.spin

  for (let i = 0; i < layer.count; i++) {
    const angle = layer.angles[i] + layer.speeds[i] * spun
    layer.angles[i] = angle

    const radius = layer.radii[i]
    let x = Math.cos(angle) * radius
    let y = layer.heights[i]
    let z = Math.sin(angle) * radius

    // The ring letting go. Its own plane is the pressed one by this point, so
    // a drift in local x/z is a drift across the surface the reader is facing.
    if (layer.release) {
      x += layer.release[i * 2] * release
      z += layer.release[i * 2 + 1] * release
    }

    if (press > 0) {
      const dx = x - camX
      const dy = y - camY
      const dz = z - camZ
      const depth = dx * fwdX + dy * fwdY + dz * fwdZ
      // Below PRESS_MIN_DEPTH the scaling runs away and there is nothing on
      // screen to protect — see the constant.
      if (depth > PRESS_MIN_DEPTH) {
        const pull = 1 + (PRESS_DIST / depth - 1) * press
        x = camX + dx * pull
        y = camY + dy * pull
        z = camZ + dz * pull
      }
    }

    const i3 = i * 3
    arr[i3] = x
    arr[i3 + 1] = y
    arr[i3 + 2] = z
  }
  layer.posAttr.needsUpdate = true
}

/**
 * Swap a layer between the mipmapped sprite and the plain one, skipping the
 * write when it is already on the right one.
 *
 * **The press walks the ambient cloud straight into the trap `sprite.ts`
 * describes, and this is the way out.** Today the cloud's points run from
 * ~1.7px at the field's far edge to ~7.7px close in, so its minification is
 * real and varied and mipmaps are what stop them shimmering as they orbit.
 * Pressed flat they all land at 2.2px — one small size, every point at once,
 * which is the exact condition that took the ring's stars to 92/255 before its
 * own sprite was made mipmap-free. Left alone the settled cloud would read
 * dim *and* would not match the ring beside it, and a field that is visibly
 * two populations is not the one texture the backdrop has to be.
 *
 * It is a step rather than a ramp, and it is put on the very first frame of
 * scroll on purpose. The resting composition is protected, so nothing may
 * change at page 0; one frame later the far stars come up to meet the near
 * ones, which **is** the press's first beat — the depth cue in the brightness
 * draining away. Getting it from a texture swap costs nothing per frame.
 */
function setSprite(layer: StarLayer, texture: CanvasTexture): void {
  const material = layer.points.material as PointsMaterial
  if (material.map === texture) return
  material.map = texture
  material.needsUpdate = true
}

/**
 * Ease a layer's point size from what it was authored at toward the one size
 * the settled field shares, skipping the write when it has not changed.
 *
 * A material size change is free in Three — no rebuild, no re-upload — but the
 * value holds for the whole of Scenes 2 and 3, so the comparison is worth more
 * than the assignment it saves.
 */
function setPointSize(layer: StarLayer, authored: number, settled: number): void {
  const size = authored + (SETTLED_POINT_SIZE - authored) * settled
  const material = layer.points.material as PointsMaterial
  if (material.size !== size) material.size = size
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
    transition: { release?: boolean } = {},
  ): StarLayer {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const radii = new Float32Array(count)
    const heights = new Float32Array(count)
    const angles = new Float32Array(count)
    const speeds = new Float32Array(count)
    const release = transition.release ? new Float32Array(count * 2) : null
    const c = new Color()

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const { radius, y } = place()
      const angle = Math.random() * Math.PI * 2

      radii[i] = radius
      heights[i] = y
      angles[i] = angle
      speeds[i] = randomOrbitSpeed()
      if (release) {
        // An even spread over the area, not over the radius: `sqrt` is what
        // stops them piling up around the ring they came from.
        const drift = Math.sqrt(Math.random()) * RELEASE_SPREAD
        const heading = Math.random() * Math.PI * 2
        release[i * 2] = Math.cos(heading) * drift
        release[i * 2 + 1] = Math.sin(heading) * drift
      }

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
      release,
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
    sprite: plainSprite,
  }, { release: true })

  // --- Scene 1 world layer (the model), drawn over the starfield ---
  const world = createWorld(window.innerWidth / window.innerHeight)

  /** Both layers, in one array so the frame loop allocates nothing per frame. */
  const layers = [cloud, band]

  // --- The press's fixed geometry, solved once: the camera never moves ---
  /** The view axis, world space: the direction the bird's-eye camera faces. */
  const viewAxis = new Vector3()
  world.camera.getWorldDirection(viewAxis)
  /** The ring's resting orientation, and the one that faces the camera. */
  const NO_TURN = new Quaternion()
  const faceCamera = new Quaternion().setFromUnitVectors(
    // The ring lies in the XZ plane, so its own normal is +Y. Turning that
    // normal onto the line to the camera is what opens the ellipse.
    new Vector3(0, 1, 0),
    world.camera.position.clone().normalize(),
  )
  /** Scratch, reused every frame so the loop allocates nothing. */
  const inverseTurn = new Quaternion()
  const camLocal = new Vector3()
  const axisLocal = new Vector3()
  const frame: PressFrame = {
    press: 0,
    spin: 1,
    release: 0,
    camX: 0,
    camY: 0,
    camZ: 0,
    fwdX: 0,
    fwdY: 0,
    fwdZ: 0,
  }
  /** Whether the settled field has already been written into the buffers. */
  let stillDrawn = false

  /**
   * Run the press over both layers. The displacement is written into each
   * layer's own buffer, which its own rotation then turns, so the camera and
   * the view axis are converted into that layer's local space first — the same
   * reason the fly-past used to do it.
   */
  function advanceLayers(delta: number): void {
    for (const layer of layers) {
      inverseTurn.copy(layer.points.quaternion).invert()
      camLocal.copy(world.camera.position).applyQuaternion(inverseTurn)
      axisLocal.copy(viewAxis).applyQuaternion(inverseTurn)
      frame.camX = camLocal.x
      frame.camY = camLocal.y
      frame.camZ = camLocal.z
      frame.fwdX = axisLocal.x
      frame.fwdY = axisLocal.y
      frame.fwdZ = axisLocal.z
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
      // stops when they do. The spring is held on the target, so turning the
      // setting back off mid-session resumes from here instead of springing in
      // from wherever it had been left.
      page = state.scroll
      pageVel = 0
    } else {
      pageVel +=
        (SCROLL_OMEGA * SCROLL_OMEGA * (state.scroll - page) - 2 * SCROLL_OMEGA * pageVel) * delta
      page += pageVel * delta
      // Critical damping does not overshoot, but the integrator can by a hair
      // on a long frame, and past 1 the Scene 3 curve turns back on itself.
      if (page < 0 || page > 1) {
        page = clamp(page, 0, 1)
        pageVel = 0
      }
    }
    // Paused through the identity scene — see lib/phases.ts.
    const progress = toTransition(page)

    // --- The press: Scene 1's depth draining away, all off `progress` ---
    frame.press = pressAt(progress)
    frame.spin = spinAt(progress)
    frame.release = releaseAt(progress)
    const settled = settleAt(progress)

    // The ring turns to face the camera, so its ellipse opens into a true
    // circle before it is flattened. It is the only layer that turns; the
    // cloud has no orientation worth speaking of.
    band.points.quaternion.slerpQuaternions(NO_TURN, faceCamera, faceAt(progress))

    // Mouse parallax — tilt the wide field a few degrees, lerped. **It dies
    // with the press**, and that is what sells the flatness more than anything
    // else here: a surface does not have parallax, so a field that still
    // answered the mouse would keep reading as a space however flat it looked.
    // The band is deliberately never tilted; its full-loop visibility was
    // solved for a level plane, and a 5° tilt pushes its near side off frame.
    const reach = MAX_TILT * (1 - settled)
    if (reach === 0) {
      // Snapped rather than chased, so the tilt actually reaches zero — a lerp
      // only approaches it, which would leave the scene permanently "moving"
      // and defeat the still-frame gate below.
      cloud.points.rotation.y = 0
      cloud.points.rotation.x = 0
    } else {
      cloud.points.rotation.y += (state.mouseX * reach - cloud.points.rotation.y) * TILT_LERP
      cloud.points.rotation.x += (-state.mouseY * reach - cloud.points.rotation.x) * TILT_LERP
    }

    // Both layers converge on one point size. Two layers authored for two
    // different distances would otherwise land on one plane drawing at four
    // times each other's size, and the settled field has to read as one
    // texture — see SETTLED_POINT_SIZE.
    setPointSize(cloud, CLOUD_POINT_SIZE, settled)
    setPointSize(band, BAND_POINT_SIZE, settled)
    setSprite(cloud, frame.press > 0 ? plainSprite : mippedSprite)

    // **Nothing in the starfield changes again once Scene 1 is over**: every
    // press curve has clamped, the orbit has stopped and the parallax is dead.
    // So for the remaining two thirds of the page the position pass is skipped
    // entirely — 20,600 stars' worth of trig and writes, and the two buffer
    // uploads that follow it (~250KB a frame), which together are all of this
    // loop's real cost. One frame of it still runs after the last curve lands,
    // to put the settled state in the buffers.
    //
    // **The render itself is deliberately not skipped**, and that is not an
    // oversight. The renderer is `preserveDrawingBuffer: false`, so the
    // contents of a frame that is not drawn are undefined — and Scene 3's
    // panel does not paint a white half, it inverts whatever the canvas is
    // already showing underneath it (`ui/invert.ts`). A dropped frame there
    // would take the stars out of the white half. Re-drawing points that have
    // not moved costs one draw call and no upload at all, which is not worth
    // trading that for.
    const moving = isMoving(progress) || frame.spin > 0 || reach > 0 || MODEL_ENABLED
    if (moving || !stillDrawn) advanceLayers(delta)
    stillDrawn = !moving

    // The transition for the spin and the Scene 3 lift, and the page for the
    // rise into Scene 2 — the transition is frozen through identity, so it
    // cannot carry an entrance that happens inside it.
    if (MODEL_ENABLED) world.update(delta, progress, toModel(page))

    renderer.clear()
    renderer.render(starfield, world.camera) // same vantage -> same orbital plane
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
  }

  return { update, resync, resize }
}
