/**
 * Scene 1 world layer — the model, lit and framed from a bird's-eye camera.
 *
 * Kept as its own scene so the depth clear between the two passes can put the
 * model in front of the stars whatever their real depth. `scene.ts` renders
 * the starfield first, clears depth, then renders this layer on top — both
 * passes through this camera, which is what lines the star orbits up with the
 * model's own plane. The starfield has no camera of its own.
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
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three'
import type { Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// --- Framing ---
const CAMERA_FOV = 35
// ~63° above the horizon: steeper, more overhead than the ~50° it used to sit
// at. Distance to the target is held at ~10 units so the framing barely shifts.
const CAMERA_POS = { x: 0, y: 9.3, z: 4.6 }
const CAMERA_TARGET = { x: 0, y: 0.25, z: 0 } // model's own mid-height: centers it on screen

// --- Scene 2 framing, reached at scroll progress 1 ---
// Dead level: the eye and the look-at point share a height, so the pitch is
// exactly 0° — a straight-on view of the model rather than the ~63° overhead of
// Scene 1. Keep these two `y` values equal to keep the view level.
// The height is the model's own mid-height, which centres it in frame.
// This is the phone framing — see MOBILE below. Desktop/tablet get the WIDE
// variants instead.
const SCENE2_CAMERA_POS = { x: 0, y: 0.3, z: 4.3 }
const SCENE2_CAMERA_TARGET = { x: 0, y: 0.3, z: 0 }

/**
 * Desktop/tablet-only Scene 2 recomposition. The eye sits well above the
 * target while the target's own height is untouched, which is what raises
 * the camera without re-leveling it flat: pitch = atan((1.3 - 0.3) / 4.3) ≈
 * 13° of look-down, a moderate step up from dead level and nowhere near
 * Scene 1's ~63° overhead. Paired with the model's own left shift and
 * scale-up below, so style.css's `min-width: 768px` block has room on the
 * right for the reworked word/portrait stack.
 *
 * Gated on the same 767.98px breakpoint as the rest of the site (see MOBILE
 * below) — mobile keeps the level, centred framing above completely
 * untouched.
 */
const SCENE2_CAMERA_POS_WIDE = { x: 0, y: 1.3, z: 4.3 }
const SCENE2_CAMERA_TARGET_WIDE = { x: 0, y: 0.3, z: 0 }

/**
 * Desktop/tablet only: how far left the model's pivot shifts by Scene 2, and
 * how much it scales up over the same span. Both are applied to the pivot
 * Group, not the model's own fitted scale/position from fitModel() — see
 * update() for why that composes safely (the pivot's local origin already
 * sits on the model's ground-centre point, so scaling it in place doesn't
 * lift the model off y = 0 or shift its x/z centre, and translating it
 * afterward moves the whole already-scaled group by a fixed world offset
 * regardless of that scale).
 *
 * Negative x is screen-left for this camera rig (world +x reads as screen
 * right here — see the camera basis note where this is used).
 *
 * Two tiers, not one: at CAMERA_FOV 35 and SCENE2_CAMERA_POS_WIDE's distance,
 * the visible width at the model's own plane is set by the *horizontal* FOV,
 * which shrinks with aspect — a tall tablet portrait (~0.73–0.78) sees barely
 * over half the horizontal span a 16:10 desktop does. The full DESKTOP shift
 * pushed the model's near edge off the left of the frame on an iPad-width
 * tablet, so it is gated behind the same min-width: 900px boundary
 * style.css's own desktop block uses (see DESKTOP below); tablets (768–
 * 899.98px) get the milder TABLET tier instead.
 */
const MODEL_X_TABLET = -0.65
const MODEL_SCALE_TABLET = 1.12
const MODEL_X_DESKTOP = -1.3
const MODEL_SCALE_DESKTOP = 1.3

/**
 * Full turns the model makes across the scroll transition, on top of its idle
 * spin. Driven by progress rather than elapsed time, so it lands on exactly
 * this many turns however fast or slow the page is scrolled.
 */
const TRANSITION_TURNS = 1

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

  // Same two breakpoints style.css's Scene 2 row uses (the phone query and
  // the min-width: 900px desktop-size block). `.matches` is read fresh in
  // update() every frame rather than cached from a resize listener, so the
  // Scene 2 composition tracks the live viewport the same way the CSS does —
  // including a window resized across a boundary mid-session, not just at
  // load.
  const MOBILE = window.matchMedia('(max-width: 767.98px)')
  const DESKTOP = window.matchMedia('(min-width: 900px)')

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

    // Dolly in and drop the angle. Both the eye and the look-at point blend, so
    // the camera arcs down and forward together instead of just pitching.
    // Desktop/tablet blend toward the WIDE rig instead of the phone one —
    // mobile's target is untouched by this branch. Scene 1 (progress 0) is
    // identical either way, since both blends start from the same CAMERA_POS/
    // CAMERA_TARGET.
    const wide = !MOBILE.matches
    const scene2Pos = wide ? SCENE2_CAMERA_POS_WIDE : SCENE2_CAMERA_POS
    const scene2Target = wide ? SCENE2_CAMERA_TARGET_WIDE : SCENE2_CAMERA_TARGET

    camera.position.set(
      mix(CAMERA_POS.x, scene2Pos.x, progress),
      mix(CAMERA_POS.y, scene2Pos.y, progress),
      mix(CAMERA_POS.z, scene2Pos.z, progress),
    )
    camera.lookAt(
      mix(CAMERA_TARGET.x, scene2Target.x, progress),
      mix(CAMERA_TARGET.y, scene2Target.y, progress),
      mix(CAMERA_TARGET.z, scene2Target.z, progress),
    )

    // The model's own left shift and scale-up, desktop/tablet only — mixed by
    // the same progress as the camera so it arrives exactly as Scene 2 does.
    // Explicitly reset on mobile rather than left alone, so a viewport resized
    // across a breakpoint mid-session can't strand the pivot off-centre or
    // over-scaled.
    const modelX = DESKTOP.matches ? MODEL_X_DESKTOP : MODEL_X_TABLET
    const modelScale = DESKTOP.matches ? MODEL_SCALE_DESKTOP : MODEL_SCALE_TABLET
    pivot.position.x = wide ? mix(0, modelX, progress) : 0
    pivot.scale.setScalar(wide ? mix(1, modelScale, progress) : 1)
  }

  function resize(nextAspect: number): void {
    camera.aspect = nextAspect
    camera.updateProjectionMatrix()
  }

  return { scene, camera, update, resize }
}
