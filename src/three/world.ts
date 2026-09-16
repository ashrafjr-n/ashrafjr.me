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
import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clamp } from '../lib/math'

// --- Framing ---
const CAMERA_FOV = 35
// ~63° above the horizon: steeper, more overhead than the ~50° it used to sit
// at. Distance to the target is held at ~10 units so the framing barely shifts.
const CAMERA_POS = { x: 0, y: 9.3, z: 4.6 }
const CAMERA_TARGET = { x: 0, y: 0.25, z: 0 } // model's own mid-height: centers it on screen

/**
 * The model's own camera: exactly level with the model's centre (both at
 * y = 0) and looking straight ahead, never down at it — the bird's-eye camera
 * above frames only the stars.
 */
const MODEL_CAMERA_DIST = 10.1
/**
 * Where the model sits on screen is set by shifting the lens, not by tilting
 * the camera or moving the model: the frame slides up by this fraction of its
 * height, so the model draws that much below centre with its level, head-on
 * perspective untouched.
 */
const LENS_DROP = 0.12
const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360)

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
 * Scene 3's model fills the frame: its **visible** half-width is solved to this
 * fraction of the screen width, per aspect, every frame.
 *
 * "Visible" is the model's white geometry only — the black base slab reads as
 * the page and is ignored, and it is far wider than the rings and planets, so
 * fitting by it would leave the model looking small.
 */
const FIT_HALF_WIDTH = 0.62

/**
 * Scene 1 has no model — only the ring, empty inside. It rises into Scene 3
 * from below the frame across this stretch of the transition, while the ring
 * gathers back in behind it.
 */
const RISE_START = 0.45
const RISE_END = 0.92
/** World units below its resting centre it starts at: clear of the frame's bottom edge. */
const RISE_DROP = 8
/** Fraction of its final size it starts the rise at, growing to full as it lands. */
const RISE_SCALE_FROM = 0.4

/**
 * Radians per second each planet inside the model turns on its own axis, in
 * the order the GLB lists them. Signs alternate so the group never reads as
 * one rigid object being spun — and all of it is slow enough to be noticed
 * rather than watched.
 *
 * The list wraps, so it does not have to match the planet count; it is only as
 * long as it needs to be for the pattern not to repeat obviously.
 */
const PLANET_SPIN_RATES = [0.2, -0.13, 0.11, -0.26, 0.17, -0.09, 0.23]

/**
 * A node whose thinnest axis is under this fraction of its widest is one of
 * the model's rings, and is left out of the spin.
 *
 * A ring is authored as a sphere squashed to no thickness at all, so its own
 * rotation is invisible by construction — but the ring is *tilted*, and turning
 * a tilted disc about the model's up axis swings its tilt around instead,
 * which reads as the ring wobbling and going edge-on. Leaving it where it
 * stands while the planet turns inside it is what a ring actually does.
 */
const RING_FLATNESS = 0.05

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
  modelCamera.position.set(0, 0, MODEL_CAMERA_DIST)
  // Ratios only, so any full size works; it survives every projection update.
  modelCamera.setViewOffset(1, 1, 0, -LENS_DROP, 1, 1)

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

  /**
   * The planets, each on a pivot at its own centre. They turn on the clock,
   * independently of the model's own spin — the model is only ever on screen
   * in Scene 3, so there is nothing to gate them behind.
   */
  const planets: { pivot: Group; rate: number }[] = []

  /** Centre height of the visible geometry, so that — not the base — is what gets placed. */
  let modelMidY = 0
  /** Furthest the visible geometry reaches from the spin axis, at pivot scale 1. */
  let visibleRadius = 1

  // Async — the starfield renders immediately, the model pops in when it has
  // loaded.
  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      // Before fitModel, while the GLB's own root is still untransformed, so a
      // planet's world position is its position in that root and the pivots go
      // straight in without a change of basis.
      rigPlanets(gltf.scene)
      fitModel(gltf.scene)
      measureVisible(gltf.scene)
      pivot.add(gltf.scene)
    },
    undefined,
    (err) => console.error(`[world] failed to load ${MODEL_URL}`, err),
  )

  /**
   * Give every planet in the GLB a pivot at its own centre, so it can turn in
   * place.
   *
   * The GLB bakes each planet's position into its node matrix and leaves the
   * geometry centred on the origin, so rotating a node directly would swing it
   * around the model's centre instead of its own — the same reason the model
   * itself hangs off a pivot rather than being spun where it stands.
   *
   * A planet is several nodes, not one: a core and a shell over it, sharing one
   * position. They are grouped by that position rather than by name, so the
   * parts of a planet stay together however the GLB numbers them. `attach()`
   * keeps each node exactly where it already is. Rings share that position too
   * and are deliberately left out — see RING_FLATNESS.
   */
  function rigPlanets(model: Object3D): void {
    model.updateMatrixWorld(true)
    const at = new Vector3()
    const groups = new Map<string, Object3D[]>()
    model.traverse((obj) => {
      // The planet nodes themselves, not the `Sphere.001_Material.002_0`
      // meshes hanging off them.
      if (!/^Sphere(\.\d+)?$/.test(obj.name)) return
      const { x, y, z } = obj.scale
      if (Math.min(x, y, z) < RING_FLATNESS * Math.max(x, y, z)) return // a ring
      const key = obj.getWorldPosition(at).toArray().map((n) => n.toFixed(1)).join()
      const found = groups.get(key)
      if (found) found.push(obj)
      else groups.set(key, [obj])
    })

    let i = 0
    for (const nodes of groups.values()) {
      const planet = new Group()
      planet.position.copy(nodes[0].getWorldPosition(at))
      model.add(planet)
      for (const node of nodes) planet.attach(node)
      planets.push({ pivot: planet, rate: PLANET_SPIN_RATES[i % PLANET_SPIN_RATES.length] })
      i++
    }
  }

  /**
   * Walk every vertex of the non-black meshes once: the max distance from the
   * Y axis (what a spinning model sweeps) and the vertical extent. Runs once
   * on load, before the model is parented, so its matrices are model-local.
   */
  function measureVisible(model: Object3D): void {
    model.updateMatrixWorld(true)
    const v = new Vector3()
    let r = 0
    let minY = Infinity
    let maxY = -Infinity
    model.traverse((obj) => {
      const mesh = obj as Mesh
      const material = mesh.material as MeshStandardMaterial | undefined
      if (!mesh.isMesh || !material?.color || material.color.getHex() === 0) return
      const pos = mesh.geometry.getAttribute('position')
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
        r = Math.max(r, Math.hypot(v.x, v.z))
        minY = Math.min(minY, v.y)
        maxY = Math.max(maxY, v.y)
      }
    })
    if (r > 0) {
      visibleRadius = r
      modelMidY = (minY + maxY) / 2
    }
  }

  /**
   * Pivot scale that puts the visible edge at FIT_HALF_WIDTH of the screen.
   * A point at radius R swinging toward a camera D away projects widest at
   * tan = R / sqrt(D² - R²), so R = D·tan / sqrt(1 + tan²).
   */
  function fitScale(): number {
    const tan = 2 * FIT_HALF_WIDTH * TAN_HALF_FOV * modelCamera.aspect
    return (MODEL_CAMERA_DIST * tan) / Math.sqrt(1 + tan * tan) / visibleRadius
  }

  /** Idle spin only, accumulated over elapsed time. */
  let idleAngle = 0

  // Frame-rate independent: the angle advances by elapsed time, not per frame.
  function update(delta: number, progress: number): void {
    idleAngle += SPIN_SPEED * delta

    // Each planet on its own axis, at its own rate. Accumulated over elapsed
    // time like the model's idle spin, not driven by progress: nothing here
    // has to land anywhere in particular.
    for (const planet of planets) planet.pivot.rotation.y += planet.rate * delta

    // Total spin = the idle turn + exactly TRANSITION_TURNS across the scroll.
    // The transition term is a function of progress, not of elapsed time, which
    // is what makes it land on a whole number of turns no matter how fast the
    // page is scrolled — a time-integrated boost cannot, since the total then
    // depends on how long the user took. Negative to match SPIN_SPEED, so the
    // scroll turn continues in the idle direction instead of fighting it.
    pivot.rotation.y = idleAngle - TRANSITION_TURNS * Math.PI * 2 * progress

    const scale = fitScale()

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
