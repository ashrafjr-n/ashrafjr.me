/**
 * Reveal window 3D layer — the projects preview as a real scene.
 *
 * The camera sits at the origin and never moves; the mouse only turns it, so
 * looking around reads as turning your head inside the space rather than
 * sliding a backdrop about. Depth is real: the stars are a particle volume
 * surrounding the viewpoint and the planets are billboards at their own
 * distances, so the parallax between them falls out of the projection instead
 * of being authored per layer.
 *
 * It is deliberately its own renderer, scene and camera, separate from the
 * site's Scene 1 starfield (`scene.ts` / `world.ts`) — the two share nothing
 * but the technique. There is still only one RAF loop in the app: `main.ts`
 * calls `update()` here only while the window is open, and the canvas is
 * otherwise left holding its last drawn frame.
 *
 * Palette: white/silver/gray only, same as the rest of the site.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from 'three'
import { rand } from '../lib/math'
import type { InputState } from '../lib/state'
import { createCircleTexture } from './sprite'

const CAMERA_FOV = 62

// --- Stars ---
/**
 * A shell of stars around the camera. The near bound keeps any single star
 * from drawing as a blob (Three sizes points as `size * 0.5 * height /
 * distance`, so a star at 40 draws ~5px and one at 200 draws ~1px), and the
 * radius is cubed on the way in so the volume fills evenly rather than
 * bunching near the inner surface.
 */
const STAR_COUNT = 4000
const STAR_NEAR = 40
const STAR_FAR = 200
const STAR_SIZE = 0.55
/** Grayscale only — dim silver up to pure white, never a tint. */
const STAR_BRIGHT_MIN = 0.55
const STAR_BRIGHT_MAX = 1
const STAR_OPACITY = 0.85

// --- Planets ---
/**
 * Each planet is a billboard at its own distance. `size` is in world units, so
 * what it covers on screen is `size / (2 * dist * tan(fov/2))` — the values
 * below run from ~17% of the frame height for the nearest down to ~4% for the
 * farthest, which is what makes them read as objects out in the space rather
 * than the foreground stickers the CSS version used.
 *
 * `yaw`/`pitch` aim each one from the camera, in radians: 0 is straight ahead,
 * positive yaw to the right, positive pitch up. Several sit outside the resting
 * frustum on purpose, so turning the view actually finds something.
 */
interface PlanetSpec {
  src: string
  dist: number
  size: number
  yaw: number
  pitch: number
  opacity: number
}
const PLANETS: PlanetSpec[] = [
  { src: 'white.png', dist: 40, size: 8, yaw: -0.36, pitch: -0.1, opacity: 1 },
  { src: 'black.png', dist: 60, size: 9, yaw: 0.34, pitch: 0.16, opacity: 0.95 },
  { src: 'four.png', dist: 85, size: 9, yaw: -0.62, pitch: 0.24, opacity: 0.8 },
  { src: 'one.png', dist: 110, size: 8, yaw: 0.12, pitch: -0.26, opacity: 0.7 },
  { src: 'two.png', dist: 140, size: 8.5, yaw: 0.66, pitch: -0.2, opacity: 0.6 },
  { src: 'three.png', dist: 170, size: 8, yaw: -0.06, pitch: 0.3, opacity: 0.5 },
]

// --- Look-around ---
/**
 * Widest turn from centre, in radians: ~17° across, ~2° up and down. The two
 * are deliberately lopsided — the left/right turn is the pronounced move and
 * the vertical one is only a hint of weight, so the horizon stays put while
 * the view sweeps sideways. Keep the pitch a small fraction of the yaw.
 */
const MAX_YAW = 0.3
const MAX_PITCH = 0.04
/**
 * The turn is sprung, not lerped: the camera carries angular velocity, so it
 * trails a fast pointer, coasts on after it stops and settles over about a
 * second. Just under critical damping — a soft overshoot, no visible bounce.
 * That weight is the whole feel; a tighter chase reads as a cursor-locked
 * gimmick. Per-frame, like the site's other smoothing.
 */
const SPRING_STIFFNESS = 0.018
const SPRING_DAMPING = 0.82
/** Below this much movement in radians there is nothing new to draw. */
const REST_EPSILON = 0.00002

export interface RevealScene {
  /** Advance the look-around and draw. Called only while the window is open. */
  update(state: InputState): void
  /** Open/close. Closing recentres the view and leaves one still frame drawn. */
  setActive(active: boolean): void
  resize(): void
}

/** A star volume surrounding the camera, drawn as one Points. */
function createStars(): Points {
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const c = new Color()

  for (let i = 0; i < STAR_COUNT; i++) {
    const i3 = i * 3
    // Uniform direction on the sphere, then a cube-rooted radius so the density
    // per unit volume is even instead of piling up at the inner radius.
    const u = Math.random() * 2 - 1
    const theta = Math.random() * Math.PI * 2
    const planar = Math.sqrt(1 - u * u)
    const t = Math.random()
    const radius = Math.cbrt(STAR_NEAR ** 3 + t * (STAR_FAR ** 3 - STAR_NEAR ** 3))

    positions[i3] = Math.cos(theta) * planar * radius
    positions[i3 + 1] = u * radius
    positions[i3 + 2] = Math.sin(theta) * planar * radius

    const v = rand(STAR_BRIGHT_MIN, STAR_BRIGHT_MAX)
    c.setRGB(v, v, v)
    colors[i3] = c.r
    colors[i3 + 1] = c.g
    colors[i3 + 2] = c.b
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))

  const material = new PointsMaterial({
    size: STAR_SIZE,
    sizeAttenuation: true,
    map: createCircleTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    opacity: STAR_OPACITY,
  })

  return new Points(geometry, material)
}

export function createRevealScene(canvas: HTMLCanvasElement): RevealScene {
  // Opaque: this canvas covers the whole viewport when the window is open and
  // has to hide the Scene 1 canvas behind it, not composite over it.
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.setClearColor(0x000000, 1)

  const scene = new Scene()
  const camera = new PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    500,
  )
  // Fixed at the origin for good: the mouse turns this camera, it never moves
  // it. YXZ keeps yaw and pitch independent, so the horizon cannot roll.
  camera.position.set(0, 0, 0)
  camera.rotation.order = 'YXZ'

  scene.add(createStars())

  const loader = new TextureLoader()
  for (const spec of PLANETS) {
    const material = new SpriteMaterial({
      transparent: true,
      depthWrite: false,
      opacity: spec.opacity,
    })
    const sprite = new Sprite(material)
    const cosPitch = Math.cos(spec.pitch)
    sprite.position.set(
      Math.sin(spec.yaw) * cosPitch * spec.dist,
      Math.sin(spec.pitch) * spec.dist,
      -Math.cos(spec.yaw) * cosPitch * spec.dist,
    )
    sprite.scale.set(spec.size, spec.size, 1)
    scene.add(sprite)

    loader.load(`/assets/projects/${spec.src}`, (texture) => {
      texture.colorSpace = SRGBColorSpace
      material.map = texture
      material.needsUpdate = true
      // Height is the given size; width follows the artwork's own aspect.
      const { width, height } = texture.image as { width: number; height: number }
      sprite.scale.set(spec.size * (width / height), spec.size, 1)
      render() // the frame on screen predates this texture
    })
  }

  let yaw = 0
  let pitch = 0
  let yawVel = 0
  let pitchVel = 0
  let active = false

  function render(): void {
    renderer.render(scene, camera)
  }

  function update(state: InputState): void {
    if (!active) return

    // Turn toward the pointer: mouse right looks right, which swings the space
    // itself the other way. Sprung, so the view lags and settles.
    const targetYaw = -state.mouseX * MAX_YAW
    const targetPitch = -state.mouseY * MAX_PITCH
    yawVel = (yawVel + (targetYaw - yaw) * SPRING_STIFFNESS) * SPRING_DAMPING
    pitchVel = (pitchVel + (targetPitch - pitch) * SPRING_STIFFNESS) * SPRING_DAMPING

    // Nothing has moved enough to redraw — the canvas already holds this frame.
    if (Math.abs(yawVel) < REST_EPSILON && Math.abs(pitchVel) < REST_EPSILON) return

    yaw += yawVel
    pitch += pitchVel
    camera.rotation.set(pitch, yaw, 0)
    render()
  }

  function setActive(next: boolean): void {
    active = next
    if (next) return
    // Closed: recentre and leave one still frame behind, which is what the
    // small card shows until it is opened again.
    yaw = 0
    pitch = 0
    yawVel = 0
    pitchVel = 0
    camera.rotation.set(0, 0, 0)
    render()
  }

  function resize(): void {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    render()
  }

  render() // the still frame the closed card shows before it is ever opened
  return { update, setActive, resize }
}
