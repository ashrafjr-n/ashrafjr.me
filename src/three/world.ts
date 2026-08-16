/**
 * Scene 1 world layer — the model, lit and framed from a bird's-eye camera.
 *
 * Kept as its own scene + camera so the starfield can keep its original
 * fixed-at-origin camera and behave exactly as before. `scene.ts` renders the
 * starfield first, clears depth, then renders this layer on top.
 *
 * There is deliberately no ground/platform mesh: the model's own base is pure
 * black and the page background is the same black, so it reads as one
 * continuous surface.
 *
 * Palette: white/black/silver-gray only.
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// --- Framing ---
const CAMERA_FOV = 35
// ~63° above the horizon: steeper, more overhead than the ~50° it used to sit
// at. Distance to the target is held at ~10 units so the framing barely shifts.
const CAMERA_POS = { x: 0, y: 9.3, z: 4.6 }
const CAMERA_TARGET = { x: 0, y: 0.25, z: 0 } // model's own mid-height: centers it on screen

// --- Scene 2 framing, reached at scroll progress 1 ---
// Closer in (distance ~10.2 -> ~5.0) and dropped from ~63° above the horizon to
// ~3° *below* it, so the model is viewed near-level and very slightly from
// underneath rather than from overhead.
const SCENE2_CAMERA_POS = { x: 0, y: 0.09, z: 4.99 }
const SCENE2_CAMERA_TARGET = { x: 0, y: 0.35, z: 0 }

/**
 * Peak multiplier added to the model's spin during the transition. The boost
 * follows sin(pi * progress): idle at both ends, fastest half-way through, so
 * Scene 2 settles back to the normal idle rate on its own.
 */
const SPIN_BOOST = 7

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

/** Linear blend, used to walk the camera from its Scene 1 rig to its Scene 2 one. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export interface WorldLayer {
  scene: Scene
  camera: PerspectiveCamera
  /**
   * Advance the spin and the camera. Driven by the single RAF loop; `delta` is
   * in seconds and `progress` is the 0..1 Scene 1 -> Scene 2 scroll position.
   */
  update(delta: number, progress: number): void
  resize(aspect: number): void
}

export function createWorld(aspect: number): WorldLayer {
  const scene = new Scene()

  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 200)
  camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z)
  camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z)

  // Pure-white lights only — they shape the model without tinting it.
  const key = new DirectionalLight(0xffffff, 2.2)
  key.position.set(4, 8, 5)
  const fill = new DirectionalLight(0xffffff, 0.8)
  fill.position.set(-5, 3, -4)
  scene.add(new AmbientLight(0xffffff, 1.1), key, fill)

  // Rotation pivot: sits at the origin, which fitModel() lines the model's own
  // centre up with. Spinning this Group keeps the model exactly in place.
  const pivot = new Group()
  scene.add(pivot)

  // Async — the starfield renders immediately, the model pops in when it has
  // loaded.
  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      fitModel(gltf.scene)
      pivot.add(gltf.scene)
    },
    undefined,
    (err) => console.error(`[world] failed to load ${MODEL_URL}`, err),
  )

  // Frame-rate independent: the angle advances by elapsed time, not per frame.
  function update(delta: number, progress: number): void {
    // Spin, boosted mid-transition. sin(pi * progress) is 0 at both ends, so
    // Scene 1 and Scene 2 both sit at the plain idle rate and the ramp in and
    // out is smooth without any separate state or timer.
    const boost = 1 + SPIN_BOOST * Math.sin(Math.PI * progress)
    pivot.rotation.y += SPIN_SPEED * boost * delta

    // Dolly in and drop the angle. Both the eye and the look-at point blend, so
    // the camera arcs down and forward together instead of just pitching.
    camera.position.set(
      mix(CAMERA_POS.x, SCENE2_CAMERA_POS.x, progress),
      mix(CAMERA_POS.y, SCENE2_CAMERA_POS.y, progress),
      mix(CAMERA_POS.z, SCENE2_CAMERA_POS.z, progress),
    )
    camera.lookAt(
      mix(CAMERA_TARGET.x, SCENE2_CAMERA_TARGET.x, progress),
      mix(CAMERA_TARGET.y, SCENE2_CAMERA_TARGET.y, progress),
      mix(CAMERA_TARGET.z, SCENE2_CAMERA_TARGET.z, progress),
    )
  }

  function resize(nextAspect: number): void {
    camera.aspect = nextAspect
    camera.updateProjectionMatrix()
  }

  return { scene, camera, update, resize }
}
