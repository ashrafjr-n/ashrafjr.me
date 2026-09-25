/**
 * The Three.js scene: the sky with its cloud ring (`three/sky.ts`), seen through
 * one camera that the scroll flies.
 *
 * **The journey** is one value, `p` (0..1), and every target below is a pure
 * function of it, so scrolling back up rewinds all of it. The camera starts
 * over the ring at the hero's ~63° angle, turns to look straight down while
 * the ring opens around it, drops through the middle — where the statements
 * rise into the tunnel under it (`three/tunnel.ts`) — and travels down the
 * tunnel to the end of it, where PROJECTS comes in (`ui/title.ts`) and then
 * the card that opens the projects (`ui/projects.ts`).
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
 * Where the camera is once it has turned, how far the first drop takes it (to
 * the tunnel's mouth, through the ring) and how far the second: down the
 * tunnel and out past its end, so the statements leave the screen and the
 * camera arrives over PROJECTS (`ui/title.ts`).
 */
const TURNED_Y = 7
const DROP_TO_MOUTH = 8
const DROP_THROUGH = 37

/**
 * The journey's beats, as `[from, span]` of `p`, in mohitvirli.github.io's
 * order: the turn over 0..0.3, then a quick plunge, then the long stretch —
 * all **linear**, the camera's damping is what smooths them, so there is no
 * stop where one hands over to the next. PROJECTS comes into view in the
 * road's last tenth (`ui/title.ts`); only once the camera has arrived do its
 * letters move and the tile come in.
 */
const TURN = [0, 0.3] as const
const DROP_A = [0.3, 0.12] as const
const DROP_B = [0.42, 0.3] as const
const OPEN = [0.05, 0.33] as const
const CLOUDS_OUT = [0.3, 0.12] as const
const WIDEN = [0.15, 0.25] as const
/**
 * The statements do not exist until the camera is inside the ring; then all
 * three rise out of the depth into place **together**, as it comes down to
 * the tunnel's mouth.
 */
const REVEAL = [0.36, 0.1] as const
const TWIST = [0.42, 0.3] as const

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
    const drop = DROP_TO_MOUTH * range(p, ...DROP_A) + DROP_THROUGH * range(p, ...DROP_B)
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

    tunnel.update(smoother(range(p, ...REVEAL)), smoother(range(p, ...TWIST)))
    sky.update(
      delta,
      !REDUCED_MOTION.matches,
      smoother(range(p, ...OPEN)),
      1 - smoother(range(p, ...CLOUDS_OUT)),
      dark,
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
