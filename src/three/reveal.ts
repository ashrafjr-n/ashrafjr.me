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
 * The five project cards are part of that same space. They are DOM, drawn by a
 * CSS3DRenderer stacked over this canvas and given the same camera, so they
 * turn with the stars and planets rather than floating over them — real
 * rectangles standing out in the scene, not an overlay.
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
import {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/examples/jsm/renderers/CSS3DRenderer.js'
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
  // The same white planet again, further off and half the size, out to the
  // right — one body seen twice at two depths, which is cheap parallax. It
  // shares the first one's texture (see the loader below); a file is loaded
  // once however many planets use it.
  { src: 'white.png', dist: 72, size: 5.2, yaw: 0.46, pitch: -0.16, opacity: 0.9 },
  { src: 'four.png', dist: 85, size: 9, yaw: -0.62, pitch: 0.24, opacity: 0.8 },
  { src: 'one.png', dist: 110, size: 8, yaw: 0.12, pitch: -0.26, opacity: 0.7 },
  { src: 'two.png', dist: 140, size: 8.5, yaw: 0.66, pitch: -0.2, opacity: 0.6 },
  { src: 'three.png', dist: 170, size: 8, yaw: -0.06, pitch: 0.3, opacity: 0.5 },
]

// --- Project cards ---
/**
 * The cards are DOM, drawn by a CSS3DRenderer stacked over the WebGL canvas and
 * fed the *same* camera — so they turn with the stars and the planets instead
 * of sitting on the screen.
 *
 * They stand on an **arc around the camera**, not in a flat row: each one is
 * spaced from the next by an angle rather than by an x offset, and the two ends
 * of the arc are pulled in *nearer* the camera than the middle, so the row
 * wraps slightly around the viewpoint instead of bowing away from it. That
 * gives the end cards their own depth (nearer, so larger) on top of the yaw
 * below.
 *
 * CSS3DRenderer maps one CSS pixel to one world unit, which would make a 380px
 * card 380 units wide. `CARD_SCALE` is the conversion: the card's CSS box is
 * authored at a comfortable size for type and then scaled down to the world.
 * Change the CSS box and this together, or the cards change size on screen.
 *
 * Sized against the resting frustum: the horizontal half-angle is
 * `atan(tan(fov / 2) * aspect)`, ~47° at 16:9, and the end cards reach ~45°
 * from centre — so the arc fills the frame with a little to spare and clears
 * its neighbours by a couple of degrees. Widening a card or spreading the arc
 * further runs into one or the other; check both before retuning these.
 */
const CARD_PX_W = 380
const CARD_PX_H = 180
const CARD_SCALE = 0.0125
/** Radius at the middle of the arc. The ends come in closer than this. */
const CARD_DIST = 20
/** Angle between neighbouring cards along the arc, in radians (~18°). */
const CARD_ARC_STEP = 0.32
/**
 * How much nearer the camera the two end cards sit than the middle one, in
 * world units, falling off as the square of the position along the arc. This is
 * what curves the arc *toward* the viewer at its ends.
 */
const CARD_ARC_PULL = 4.2
/**
 * How far each card is turned back toward the camera: 1 would aim it straight
 * at the viewpoint and flatten the perspective on it, 0 would leave it parallel
 * to the screen. Half-way keeps a real angle on every card — one side edge
 * nearer than the other — which is the whole point of the arc.
 */
const CARD_FACE = 0.5
/** Slightly above eye level, so the arc sits up in the frame. */
const CARD_Y = 1.2

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

/**
 * `canvas` takes the stars and planets; `cssLayer` takes the project cards,
 * which are DOM. Both are viewport-sized and share one camera, so the two
 * layers turn as one — see the .reveal-cards rule in style.css for how the
 * layer is stacked over the canvas.
 */
export function createRevealScene(
  canvas: HTMLCanvasElement,
  cssLayer: HTMLElement,
  cards: HTMLElement[],
): RevealScene {
  // Opaque: this canvas covers the whole viewport when the window is open and
  // has to hide the Scene 1 canvas behind it, not composite over it.
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.setClearColor(0x000000, 1)

  // The cards' renderer. It only writes CSS transforms, so it costs nothing per
  // frame beyond the matrices — but it must be driven from the same `render()`
  // as the WebGL pass or the two layers would drift apart mid-turn.
  const cssRenderer = new CSS3DRenderer({ element: cssLayer })
  cssRenderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new Scene()
  // A scene of its own: CSS3DObjects carry no geometry and have no business
  // being walked by the WebGL renderer.
  const cssScene = new Scene()
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

  // Planets are grouped by file, so a texture used by more than one of them is
  // fetched and uploaded once and shared — the two white planets are the same
  // body at two depths.
  const byFile = new Map<string, PlanetSpec[]>()
  for (const spec of PLANETS) {
    const group = byFile.get(spec.src)
    if (group) group.push(spec)
    else byFile.set(spec.src, [spec])
  }

  const loader = new TextureLoader()
  for (const [src, specs] of byFile) {
    const billboards = specs.map((spec) => {
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
      return { spec, sprite, material }
    })

    loader.load(`/assets/projects/${src}`, (texture) => {
      texture.colorSpace = SRGBColorSpace
      // Height is the given size; width follows the artwork's own aspect.
      const { width, height } = texture.image as { width: number; height: number }
      for (const { spec, sprite, material } of billboards) {
        material.map = texture
        material.needsUpdate = true
        sprite.scale.set(spec.size * (width / height), spec.size, 1)
      }
      render() // the frame on screen predates this texture
    })
  }

  // The cards: an arc around the camera, centred on the resting view. Each one
  // gets its own angle off straight ahead and its own radius — the ends sit
  // nearer than the middle — so the row curves toward the viewer rather than
  // lying flat across it. Each card's CSS box is shrunk by CARD_SCALE, which is
  // what turns its pixels into world units.
  const half = (cards.length - 1) / 2
  cards.forEach((el, i) => {
    el.style.width = `${CARD_PX_W}px`
    el.style.height = `${CARD_PX_H}px`

    // -1 at the left end, 0 in the middle, +1 at the right end.
    const t = (i - half) / half
    const angle = t * half * CARD_ARC_STEP
    const dist = CARD_DIST - CARD_ARC_PULL * t * t

    const object = new CSS3DObject(el)
    object.position.set(Math.sin(angle) * dist, CARD_Y, -Math.cos(angle) * dist)
    // A card facing the camera dead-on would need `-angle`; turning it only
    // CARD_FACE of the way leaves the rest as a real angle to the view, which
    // is what puts one side edge nearer (and larger) than the other.
    object.rotation.y = -angle * CARD_FACE
    object.scale.setScalar(CARD_SCALE)
    // CSS3DObject stamps `pointer-events: auto` on the element, which would
    // outrank any stylesheet rule and leave the cards clickable through a
    // closed (opacity-0) window. Cleared, so style.css alone decides.
    el.style.pointerEvents = ''
    cssScene.add(object)
  })

  let yaw = 0
  let pitch = 0
  let yawVel = 0
  let pitchVel = 0
  let active = false

  function render(): void {
    renderer.render(scene, camera)
    cssRenderer.render(cssScene, camera)
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
    // Closed: recentre and leave one still frame behind, ready for the next
    // open — the window is invisible until then.
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
    cssRenderer.setSize(window.innerWidth, window.innerHeight)
    render()
  }

  render() // the frame the window opens onto the first time
  return { update, setActive, resize }
}
