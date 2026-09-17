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
 * inside. The model rises from below into Scene 2, grows and turns once, then
 * the move into Scene 3 carries it up the screen at the same size. All of it
 * is on the pivot and the lens; nothing here runs on a clock but the idle
 * spin.
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
 * the camera or moving the model: the frame slides by this fraction of its
 * height, and the model draws that much off centre with its level, head-on
 * perspective untouched.
 *
 * **This is the only thing that should move the model up or down the screen.**
 * How high the camera sits *relative to the model* is a separate question, and
 * it is answered by what the model is anchored to (see `figureMidY`) — that
 * one sets the perspective, this one sets the composition.
 */
/**
 * **The model is in Scene 2 and Scene 3, at one size, in two places.**
 *
 * It rises from below into Scene 2 and sits low, against the bottom edge,
 * under the identity line; the move into Scene 3 carries it up the screen to
 * leave the lower two thirds of the frame empty. Nothing about the model
 * changes between the two — only the lens, which is what this pair is for.
 * The scale is `FIT_HALF_WIDTH`'s and it is the same in both.
 *
 * Positive drops the model down the screen, 1:1 in frame heights — verified on
 * screen, and it is what both were solved with. Measured at 1536x864 with the
 * model's own composition spanning 605px: Scene 2 puts its base line on the
 * bottom edge (864) with the model filling everything under the identity line,
 * and Scene 3 lifts it 259px so the base sits at 605 — the **top 70% of the
 * screen, the bottom 30% empty**, which is the brief. They are blended by how
 * far the Scene 3 lift has gone; see `update()`.
 */
const SCENE2_LENS = 0.548
const SCENE3_LENS = 0.248

/**
 * How far below the figure's own centre the camera is levelled, in the
 * model's units at fit scale 1.
 *
 * Zero is dead level with the figure. Positive drops the camera, so the model
 * is looked at slightly from below — which is what gives Scene 3 its height.
 * It is not the same knob as the lens: this one changes the perspective, the
 * lens only changes where the result sits on screen.
 */
const CAMERA_DROP = 0.34
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
 * Full turns the model makes while it rises into Scene 2, on top of the idle
 * spin — the one move it makes in that scene.
 *
 * Driven by the **page-driven** entrance rather than the transition, because
 * the transition is held for the whole of identity and a turn read off it
 * would be frozen exactly where the model is standing. One turn over the rise
 * is the medium, unhurried pace the entrance wants.
 */
const SCENE2_TURNS = 1

/**
 * The model's size, in both scenes: its **visible** geometry's total height as
 * a fraction of the frame's. **One number for both scenes** — the model does
 * not resize between them, it only moves.
 *
 * **Fitting by height replaced fitting by width, and it had to.** The width
 * solve (`byWidth` below) is `R = D·tan / sqrt(1 + tan²)` — the widest a point
 * at radius R projects as it swings toward the camera — and that expression is
 * a *sine*, so it is bounded by 1 however large the target half-width gets. The
 * ceiling is `scale = MODEL_CAMERA_DIST / visibleRadius`, which is under twice
 * the size Scene 3 used to run at and short of what this composition needs.
 * Height is linear in scale with no ceiling at all, so one screenshot
 * calibrates it exactly.
 *
 * It is **just over 1 on purpose**. "Visible" is every non-black vertex, and
 * most of those are the model's own scattered star specks, which spread wider
 * and taller than the planets-and-figure composition inside them. Measured on
 * the rendered page, that composition is **69% of the visible height**, so
 * 1.015 is what lands it on 70% of the screen — which is the brief for Scene 3:
 * the model takes the frame and only the bottom 30% is left empty.
 */
const FIT_HEIGHT = 1.015

/**
 * A cap on the above, as the visible half-width over the screen width, solved
 * per aspect. **It is a portrait guard and nothing else**: a height fit is
 * aspect-independent, so on a phone the same fraction of the height is several
 * screens wide and all that is left on frame is the middle of the figure.
 *
 * **It must not bind on desktop, and 1.05 did** — silently, which made
 * `FIT_HEIGHT` inert and the cap the real size knob. At 16:9 the height fit
 * needs 1.079 of headroom, so 1.30 clears it; on a phone (0.465) the cap is
 * what decides and holds the model to 46% of its desktop size. Re-check both
 * ends after touching either constant.
 */
const FIT_MAX_HALF_WIDTH = 1.3

/**
 * The stretch of the **transition** over which the model is carried from its
 * Scene 2 place at the bottom of the frame up to its Scene 3 one.
 *
 * The rise out of nothing is not on this curve — it happens inside identity,
 * where the transition is frozen, and is driven by `toModel()`'s page value
 * instead. This is only the lift between the two compositions.
 *
 * **`RISE_END` is 1, not the 0.92 it was, and that closed a real gap.** The
 * transition reaches 0.92 at page 0.891, so the last 109vh of the page — a
 * ninth of the whole scroll — had nothing moving on it at all. The phase curve
 * already lands the lift gently (`SCENE3_TAIL`), so there was never anything
 * for that stretch to settle; it was simply spare scroll. Ending on 1 spends
 * it.
 */
const RISE_START = 0.45
const RISE_END = 1

/**
 * World units below its Scene 2 place the model starts its entrance at: clear
 * of the frame's bottom edge, and not much more.
 *
 * **It is solved against the model's own size, so it had to come down when the
 * model grew.** At the Scene 2 lens the frame's lower edge sits at world
 * y = 0.31; the model at its starting `RISE_SCALE_FROM` scale is 1.30 units
 * half-height with its centre at 1.60, so anything over 2.59 hides it and 3.2
 * does that with a margin. It was 5, which was right for a model two thirds
 * this size and far too much for this one — a third of the way into its own
 * scroll only 9% of the frame had anything in it, which is most of the gap
 * that used to sit between the ring leaving and the model arriving. It was 8
 * before that, and worse.
 */
const RISE_DROP = 3.2
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
   * Advance the spin and the framing. Driven by the single RAF loop; `delta`
   * is in seconds and `progress` is the 0..1 transition. Neither camera is
   * touched — see the note at the top of the file.
   */
  update(delta: number, progress: number, entrance: number): void
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

  /**
   * Slide the lens so the model draws `drop` frame-heights off centre.
   *
   * Ratios only, so any full size works and it survives every projection
   * update — including `resize()`'s, which keeps whatever offset is set. The
   * camera is never moved or pitched; this is the only thing written to it
   * after construction, and it is skipped when the value has not changed.
   */
  let lensAt = NaN
  function setLens(drop: number): void {
    if (Math.abs(drop - lensAt) < 1e-4) return
    lensAt = drop
    modelCamera.setViewOffset(1, 1, 0, -drop, 1, 1)
  }

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

  /** Centre height of the visible geometry — the fallback anchor, and what the figure is measured against. */
  let modelMidY = 0
  /**
   * Centre height of the **figure** in the model, and what the model is
   * actually placed by.
   *
   * `modelCamera` sits at y = 0 and never pitches, so whatever is put at y = 0
   * is what the camera is level with — and placing the model by its overall
   * visible centre put the camera well above the figure, looking down onto the
   * water and drawing its ripples as a wide ellipse. Levelling with the figure
   * is what flattens that out. Where the model then sits on *screen* is
   * LENS_DROP's job, which is why the two are separate.
   */
  let figureMidY = 0
  /** Furthest the visible geometry reaches from the spin axis, at pivot scale 1. */
  let visibleRadius = 1
  /** Half the visible geometry's vertical extent, at pivot scale 1. */
  let visibleHalfHeight = 1

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
      measureFigure(gltf.scene)
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
      visibleHalfHeight = (maxY - minY) / 2
    }
  }

  /**
   * Where the figure's own centre sits, so the camera can be levelled with it.
   * Falls back to the visible centre if the GLB ever stops naming the node.
   */
  function measureFigure(model: Object3D): void {
    const body = model.getObjectByName('body')
    figureMidY = body ? new Box3().setFromObject(body).getCenter(new Vector3()).y : modelMidY
  }

  /**
   * Pivot scale that puts the visible edge at `halfWidth` of the screen.
   * A point at radius R swinging toward a camera D away projects widest at
   * tan = R / sqrt(D² - R²), so R = D·tan / sqrt(1 + tan²). Bounded by
   * `D / visibleRadius`, which is why it is only the cap now — see FIT_HEIGHT.
   */
  function byWidth(halfWidth: number): number {
    const tan = 2 * halfWidth * TAN_HALF_FOV * modelCamera.aspect
    return (MODEL_CAMERA_DIST * tan) / Math.sqrt(1 + tan * tan) / visibleRadius
  }

  /** The model's one size: fitted by height, capped by width in portrait. */
  function fitScale(): number {
    const frameHeight = 2 * MODEL_CAMERA_DIST * TAN_HALF_FOV
    return Math.min(
      (FIT_HEIGHT * frameHeight) / (2 * visibleHalfHeight),
      byWidth(FIT_MAX_HALF_WIDTH),
    )
  }


  /** Idle spin only, accumulated over elapsed time. */
  let idleAngle = 0

  // Frame-rate independent: the angle advances by elapsed time, not per frame.
  //
  // `progress` is the paused Scene 1 -> Scene 3 transition; `entrance` is the
  // page-driven 0..1 rise into Scene 2, which is the only one of the two that
  // moves while identity is on screen.
  function update(delta: number, progress: number, entrance: number): void {
    idleAngle += SPIN_SPEED * delta

    // Each planet on its own axis, at its own rate. Accumulated over elapsed
    // time like the model's idle spin, not driven by progress: nothing here
    // has to land anywhere in particular.
    for (const planet of planets) planet.pivot.rotation.y += planet.rate * delta

    // Rise into Scene 2, eased out so it settles into place rather than
    // stopping dead. A pure function of the page, so scrolling back up sinks
    // it away again.
    const rise = 1 - Math.pow(1 - entrance, 3)
    // And how far the move into Scene 3 has carried it up the screen.
    const lift = clamp((progress - RISE_START) / (RISE_END - RISE_START), 0, 1)

    // Total spin = the idle turn + one turn as it rises into Scene 2 + exactly
    // TRANSITION_TURNS across the scroll. Both extra terms are functions of
    // position, not of elapsed time, which is what makes them land on whole
    // turns no matter how fast the page is scrolled — a time-integrated boost
    // cannot, since the total then depends on how long the user took. Negative
    // to match SPIN_SPEED, so every turn continues in the idle direction
    // instead of fighting it.
    pivot.rotation.y =
      idleAngle - Math.PI * 2 * (SCENE2_TURNS * rise + TRANSITION_TURNS * progress)

    // The composition: one size throughout, the lens carrying it from the
    // bottom of the frame in Scene 2 to the top of it in Scene 3.
    setLens(SCENE2_LENS + (SCENE3_LENS - SCENE2_LENS) * lift)

    const s = fitScale() * (RISE_SCALE_FROM + (1 - RISE_SCALE_FROM) * rise)
    pivot.visible = entrance > 0
    pivot.scale.setScalar(s)
    pivot.position.y = -RISE_DROP * (1 - rise) - (figureMidY - CAMERA_DROP) * s
  }

  function resize(nextAspect: number): void {
    for (const cam of [camera, modelCamera]) {
      cam.aspect = nextAspect
      cam.updateProjectionMatrix()
    }
  }

  return { scene, camera, modelCamera, update, resize }
}
