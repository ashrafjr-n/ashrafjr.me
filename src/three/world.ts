/**
 * World layer — the bird's-eye camera the starfield is drawn through, and the
 * Scene 2 model with its own front-on camera.
 *
 * Kept as its own scene so the depth clear between the two passes can put the
 * model in front of the stars whatever their real depth. `scene.ts` renders
 * the starfield through `camera` (bird's-eye), clears depth, then renders this
 * layer through `modelCamera` (level, facing the model).
 *
 * There is deliberately no ground/platform mesh: the model's own base is pure
 * black and the page background is the same black, so it reads as one
 * continuous surface.
 *
 * **Neither camera moves.** Scene 1 has no model at all — only the ring, empty
 * inside. Across the scroll the model rises from below the frame, grows, and
 * spins; all of it is on the pivot, as a pure function of progress.
 *
 * Palette: white/black/silver-gray only.
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three'
import type { Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clamp } from '../lib/math'

// --- Framing ---
const CAMERA_FOV = 35
// ~63° above the horizon: steeper, more overhead than the ~50° it used to sit
// at. Distance to the target is held at ~10 units so the framing barely shifts.
const CAMERA_POS = { x: 0, y: 9.3, z: 4.6 }
const CAMERA_TARGET = { x: 0, y: 0.25, z: 0 } // model's own mid-height: centers it on screen

/**
 * The model's own camera: level with it and looking straight at its face,
 * where the bird's-eye camera above now frames only the stars. Same fov and
 * ~10-unit distance, so the model's on-screen width (and MODEL_SCALE_PER_ASPECT
 * below) carries over. It looks at the origin, where `update()` holds the
 * model's centre once it has risen.
 */
const MODEL_CAMERA_POS = { x: 0, y: 1.2, z: 10.1 }

/**
 * Full turns the model makes across the scroll transition, on top of its idle
 * spin. Driven by progress rather than elapsed time, so it lands on exactly
 * this many turns however fast or slow the page is scrolled.
 *
 * Keep it a whole number, so the model finishes square with where it started.
 * It was briefly 2 and that read as too fast and too many — one turn across
 * the whole scroll is the pace this transition wants.
 */
const TRANSITION_TURNS = 1

/**
 * How much larger the model runs by Scene 2. Mixed in by the same `progress`
 * as the spin, so it grows through the transition and is at full size exactly
 * when the folders are.
 *
 * Applied to the pivot `Group`, not to the model's own `fitModel()` scale: the
 * pivot's local origin already sits on the model's ground-centre point, so
 * scaling it in place doesn't lift the model off `y = 0` or shift its x/z
 * centre, and uniform scale commutes with the Y-axis spin.
 */
const MODEL_SCENE2_SCALE = 1.35

/**
 * Ceiling on that growth, per unit of aspect ratio — and **what it is
 * protecting is the two folders, not the frame's edges.**
 *
 * The model's on-screen half-width is `0.3124 * scale / aspect` of the screen
 * width (`CAMERA_FOV` 35 at ~10.15 units with `MODEL_SPAN` 3.5, plus the
 * near edge's perspective magnification). The flanking folders' inner edges
 * sit at about 0.281 of the screen width out from the centre at every width
 * the wide query covers — `--folder-side-inset` and the folder's own `15vw`
 * ceiling both scale with the viewport, which is what makes that figure
 * constant. So the model has to stay under it.
 *
 * Because the cap is proportional to aspect, `0.3124 * cap` is a constant:
 * this pins the model's half-width at **23.7% of the screen width** whenever
 * the cap binds, leaving ~4.4% of clear black between it and each folder. That
 * is the real reason for the shape of this constant — it holds the gap, rather
 * than holding a scale.
 *
 * `Math.max(1, ...)` is what keeps it safe outside the wide query: on a phone
 * (aspect ~0.46) the cap computes to 0.35, and without the floor this would
 * *shrink* the model rather than leave it alone. Narrow viewports get no
 * growth at all, which is correct — they have no room for it.
 */
const MODEL_SCALE_PER_ASPECT = 0.76

/**
 * Scene 1 has no model — only the ring, empty inside. It rises into Scene 2
 * from below the frame across this stretch of the scroll, the same window the
 * folder constellations build in (ENTER_AT..FORM_AT in `constellation.ts`), so
 * it lands as the folders do.
 */
const RISE_START = 0.45
const RISE_END = 0.92
/** World units below its resting centre it starts at: clear of the frame's bottom edge. */
const RISE_DROP = 6
/** Fraction of its final size it starts the rise at, growing to full as it lands. */
const RISE_SCALE_FROM = 0.4

const MODEL_URL = '/models/space_boi.glb'
/**
 * Target world size of the model's widest horizontal dimension. The GLB is a
 * wide, shallow diorama, so it is fitted by footprint rather than height —
 * fitting by height would blow the footprint far past the viewport.
 */
const MODEL_SPAN = 3.5

/**
 * Radians per second the model turns about its own Y axis — and therefore the
 * exact rate at which the stars embedded in the model sweep around its centre.
 *
 * The site's starfield brackets this rate (see SPEED_TIERS in `scene.ts`) so
 * the two sets of stars read as one system. Change this and the starfield
 * follows automatically; that coupling is deliberate.
 */
export const MODEL_SPIN_RATE = 0.09 // ~70s per revolution: calm

/**
 * Negative because from this bird's-eye camera a positive Y rotation reads
 * counter-clockwise, and we want clockwise.
 */
const SPIN_SPEED = -MODEL_SPIN_RATE

/**
 * Normalize the GLB: uniform-scale it to MODEL_SPAN, center it on x/z and drop
 * it so its lowest point rests on y = 0.
 *
 * The resulting offset is a translation on the model itself, which is why the
 * model is parented to a pivot `Group` rather than spun directly — rotating it
 * in place would swing it around the GLB's own origin (Three applies
 * translation *after* rotation), making it orbit instead of spin.
 */
function fitModel(model: Object3D): void {
  const box = new Box3().setFromObject(model)
  const size = box.getSize(new Vector3())
  model.scale.setScalar(MODEL_SPAN / (Math.max(size.x, size.z) || 1))

  const fitted = new Box3().setFromObject(model)
  const center = fitted.getCenter(new Vector3())
  model.position.set(-center.x, -fitted.min.y, -center.z)
}

export interface WorldLayer {
  scene: Scene
  /** Bird's-eye: the starfield and the constellations' ring are drawn through it. */
  camera: PerspectiveCamera
  /** Front-on: the model alone is drawn through it. */
  modelCamera: PerspectiveCamera
  /**
   * Advance the spin. Driven by the single RAF loop; `delta` is in seconds and
   * `progress` is the 0..1 Scene 1 -> Scene 2 scroll position. Neither camera
   * is touched — see the note at the top of the file.
   */
  update(delta: number, progress: number): void
  resize(aspect: number): void
}

export function createWorld(aspect: number): WorldLayer {
  const scene = new Scene()

  // Set once, never written again: the stars' vantage in both scenes.
  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 200)
  camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z)
  camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z)

  const modelCamera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 200)
  modelCamera.position.set(MODEL_CAMERA_POS.x, MODEL_CAMERA_POS.y, MODEL_CAMERA_POS.z)
  modelCamera.lookAt(0, 0, 0)

  // Pure-white lights only — they shape the model without tinting it.
  const key = new DirectionalLight(0xffffff, 2.2)
  key.position.set(4, 8, 5)
  const fill = new DirectionalLight(0xffffff, 0.8)
  fill.position.set(-5, 3, -4)
  scene.add(new AmbientLight(0xffffff, 1.1), key, fill)

  // Rotation pivot: sits at the origin, which fitModel() lines the model's own
  // centre up with. Spinning and scaling this Group keeps the model in place on
  // x/z; only `position.y` is written, for the rise.
  const pivot = new Group()
  pivot.visible = false
  scene.add(pivot)

  /** Half the fitted model's height: lifts its centre, not its base, onto the camera's aim. */
  let modelMidY = 0

  // Async — the starfield renders immediately, the model pops in when it has
  // loaded.
  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      fitModel(gltf.scene)
      modelMidY = new Box3().setFromObject(gltf.scene).max.y / 2
      pivot.add(gltf.scene)
    },
    undefined,
    (err) => console.error(`[world] failed to load ${MODEL_URL}`, err),
  )

  /** Idle spin only, accumulated over elapsed time. */
  let idleAngle = 0

  // Frame-rate independent: the angle advances by elapsed time, not per frame.
  function update(delta: number, progress: number): void {
    idleAngle += SPIN_SPEED * delta

    // Total spin = the idle turn + exactly TRANSITION_TURNS across the scroll.
    // The transition term is a function of progress, not of elapsed time, which
    // is what makes it land on a whole number of turns no matter how fast the
    // page is scrolled — a time-integrated boost cannot, since the total then
    // depends on how long the user took. Negative to match SPIN_SPEED, so the
    // scroll turn continues in the idle direction instead of fighting it.
    pivot.rotation.y = idleAngle - TRANSITION_TURNS * Math.PI * 2 * progress

    // Grow into Scene 2, capped so the model never reaches the folders
    // standing either side of it. `camera.aspect` is read per frame rather
    // than cached off a resize listener, so a window dragged wider retunes the
    // cap the same way the CSS retunes the folders.
    const scale = Math.max(1, Math.min(MODEL_SCENE2_SCALE, MODEL_SCALE_PER_ASPECT * camera.aspect))

    // Rise from below and grow, eased out so it settles into place. A pure
    // function of progress, so scrolling back up sinks it away again.
    const rise = 1 - Math.pow(1 - clamp((progress - RISE_START) / (RISE_END - RISE_START), 0, 1), 3)
    const s = scale * (RISE_SCALE_FROM + (1 - RISE_SCALE_FROM) * rise)
    pivot.visible = progress > RISE_START
    pivot.scale.setScalar(s)
    pivot.position.y = -RISE_DROP * (1 - rise) - modelMidY * s
  }

  function resize(nextAspect: number): void {
    for (const cam of [camera, modelCamera]) {
      cam.aspect = nextAspect
      cam.updateProjectionMatrix()
    }
  }

  return { scene, camera, modelCamera, update, resize }
}
