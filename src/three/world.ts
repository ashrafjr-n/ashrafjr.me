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
 * Desktop/tablet-only Scene 2 recomposition. The eye now sits at the *same*
 * height as the target — pitch = atan((0.3 - 0.3) / 4.3) = 0°, dead level —
 * rather than above it, so there is no look-down left at all.
 *
 * It went 13° (eye at 1.3) → 6.6° (eye at 0.8) → 3.3° (eye at 0.55) across
 * earlier passes, chasing the near-flat sweep lines moulded into the model's
 * own black base slab: they read the same way ripples in sand do, legible
 * from a steeper, more overhead angle and compressing toward invisible
 * edge-on. 3.3° still weren't edge-on enough — the ripples were still
 * legible and still read as curved rather than flat — so this pass drops the
 * angle the rest of the way to exactly level, which is also what makes any
 * remaining trace of them project as flat horizontal bands rather than
 * curved ones (a level camera on the model's own x=0 axis sees a
 * radially-symmetric ripple's iso-height contours edge-on and flat, where
 * any pitch skews them). The base-slab visibility itself is now finished by
 * SCENE2_BOTTOM_NDC below, which pushes the ring — and everything at or
 * beyond its radius, which the base slab's visible margin is — past the
 * frame's bottom edge outright, so what's left of the pitch is no longer
 * doing that job alone.
 *
 * A shallower camera also sees the ring plane more edge-on, so the diorama
 * covers less of the frame's height at the same scale — that is what has
 * paid for MODEL_SCALE_DESKTOP growing across these same passes without
 * eating into the row's band above it.
 *
 * These two are the *angle* only. The whole rig is then lifted by
 * solveBottomRise() below — the same amount added to both the eye and the
 * target, so the 0° pitch is untouched and the model simply slides down the
 * frame until it rests on (now past) its bottom edge. Paired with
 * style.css's `min-width: 768px` block, which puts the
 * portrait/PROJECTS/SYSTEM row in the space the model leaves above it.
 *
 * Gated on the same 767.98px breakpoint as the rest of the site (see MOBILE
 * below) — mobile keeps the level, centred framing above completely
 * untouched.
 */
const SCENE2_CAMERA_POS_WIDE = { x: 0, y: 0.3, z: 4.3 }
const SCENE2_CAMERA_TARGET_WIDE = { x: 0, y: 0.3, z: 0 }

/**
 * Desktop/tablet only: how large the model runs by Scene 2. It stays centred
 * on x (the pivot is never moved off the origin) and is dropped to the bottom
 * edge of the frame by the camera rise below, so the whole diorama reads as
 * one large object anchored to the foot of the viewport with the Scene 2 row
 * above it.
 *
 * Applied to the pivot Group, not to the model's own fitted scale from
 * fitModel() — the pivot's local origin already sits on the model's
 * ground-centre point, so scaling it in place doesn't lift the model off
 * y = 0 or shift its x/z centre, and uniform scale commutes with the Y-axis
 * spin.
 *
 * Two tiers, for the same reason the rest of the site has three bands:
 * desktop (min-width: 900px, the boundary style.css's own desktop block uses)
 * gets the larger model, tablets (768–899.98px) the smaller one, since a tall
 * tablet portrait sees barely over half the horizontal span a 16:10 desktop
 * does at CAMERA_FOV 35.
 *
 * **What caps the desktop tier is the Scene 2 row, not the frame**, and it is
 * worth knowing which part of the model does the touching. The diorama's
 * *solid* mass — the white ring plane, the planets, the figure — stops just
 * under the portrait's box, with a thin sliver of clear black between them.
 * The model's own **particle cloud reaches much higher and deliberately
 * shares the band with the row** — it is loose white dots, the page's
 * starfield already lies behind the portrait, and holding the cloud below the
 * row instead would cost most of the model's on-screen size.
 *
 * (The specific vh/px/% figures this paragraph used to carry — 33.8vh,
 * 31.5vh, 76%/64% of the half-frame — are stale as of this file's camera
 * work: SCENE2_CAMERA_POS_WIDE went to dead level and SCENE2_BOTTOM_NDC was
 * pushed past 1 in the same pass, both of which move where the model's
 * visible top and bottom land. Re-measure the rendered page before trusting
 * or reintroducing numbers here.)
 *
 * Camera pitch and distance were measured as **not** levers on the model's
 * on-screen *width* — flattening the old ~6.6° pitch to 2°, or dollying the
 * eye from z 4.3 out to 6, barely moved it. That was measured before this
 * pass flattened the pitch the rest of the way to 0° and pushed
 * SCENE2_BOTTOM_NDC past the frame edge specifically to change what's
 * *vertically* visible (the base slab's wave lines) — a different axis than
 * the width claim above, but worth re-verifying together with the vh figures
 * above rather than assumed to still hold unchanged.
 *
 * MODEL_FIT_PER_ASPECT is the guard under both: measured against this rig by
 * projecting the model's own white geometry, the widest scale that keeps it
 * inside both side edges runs from `0.84 * aspect` on a tall frame down to
 * about `0.79 * aspect` around aspect 1.4, so capping at `0.74 * aspect`
 * clears the sides at any window shape — including the viewports that sit in
 * the desktop band but are portrait anyway (an iPad Pro 12.9" is 1024 x 1366,
 * where the cap holds the model to 0.55). Without it the tiers alone are only
 * correct for their band's *typical* aspect.
 *
 * The cap is not linear in aspect, so **it has to be re-checked whenever a
 * tier grows**: the cap only binds where `0.74 * aspect` falls under the
 * tier, and raising the tier extends that range into wider frames, where the
 * true limit is lower. At the old 0.95 tier a 0.80 cap was safe; at 1.1 it
 * put the widest dot 0.7% past the edge around aspect 1.40, which is what
 * brought this down to 0.74. Because the applied scale is always
 * `min(tier, cap)`, this cap stays the hard safety ceiling at every aspect
 * however far a tier is raised above it — raising a tier can only push the
 * applied scale up *to* the cap, never past it.
 */
const MODEL_SCALE_TABLET = 1.05
const MODEL_SCALE_DESKTOP = 1.32
const MODEL_FIT_PER_ASPECT = 0.74

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
 * The lowest *intended*-visible thing in the model, in fitted units (i.e.
 * after fitModel(), pivot scale 1) — the white ring plane, which used to be
 * treated as the model's true bottom edge on the assumption that the GLB's
 * black base slab beneath it was pure black on a pure black page and read as
 * nothing. That assumption turned out to be wrong: the slab carries visible
 * wave-like relief (see SCENE2_BOTTOM_NDC below), so the ring is now
 * deliberately pushed *past* the frame's bottom edge rather than rested on
 * it, taking the slab's own margin off screen with it. Measured off the GLB
 * — the ring plane sits at y 0.33 with a rim at radius 1.33; keep these in
 * step with the file if it is ever replaced.
 *
 * The radius is written as 1.35 rather than that literal 1.33, so this
 * one-point solve lands where the *whole* white silhouette actually bottoms
 * out: swept through the spin, the geometry just above and outside the rim
 * (it flares to radius 1.57 by y 1.06) comes marginally lower on screen than
 * the rim itself does, and 1.35 is the value that reproduces the real low
 * point across the scale range.
 */
const MODEL_RING_Y = 0.33
const MODEL_RING_RADIUS = 1.35

/**
 * How far down the frame that ring's near edge is put in Scene 2, as a
 * fraction of the half-height: 1 is exactly the bottom edge, so anything
 * over 1 deliberately pushes the ring — and the model's base slab, which sits
 * at the same height and beyond the ring's own radius — past the bottom edge
 * and off screen.
 *
 * Was 0.98 (a 2% sliver of clear black under the ring) until the near-flat
 * sweep lines moulded into the base slab turned out to still be legible at
 * that resting position, even once the camera pitch was flattened hard (see
 * SCENE2_CAMERA_POS_WIDE). The ring was the model's lowest *intended*-visible
 * point, but the base slab's own relief is not confined to it — anything at
 * the ring's radius or beyond projects at least as low on screen as the ring
 * does — so deliberately overshooting the ring past the frame edge is what
 * takes the slab's own margin off screen with it, rather than trying to
 * out-angle a texture that reads at any pitch shallow enough to still resemble
 * a diorama shot. 1.08 is a real, no-longer-marginal push: at desktop's
 * largest in-frame scale that lands the ring itself roughly 3-4% of the
 * half-frame past the bottom edge, not merely at it.
 */
const SCENE2_BOTTOM_NDC = 1.08

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

/**
 * How far the desktop/tablet Scene 2 rig is lifted so the model's ring lands
 * at SCENE2_BOTTOM_NDC down the frame (past the bottom edge, currently), for
 * a given pivot scale.
 *
 * Solved rather than authored, because the two ends of it move together: the
 * model's size is capped by the frame's own width (see MODEL_FIT_PER_ASPECT),
 * and a smaller model has to be met by a lower camera to stay bottom-anchored.
 *
 * The rise is added to the eye *and* the target, so the view direction — and
 * with it the shallow look-down of SCENE2_CAMERA_*_WIDE — is untouched; only
 * the height changes, which slides the whole scene down the frame.
 *
 * The point being landed is the ring plane's near edge, (0, ringY, ringR),
 * which is the model's lowest visible point from a camera on +z. Writing the
 * eye as (0, ey + rise, ez) and the view direction as d = (0, dy, dz), the
 * camera's own up axis is (0, -dz, dy) / |d|, so the vertical/depth ratio the
 * projection divides out is linear in the rise and inverts in one step.
 */
function solveBottomRise(scale: number): number {
  const dy = SCENE2_CAMERA_TARGET_WIDE.y - SCENE2_CAMERA_POS_WIDE.y
  const dz = -SCENE2_CAMERA_POS_WIDE.z
  // The half-height the point is aimed at, in tangent units.
  const t = SCENE2_BOTTOM_NDC * Math.tan((CAMERA_FOV / 2) * (Math.PI / 180))

  const pointY = MODEL_RING_Y * scale
  // The point's z relative to the eye — unaffected by the rise, which is y only.
  const b = MODEL_RING_RADIUS * scale - SCENE2_CAMERA_POS_WIDE.z
  // Its y relative to the risen eye, solved from `ndcY = -SCENE2_BOTTOM_NDC`.
  const a = (-b * (dy + t * dz)) / (t * dy - dz)

  return pointY - SCENE2_CAMERA_POS_WIDE.y - a
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

    // Desktop/tablet only: how large the model runs by Scene 2, capped by the
    // frame's own width so it never runs off the sides, and the rise that
    // drops it onto the bottom edge of that frame — which follows from
    // whatever scale the cap leaves. Both are mixed by the same progress as
    // everything else, so they arrive exactly as Scene 2 does, and both are
    // explicitly neutral on mobile rather than left alone, so a viewport
    // resized across a breakpoint mid-session can't strand the pivot
    // over-scaled or the camera off its level phone framing.
    const tier = DESKTOP.matches ? MODEL_SCALE_DESKTOP : MODEL_SCALE_TABLET
    const modelScale = Math.min(tier, MODEL_FIT_PER_ASPECT * camera.aspect)
    const rise = wide ? solveBottomRise(modelScale) : 0

    camera.position.set(
      mix(CAMERA_POS.x, scene2Pos.x, progress),
      mix(CAMERA_POS.y, scene2Pos.y + rise, progress),
      mix(CAMERA_POS.z, scene2Pos.z, progress),
    )
    camera.lookAt(
      mix(CAMERA_TARGET.x, scene2Target.x, progress),
      mix(CAMERA_TARGET.y, scene2Target.y + rise, progress),
      mix(CAMERA_TARGET.z, scene2Target.z, progress),
    )

    pivot.scale.setScalar(wide ? mix(1, modelScale, progress) : 1)
  }

  function resize(nextAspect: number): void {
    camera.aspect = nextAspect
    camera.updateProjectionMatrix()
  }

  return { scene, camera, update, resize }
}
