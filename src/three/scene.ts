/**
 * The Three.js scene: the sky with its cloud ring (`three/sky.ts`), seen through
 * one camera that the scroll flies.
 *
 * **The journey** is one value, `p` (0..1), a spring over the page's scroll,
 * and every move below is a pure function of it — so scrolling back up
 * rewinds all of it exactly. The camera starts over the ring at the hero's
 * ~63° angle, turns to look straight down while the ring opens around it,
 * and dives through the middle.
 */
import { Matrix4, PerspectiveCamera, Quaternion, Vector3, WebGLRenderer } from 'three'
import { clamp, range, smoother } from '../lib/math'
import type { InputState } from '../lib/state'
import { createSky } from './sky'

/** The hero's vantage: above the ring, looking down at it at ~63°. */
const HERO_POS = new Vector3(0, 9.3, 4.6)
const HERO_TARGET = new Vector3(0, 0.25, 0)
const HERO_FOV = 35
/** Straight down at the end of the turn, with the old "into the screen" as screen-up. */
const DIVE_FOV = 62
/** Where the camera is once it has turned, and how far down the dive takes it. */
const TURNED_Y = 7
const DIVE_DEPTH = 40

/**
 * The journey's beats, as `[from, span]` of `p`. They overlap on purpose, so
 * one move is still finishing as the next starts and the camera never stops.
 */
const TURN = [0, 0.3] as const
const OPEN = [0.04, 0.4] as const
const CLOUDS_OUT = [0.3, 0.14] as const
const WIDEN = [0.15, 0.35] as const
const DIVE = [0.2, 0.8] as const

/**
 * The spring `p` follows the scroll on, rad/s: ~0.25s of lag, enough to turn
 * a wheel's notches into one flight. It takes its own step so a long frame
 * cannot destabilise it.
 */
const OMEGA = 8
const MAX_STEP = 1 / 60

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
  /** Advances and renders a frame. Returns the journey's smoothed `p`. */
  update(time: number, state: InputState): number
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

  const sky = createSky(camera)
  sky.setScale(ringScale(camera.aspect))

  let prevTime = performance.now()
  let p = 0
  let vel = 0
  let yaw = 0
  let pitch = 0

  function update(time: number, state: InputState): number {
    const delta = Math.min((time - prevTime) / 1000, 0.1) // clamp big tab-switch gaps
    prevTime = time

    if (REDUCED_MOTION.matches) {
      p = state.scroll
      vel = 0
    } else {
      for (let left = delta; left > 0; left -= MAX_STEP) {
        const h = left < MAX_STEP ? left : MAX_STEP
        vel += (OMEGA * OMEGA * (state.scroll - p) - 2 * OMEGA * vel) * h
        p += vel * h
      }
      p = clamp(p, 0, 1)
    }

    // --- The camera: turn to look down, then dive ---
    const turn = smoother(range(p, ...TURN))
    const dive = smoother(range(p, ...DIVE))
    camera.position.set(
      0,
      HERO_POS.y + (TURNED_Y - HERO_POS.y) * turn - DIVE_DEPTH * dive,
      HERO_POS.z * (1 - turn),
    )
    camera.quaternion.slerpQuaternions(heroTurn, downTurn, turn)

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

    sky.update(
      delta,
      !REDUCED_MOTION.matches,
      smoother(range(p, ...OPEN)),
      1 - smoother(range(p, ...CLOUDS_OUT)),
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
