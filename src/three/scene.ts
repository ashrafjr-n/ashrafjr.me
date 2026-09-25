/**
 * The Three.js scene: the sky with its cloud ring (`three/sky.ts`), seen through
 * one camera that the scroll flies.
 *
 * **The journey** is one value, `p` (0..1): the scroll run through maath's
 * `damp` with drei `ScrollControls`' settings (`damping` 0.4, `maxSpeed` 1),
 * as on mohitvirli.github.io. Everything in the 3D is then placed off **one**
 * chase of it (`flight`, λ 7) — the camera's position, its turn, the ring,
 * the fov and the tunnel's twist together — so no part of the view can lag
 * behind another on a fast scroll. (The camera's position and turn were once
 * chased separately, at λ 7 and 5, and the ring not at all; on a quick scroll
 * they came apart and the view lurched.)
 *
 * The camera starts over the ring at the hero's ~63° angle and turns to look
 * straight down while the ring opens. Then it **approaches** the statements'
 * tunnel below (`three/tunnel.ts`): an eased fall that starts from rest and
 * reaches the tunnel's mouth at exactly the speed it then keeps through the
 * tunnel, so there is neither a stop nor a jump at the mouth. The ring comes
 * down with it, a little slower, widening round the tunnel until it slips
 * past the edges of the frame, and fades as the camera reaches it. Through
 * the tunnel and out past its end, PROJECTS comes in (`ui/title.ts`) and then
 * the tile that opens the projects (`ui/projects.ts`).
 *
 * Beats are placed in **screens of scroll** (`lib/journey.ts`).
 */
import { Matrix4, PerspectiveCamera, Quaternion, Vector3, WebGLRenderer } from 'three'
import { at, beat, JOURNEY_SCREENS, MOUTH_AT } from '../lib/journey'
import { clamp, damp, range, smoother } from '../lib/math'
import type { InputState } from '../lib/state'
import { createSky } from './sky'
import { createTunnel, TUNNEL_TOP } from './tunnel'

/** The hero's vantage: above the ring, looking down at it at ~63°. */
const HERO_POS = new Vector3(0, 9.3, 4.6)
const HERO_TARGET = new Vector3(0, 0.25, 0)
const HERO_FOV = 35
/** Straight down at the end of the turn, with the old "into the screen" as screen-up. */
const DIVE_FOV = 62
/** Where the camera is once it has turned. */
const TURNED_Y = 7
/**
 * The camera's speed down the tunnel, units per screen of scroll — the pace
 * the stretch from the mouth on was approved at — and how far past the mouth
 * it goes: the tunnel's length and a little more, so it ends just clear of it.
 */
const THROUGH_SPEED = 59.5
const THROUGH_DEPTH = 33.3
/**
 * The ring comes down at this share of the camera's fall, so the camera
 * catches it exactly at the tunnel's mouth.
 */
const SINK = TUNNEL_TOP / (TUNNEL_TOP - TURNED_Y)
/** The ring fades as the camera closes on it: gone at `RING_GONE`, whole at `RING_WHOLE` units. */
const RING_GONE = 0.8
const RING_WHOLE = 3

/** The beats, in screens of scroll. */
const TURN = beat(0, 0.6)
const APPROACH = beat(0.6, MOUTH_AT - 0.6)
const OPEN = beat(0.1, 0.4)
/**
 * The lens widens into the tunnel's, just before the mouth: there the camera's
 * approach grows the tunnel far faster than the widening shrinks it. Widened
 * during the turn, it visibly shrank the far-off tunnel before it grew.
 */
const WIDEN = beat(MOUTH_AT - 0.45, 0.45)
const TWIST = beat(MOUTH_AT - 0.16, 0.72)
/** How long the approach takes, in screens. */
const APPROACH_SPAN = MOUTH_AT - 0.6

/**
 * The camera's height, given how far through the turn and the approach it is
 * (0..1 each) and how many screens past the mouth: after the turn, a cubic
 * Hermite from rest at `TURNED_Y` to the mouth, arriving at `THROUGH_SPEED`;
 * then straight on at that speed to `THROUGH_DEPTH` past the mouth.
 */
function cameraY(turn: number, u: number, screensPast: number): number {
  const fall = TURNED_Y - TUNNEL_TOP
  // End slope, in units of the whole fall per unit of `u`.
  const r = (THROUGH_SPEED * APPROACH_SPAN) / fall
  const eased = -2 * u * u * u + 3 * u * u + r * (u * u * u - u * u)
  const y = HERO_POS.y + (TURNED_Y - HERO_POS.y) * turn - fall * eased
  return y - Math.min(THROUGH_DEPTH, THROUGH_SPEED * Math.max(0, screensPast))
}

/** drei `ScrollControls` on mohitvirli.github.io: `damping={0.4} maxSpeed={1}`, default eps. */
const SCROLL_DAMPING = 0.4
const SCROLL_MAX_SPEED = 1
const SCROLL_EPS = 0.00001
/** The one chase the whole view is placed off, λ. */
const FLIGHT_LAMBDA = 7

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
  camera.position.copy(HERO_POS)

  const sky = createSky(camera)
  sky.setScale(ringScale(camera.aspect))
  const tunnel = createTunnel()
  sky.scene.add(tunnel.group)

  let prevTime = performance.now()
  const scroll = { value: 0, velocity: 0 }
  let flight = 0
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
    flight = still ? p : flight + (p - flight) * (1 - Math.exp(-FLIGHT_LAMBDA * delta))
    if (Math.abs(p - flight) < 1e-6) flight = p
    const f = flight

    // --- The camera: turn to look down, approach, and on through ---
    const turn = smoother(range(f, ...TURN))
    const approach = range(f, ...APPROACH)
    const y = cameraY(turn, approach, (f - at(MOUTH_AT)) * JOURNEY_SCREENS)
    camera.position.set(0, y, HERO_POS.z * (1 - turn))
    camera.quaternion.slerpQuaternions(heroTurn, downTurn, turn)

    // A few degrees toward the pointer, on top of the flight. Not in the hero:
    // it comes in with the turn, so the opening frame stays exactly as it was.
    yaw += (-state.mouseX * LOOK * turn - yaw) * LOOK_LERP
    pitch += (-state.mouseY * LOOK * turn - pitch) * LOOK_LERP
    camera.quaternion.multiply(look.setFromAxisAngle(lookAxis.set(0, 1, 0), yaw))
    camera.quaternion.multiply(look.setFromAxisAngle(lookAxis.set(1, 0, 0), pitch))

    const fov = HERO_FOV + (DIVE_FOV - HERO_FOV) * smoother(range(f, ...WIDEN))
    if (fov !== camera.fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // The ring follows the camera's own height, so the two can never part.
    const sink = Math.max(0, TURNED_Y - y) * SINK
    const gap = y + sink
    tunnel.update(smoother(range(f, ...TWIST)))
    sky.update(
      delta,
      !REDUCED_MOTION.matches,
      smoother(range(f, ...OPEN)),
      smoother(clamp((gap - RING_GONE) / (RING_WHOLE - RING_GONE), 0, 1)),
      dark,
      sink,
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
