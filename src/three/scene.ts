/**
 * The Three.js scene: the sky with its cloud ring (`three/sky.ts`), seen through
 * one camera that the scroll flies.
 *
 * **The journey** is one value, `p` (0..1), and every target below is a pure
 * function of it, so scrolling back up rewinds all of it. The camera starts
 * over the ring at the hero's ~63° angle, turns to look straight down while
 * the ring opens around it, and falls through the middle toward the
 * statements' tunnel far below (`three/tunnel.ts`), through it and out past
 * its end, where PROJECTS comes in (`ui/title.ts`) and then the tile that
 * opens the projects (`ui/projects.ts`).
 *
 * **The scroll feels like mohitvirli.github.io's, by construction**: `p` is
 * the scroll run through maath's `damp` with drei `ScrollControls`' settings
 * there (`damping` 0.4, `maxSpeed` 1), and the camera then chases its target
 * with that site's own damping (λ 7 for position, 5 for the turn).
 */
import { Matrix4, PerspectiveCamera, Quaternion, Vector3, WebGLRenderer } from 'three'
import { damp, range, smoother } from '../lib/math'
import type { InputState } from '../lib/state'
import { createSky } from './sky'
import { createTunnel } from './tunnel'

/** The hero's vantage: above the ring, looking down at it at ~63°. */
const HERO_POS = new Vector3(0, 9.3, 4.6)
const HERO_TARGET = new Vector3(0, 0.25, 0)
const HERO_FOV = 35
/** Straight down at the end of the turn, with the old "into the screen" as screen-up. */
const DIVE_FOV = 62
/**
 * Where the camera is once it has turned, and how far it then drops: one
 * straight fall down to the statements' tunnel far below (`three/tunnel.ts`,
 * its mouth at y −78.7), through it and out past its end. Solved against the
 * live reference so the camera enters the tunnel at p ≈ 0.66 and leaves it at
 * ≈ 0.79, as it enters and leaves that site's text.
 */
const TURNED_Y = 7
const DROP_DEPTH = 119
/**
 * The cloud ring comes down with the camera, a little slower, so — like the
 * clouds all the way down on the reference — it stays around the far-off
 * tunnel as the camera falls, and the camera passes through it right at the
 * tunnel's mouth (`7 / (1 - SINK)` of the drop, ≈ 86 units).
 */
const SINK = 0.918

/**
 * The journey's beats, as `[from, span]` of `p` — drei's `range(from,
 * distance)` — on mohitvirli.github.io's own schedule, measured off the live
 * site: the turn over `range(0, 0.3)`, the fall over `range(0.3, 0.5)` (0.3 to
 * **0.8**), both linear and smoothed only by the camera's damping. The tunnel
 * is in view from the moment the camera looks down — small, far off in the
 * middle of the screen, as that site's window is — and grows as the camera
 * comes to it; the camera is inside it by ~0.6 and past it by ~0.78, the
 * tunnel turning a quarter meanwhile (`range(0.65, 0.15)` there). PROJECTS
 * follows (`ui/title.ts`).
 */
const TURN = [0, 0.3] as const
const DROP = [0.3, 0.5] as const
const OPEN = [0.05, 0.3] as const
const CLOUDS_OUT = [0.62, 0.05] as const
const WIDEN = [0.15, 0.25] as const
const TWIST = [0.62, 0.18] as const

/** drei `ScrollControls` on mohitvirli.github.io: `damping={0.4} maxSpeed={1}`, default eps. */
const SCROLL_DAMPING = 0.4
const SCROLL_MAX_SPEED = 1
const SCROLL_EPS = 0.00001
/** That site's camera damping (`THREE.MathUtils.damp` λ): position, and the turn. */
const MOVE_LAMBDA = 7
const TURN_LAMBDA = 5

/** How far the pointer turns the view at the screen's edges, radians. */
const LOOK = Math.PI / 90
const LOOK_LERP = 0.05

/**
 * The ring spans this much of the width on a narrow screen (more on a phone),
 * and never more than its full size. `RING_NDC_PER_UNIT` is the ring's
 * half-width in NDC, times aspect, per unit of radius, off the hero camera.
 */
const RING_FIT_WIDTH = 0.88
const RING_FIT_WIDTH_PHONE = 1.1
const RING_NDC_PER_UNIT = 0.34
const RING_OUTER = 2.92
const PHONE = window.matchMedia('(max-width: 767.98px)')
function ringScale(aspect: number): number {
  const fit = PHONE.matches ? RING_FIT_WIDTH_PHONE : RING_FIT_WIDTH
  return Math.min(1, (fit * aspect) / (RING_NDC_PER_UNIT * RING_OUTER))
}

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

export interface SceneController {
  /**
   * Advances and renders a frame. `dark` is how far into the dark theme the
   * sky is (`ui/theme.ts`). Returns the journey's smoothed `p`.
   */
  update(time: number, state: InputState, dark: number): number
  resize(): void
}

/** A camera orientation looking from `eye` toward `target`, with `up` as screen-up. */
function orientation(eye: Vector3, target: Vector3, up: Vector3): Quaternion {
  return new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(eye, target, up))
}

export function initScene(canvas: HTMLCanvasElement): SceneController {
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)

  const camera = new PerspectiveCamera(HERO_FOV, window.innerWidth / window.innerHeight, 0.1, 400)
  const heroTurn = orientation(HERO_POS, HERO_TARGET, new Vector3(0, 1, 0))
  const downTurn = orientation(new Vector3(), new Vector3(0, -1, 0), new Vector3(0, 0, -1))
  const look = new Quaternion()
  const lookAxis = new Vector3()
  const goal = new Vector3().copy(HERO_POS)
  const goalTurn = new Quaternion().copy(heroTurn)
  const facing = new Quaternion().copy(heroTurn)
  camera.position.copy(HERO_POS)

  const sky = createSky(camera)
  sky.setScale(ringScale(camera.aspect))
  const tunnel = createTunnel()
  sky.scene.add(tunnel.group)

  let prevTime = performance.now()
  const scroll = { value: 0, velocity: 0 }
  let yaw = 0
  let pitch = 0

  function update(time: number, state: InputState, dark: number): number {
    const delta = Math.min((time - prevTime) / 1000, 0.1) // clamp big tab-switch gaps
    prevTime = time

    const still = REDUCED_MOTION.matches || delta <= 0
    if (still) {
      scroll.value = state.scroll
      scroll.velocity = 0
    } else {
      damp(scroll, state.scroll, SCROLL_DAMPING, delta, SCROLL_MAX_SPEED, SCROLL_EPS)
    }
    const p = scroll.value

    // --- The camera: turn to look down, then dive. Targets off `p`, chased. ---
    const turn = range(p, ...TURN)
    const drop = DROP_DEPTH * range(p, ...DROP)
    goal.set(0, HERO_POS.y + (TURNED_Y - HERO_POS.y) * turn - drop, HERO_POS.z * (1 - turn))
    goalTurn.slerpQuaternions(heroTurn, downTurn, turn)
    if (still) {
      camera.position.copy(goal)
      facing.copy(goalTurn)
    } else {
      camera.position.lerp(goal, 1 - Math.exp(-MOVE_LAMBDA * delta))
      facing.slerp(goalTurn, 1 - Math.exp(-TURN_LAMBDA * delta))
    }
    camera.quaternion.copy(facing)

    // A few degrees toward the pointer, on top of the flight. Not in the hero:
    // it comes in with the turn, so the opening frame stays exactly as it was.
    yaw += (-state.mouseX * LOOK * turn - yaw) * LOOK_LERP
    pitch += (-state.mouseY * LOOK * turn - pitch) * LOOK_LERP
    camera.quaternion.multiply(look.setFromAxisAngle(lookAxis.set(0, 1, 0), yaw))
    camera.quaternion.multiply(look.setFromAxisAngle(lookAxis.set(1, 0, 0), pitch))

    const fov = HERO_FOV + (DIVE_FOV - HERO_FOV) * smoother(range(p, ...WIDEN))
    if (fov !== camera.fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    tunnel.update(smoother(range(p, ...TWIST)))
    sky.update(
      delta,
      !REDUCED_MOTION.matches,
      smoother(range(p, ...OPEN)),
      1 - smoother(range(p, ...CLOUDS_OUT)),
      dark,
      drop * SINK,
    )
    renderer.render(sky.scene, camera)
    return p
  }

  function resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    sky.setScale(ringScale(camera.aspect))
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
  }

  return { update, resize }
}
