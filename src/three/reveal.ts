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

/**
 * Deliberately wide. The project cards stand on an arc that wraps around the
 * viewpoint, and a card only shows real foreshortening — one vertical edge
 * taller than the other — when it covers a decent angle of the view *and* is
 * turned. Five such cards need a field wide enough to hold them: at 62° the arc
 * either overflowed the frame or the cards had to be small enough that the
 * trapezoid collapsed to about 10%. Everything else in this scene is scaled to
 * this value (see the note on PLANETS and STAR_COUNT), so changing it means
 * re-scaling them too.
 */
const CAMERA_FOV = 80

// --- Stars ---
/**
 * A shell of stars around the camera. The near bound keeps any single star
 * from drawing as a blob (Three sizes points as `size * 0.5 * height /
 * distance`, so a star at 40 draws ~5px and one at 200 draws ~1px), and the
 * radius is cubed on the way in so the volume fills evenly rather than
 * bunching near the inner surface.
 */
/**
 * Also compensated for `CAMERA_FOV`. Three sizes points as
 * `size * 0.5 * height / distance` — no fov term — so a star keeps its pixel
 * size however wide the camera is, and widening the fov only puts *more* of
 * them on screen. The 80° frustum holds ~1.95x the solid angle the 62° one did,
 * so the count comes down by the same factor to keep the field's on-screen
 * density where it was.
 */
const STAR_COUNT = 2050
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
/**
 * Sizes and angles here are **compensated for `CAMERA_FOV`**. The fov was
 * widened from 62° for the cards' sake, which alone would have shrunk every
 * planet to ~72% and pulled them all toward the centre of a wider frame. Each
 * `size` is therefore multiplied by 1.3965 (= tan40° / tan31°) and each angle
 * re-solved as `atan(tan(old) * 1.3965)`, which puts every planet back on the
 * screen position and at the size it held before. The composition here is
 * unchanged from the 62° version on purpose; re-derive both if the fov moves.
 */
const PLANETS: PlanetSpec[] = [
  // Out to the low left, well clear of the cards. It was moved there from
  // (dist 40, yaw -0.484, pitch -0.139) — 232px left and 51px down at
  // 1536x849 — and `dist` had to go up with it to hold its drawn size. A
  // sprite is scaled by its **depth**, `cos(yaw) * cos(pitch) * dist`, not by
  // `dist`, so swinging it further off-axis at a fixed distance would have
  // drawn it bigger. 50.1 keeps the depth at the 35.06 it always had, and the
  // planet the same 162px tall it always was.
  { src: 'white.png', dist: 50.1, size: 11.2, yaw: -0.777, pitch: -0.182, opacity: 1 },
  { src: 'black.png', dist: 60, size: 12.6, yaw: 0.459, pitch: 0.222, opacity: 0.95 },
  // The same white planet again, further off and half the size, out to the
  // right — one body seen twice at two depths, which is cheap parallax. It
  // shares the first one's texture (see the loader below); a file is loaded
  // once however many planets use it.
  { src: 'white.png', dist: 72, size: 7.3, yaw: 0.606, pitch: -0.222, opacity: 0.9 },
  { src: 'four.png', dist: 85, size: 12.6, yaw: -0.784, pitch: 0.329, opacity: 0.8 },
  { src: 'one.png', dist: 110, size: 11.2, yaw: 0.167, pitch: -0.355, opacity: 0.7 },
  { src: 'two.png', dist: 140, size: 11.9, yaw: 0.825, pitch: -0.276, opacity: 0.6 },
  { src: 'three.png', dist: 170, size: 11.2, yaw: -0.084, pitch: 0.408, opacity: 0.5 },
]

// --- Project cards ---
/**
 * The cards are DOM, drawn by a CSS3DRenderer stacked over the WebGL canvas and
 * fed the *same* camera — so they turn with the stars and the planets instead
 * of sitting on the screen.
 *
 * They all stand on **one plane at `CARD_DIST`**, and the arc is in how far
 * each one is *turned*: the middle card faces straight down the view axis and
 * every card out from it is yawed to face the viewpoint, harder the further out
 * it stands. That is what makes the row read as a curve — five cards wrapping
 * around the viewer.
 *
 * **The single depth is load-bearing.** A card's on-screen size is set by its
 * depth, so an arc that really curved in depth drew its end cards half again as
 * large as its middle one and the row lost any consistent band. One depth takes
 * size out of the geometry's hands entirely, which is what lets `CARD_SIZE_TIERS`
 * below state it outright instead. It costs no foreshortening, because that
 * comes from a card's *yaw*, not from where it stands.
 *
 * CSS3DRenderer maps one CSS pixel to one world unit, which would make a 420px
 * card 420 units wide. `CARD_SCALE` is the conversion: the card's CSS box is
 * authored at a comfortable size for type and then scaled down to the world.
 * Change the CSS box and this together, or the cards change size on screen.
 *
 * The values below are solved against the projection, not eyeballed. They draw
 * the end cards' two vertical edges at a **1.41 ratio** — an obvious trapezoid —
 * the next pair at 1.24, and the middle card, whose yaw is 0, at an exact 1.000
 * rectangle. The two ends deliberately run past the frame: the row is sized for
 * the cards to be legible, not to fit, and this is a scene you look around in.
 */
const CARD_PX_W = 420
const CARD_PX_H = 230
const CARD_SCALE = 0.015
/**
 * How big each card draws, **stated rather than inherited**, as a multiplier on
 * `CARD_SCALE` — index 0 is the middle card and the list runs outward, so the
 * ends are largest, the inner pair middling and the middle card smallest. The
 * last entry covers any card further out than the list is long.
 *
 * The row is on one plane precisely so this is free to be an authored
 * hierarchy: with depth equal for all five, nothing in the projection is
 * setting their sizes and this is the whole of it. On screen it works out to
 * about 100px tall in the middle, 119px for the inner pair and 165px at the
 * ends at 1536x849.
 *
 * These feed the spacing solve as well, so changing them re-spaces the row on
 * its own — and note the solve fixes each card's *inner* edge against its
 * neighbour, so growing the outermost tier spends the growth outward and leaves
 * the other three exactly where they were. What it does not adjust for is the
 * reach (see `CARD_GAP_PX`). A bigger card also carries a stronger trapezoid at
 * the same yaw, since its two edges spread further apart in depth: the ends run
 * ~1.53 at 1.26 against ~1.47 at the 1.15 they were.
 */
const CARD_SIZE_TIERS = [0.8, 0.95, 1.26]
/** Depth of the plane every card stands on. */
const CARD_DIST = 14
/**
 * The space between neighbours **as it lands on screen**, in the card's own
 * authoring pixels. It is not an x offset: the row is solved outward from the
 * middle so that every neighbouring pair leaves exactly this gap after the
 * projection, which is the only way to get an even row out of cards that
 * project wider the further off-axis they stand (the end pair covers ~352px
 * against the middle card's ~228px at 1536x849).
 *
 * Spacing the cards evenly in *angle* instead spread the outer gaps to ~2.3x
 * the inner ones, and spacing them evenly in *x* did the same the other way.
 * Neither is the same thing as an even row; this is.
 *
 * It is also the knob that sets how far the row overruns the frame, since the
 * cards' own size is fixed: at this value the outer corners clear the window's
 * hairline by ~22px at 16:10 and ~36px at 16:9, and the end cards' VIEW button
 * — which sits right on that outer edge — stays whole down to about a 1.81
 * aspect. Widening the gap pushes both out together; it was 59 briefly and
 * took 25px off that button.
 */
const CARD_GAP_PX = 45
/**
 * How far each card is turned back toward the camera: 1 aims it straight at the
 * viewpoint, 0 leaves it parallel to the screen.
 *
 * **1 is what maximises the foreshortening, not what removes it**, and getting
 * that backwards is what made the row read as five rotated rectangles. The
 * projection is onto a *plane*, so a card's on-screen size is set by its depth
 * (its -z), not by its distance from the camera. Turning a card to face the
 * camera equalises its two edges' distances but pushes them to very different
 * depths: the spread works out to `w * sin(yaw)`. At 0 the card lies parallel
 * to the image plane, both edges share one depth and it projects as a perfect
 * rectangle however far off-axis it sits; at 1 the spread is widest and the
 * trapezoid strongest. Since the middle card's yaw is 0 it stays an undistorted
 * rectangle either way, and the distortion grows out along the row.
 */
const CARD_FACE = 1
/**
 * The line the row is **centred on**, in screen terms rather than world units:
 * the tangent of the angle above the view axis. Every card's own centre is put
 * at `CARD_RISE * CARD_DIST`, and since they all share one depth, that lands
 * all five centres on exactly the same horizontal line on screen — the size
 * difference from `CARD_SIZE_TIERS` splits evenly above and below it.
 *
 * Cards were briefly hung from their feet instead, off a shared floor, so the
 * whole size difference went upward and the row's bottom edge stayed straight.
 * Centring is what was wanted: no card leads the line, they just reach further
 * from it. Note that a card's *bounding box* still is not centred on that line
 * — the trapezoid magnifies its near edge, and the row sits above the view
 * axis, so the near edge gains more above than below. The card's centre is on
 * the line; its bbox midpoint drifts a few px, and that is the projection, not
 * a placement bug.
 */
const CARD_RISE = 0.107
/**
 * How far each rank sits **below** that line, in the same screen (tangent)
 * terms — index 0 is the middle card and the list runs outward, matching
 * `CARD_SIZE_TIERS`. The two ends hold the line at 0, the inner pair is let
 * down ~12px at 1536x849 and the middle card ~19px.
 *
 * This is the one thing that is deliberately *not* on the shared centre: the
 * row reads better with the smaller cards sitting lower, further the smaller
 * they get, which also brings the five bottom edges closer together
 * (455 / 443 / 439 rather than 446 / 430 / 420) without going back to hanging
 * the whole row off a floor. Keep the outermost entry at 0 — it is what the
 * rest are measured against.
 */
const CARD_DROP_TIERS = [0.038, 0.024, 0]

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

/** Half the card's authored width, the offset both of its edges sit at. */
const CARD_HALF_PX = CARD_PX_W / 2

/** How big the card `rank` places out from the middle draws. */
function scaleForRank(rank: number): number {
  return CARD_SCALE * CARD_SIZE_TIERS[Math.min(rank, CARD_SIZE_TIERS.length - 1)]
}

/** The world height that rank's centre sits at, off the row's centre line. */
function heightForRank(rank: number): number {
  const drop = CARD_DROP_TIERS[Math.min(rank, CARD_DROP_TIERS.length - 1)]
  return (CARD_RISE - drop) * CARD_DIST
}

/**
 * Where one vertical edge of a card lands on screen, in tangent units — the
 * `x / depth` the projection leaves behind, before the frame's own width turns
 * it into pixels.
 *
 * `halfPx` is the edge's offset in the card's own pixels: `+CARD_HALF_PX` for
 * the outer edge, `-CARD_HALF_PX` for the inner one. Because the card is yawed,
 * its two edges sit at different depths, and that is exactly the term that
 * makes an off-axis card project wider than a face-on one.
 */
function edgeTan(centre: number, halfPx: number, scale: number): number {
  const yaw = Math.atan(centre / CARD_DIST) * CARD_FACE
  const offset = halfPx * scale
  return (
    (centre + offset * Math.cos(yaw)) / (CARD_DIST - offset * Math.sin(yaw))
  )
}

/**
 * The world x at which a card of this size has its inner edge land on `target`.
 *
 * There is no closed form worth writing here — the yaw depends on the position
 * it is solving for — but `edgeTan` climbs monotonically with the centre, so a
 * bisection walks straight to it. It runs a handful of times at startup and
 * never again.
 */
function centreForInnerEdge(target: number, scale: number): number {
  let low = 0
  let high = CARD_DIST * 8
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    if (edgeTan(mid, -CARD_HALF_PX, scale) < target) low = mid
    else high = mid
  }
  return (low + high) / 2
}

/**
 * The right-hand half of the row, as world x offsets from the middle outward —
 * index 0 is the centremost card, and the left half is its mirror.
 *
 * Each card is placed where the one before it leaves `CARD_GAP_PX` of screen,
 * so the row comes out evenly spaced *as drawn* rather than evenly spaced in
 * some quantity that the projection then stretches. Both cards' own sizes go
 * into that, which is what keeps the gaps even under `CARD_SIZE_TIERS`. An odd
 * count puts a card on the axis; an even one straddles it, sharing the gap.
 */
function solveRowCentres(count: number): number[] {
  const gap = (CARD_GAP_PX * CARD_SCALE) / CARD_DIST
  const centres = [
    count % 2 === 1 ? 0 : centreForInnerEdge(gap / 2, scaleForRank(0)),
  ]
  while (centres.length < Math.ceil(count / 2)) {
    const rank = centres.length
    const outerEdge = edgeTan(
      centres[rank - 1],
      CARD_HALF_PX,
      scaleForRank(rank - 1),
    )
    centres.push(centreForInnerEdge(outerEdge + gap, scaleForRank(rank)))
  }
  return centres
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
  raisedLayer: HTMLElement,
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

  /**
   * A second cards layer, holding only the one card that is currently raised.
   *
   * **This is the whole of the stacking rule, and it has to be a separate layer.**
   * CSS3DRenderer puts every card in one `preserve-3d` element, which makes them
   * a 3D rendering context — and there the browser paints by *depth*, not by
   * document order and not by `z-index`. Both were measured: reordering the
   * hovered card last and giving it `z-index: 10` each left it behind its
   * neighbour, because a turned card's inner edge lies several units further
   * back than the card beside it. `translateZ` does win, but only at a distance
   * that draws the card 60% larger.
   *
   * A layer of its own is a 3D context of its own, so it cannot be sorted
   * against the row at all — it simply paints after it, and the card keeps its
   * exact geometry because this renders off the same camera.
   */
  const raisedRenderer = new CSS3DRenderer({ element: raisedLayer })
  raisedRenderer.setSize(window.innerWidth, window.innerHeight)

  const scene = new Scene()
  // A scene of its own: CSS3DObjects carry no geometry and have no business
  // being walked by the WebGL renderer.
  const cssScene = new Scene()
  /** Holds at most one card — whichever was entered last. */
  const raisedScene = new Scene()
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

  // The cards: one plane at CARD_DIST, centred on the resting view, with each
  // card turned to face the viewpoint — harder the further out it stands, so
  // the row reads as a curve wrapping around the viewer. Size is not left to
  // the projection: CARD_SIZE_TIERS steps it down from the ends to the middle,
  // and every card is centred on CARD_RISE so the row shares one centre line.
  const centres = solveRowCentres(cards.length)
  const middle = (cards.length - 1) / 2
  const objects: CSS3DObject[] = []
  cards.forEach((el, i) => {
    el.style.width = `${CARD_PX_W}px`
    el.style.height = `${CARD_PX_H}px`

    // Mirrored about the middle: rank 0 is the centremost card either side.
    const rank = Math.floor(Math.abs(i - middle))
    const x = Math.sign(i - middle) * centres[rank]
    const scale = scaleForRank(rank)
    const yaw = Math.atan(x / CARD_DIST) * CARD_FACE

    const object = new CSS3DObject(el)
    // The ends hold the row's centre line and the inner three are let down off
    // it; sharing one depth is what makes those heights compare directly on
    // screen, and a bigger card still reaches equally far above and below its
    // own centre.
    object.position.set(x, heightForRank(rank), -CARD_DIST)
    // A genuine 3D yaw about the card's own centre, written into the object's
    // matrix and carried into the CSS matrix3d — never a 2D skew() or scale().
    // `-yaw` aims the card at the camera, which is what spreads its two
    // vertical edges furthest apart in depth and gives the real trapezoid.
    object.rotation.y = -yaw
    object.scale.setScalar(scale)
    // The two ends stand near the frame's edges and already draw largest, so
    // growing them about their own centre pushes them out through the window's
    // frame. Marked here — where the arc position is known — and anchored away
    // from that edge in style.css.
    if (i === 0) el.dataset.arcEnd = 'left'
    else if (i === cards.length - 1) el.dataset.arcEnd = 'right'
    // CSS3DObject stamps `pointer-events: auto` on the element, which would
    // outrank any stylesheet rule and leave the cards clickable through a
    // closed (opacity-0) window. Cleared, so style.css alone decides.
    el.style.pointerEvents = ''
    cssScene.add(object)
    objects.push(object)

    // Raising is this scene's business, not the card's: which layer a card is
    // drawn in is a fact about where it stands, and only this module has the
    // objects to move. `pointerenter` gets there before the pointer can reach
    // the VIEW link; `focusin` is the keyboard's way in.
    el.addEventListener('pointerenter', () => raise(object))
    el.addEventListener('focusin', () => raise(object))
  })

  let yaw = 0
  let pitch = 0
  let yawVel = 0
  let pitchVel = 0
  let active = false
  /** The one card currently drawn in the layer above the row, if any. */
  let raised: CSS3DObject | null = null

  /**
   * Move a card into the layer that paints above the row.
   *
   * The early return is load-bearing and always has been: moving an object
   * between scenes detaches and re-inserts its element on the next render, and
   * `focusin` fires on *mousedown* when the VIEW link takes focus. Unguarded,
   * that moved the anchor between mousedown and mouseup and Chrome then fired
   * no `click` at all. A mouse has already raised the card on `pointerenter`
   * long before it reaches the link, so this no-ops exactly when it matters.
   *
   * Only one card is ever up there, so the raised layer never has to sort two
   * cards against each other — the previous one goes back to the row first.
   */
  function raise(object: CSS3DObject): void {
    if (raised === object) return
    if (raised) cssScene.add(raised)
    raisedScene.add(object)
    raised = object
    // Render-on-demand: without this the move would not reach the DOM until
    // something else happened to redraw.
    render()
  }

  function render(): void {
    renderer.render(scene, camera)
    cssRenderer.render(cssScene, camera)
    // After the row, and off the same camera — so it lands in exactly the place
    // it would have had in the row, just painted over it.
    raisedRenderer.render(raisedScene, camera)
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
    raisedRenderer.setSize(window.innerWidth, window.innerHeight)
    render()
  }

  render() // the frame the window opens onto the first time
  return { update, setActive, resize }
}
