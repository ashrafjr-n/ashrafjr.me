/**
 * Base Three.js scene — an orbiting starfield, plus the Scene 1 world layer
 * (the model) composited on top of it.
 *
 * The stars orbit the model's centre on roughly the model's own orbital plane,
 * each at its own randomised speed, so they read as one system with the stars
 * embedded in the model rather than as a separate dolly-ing backdrop. Mouse
 * parallax is layered on top via shared input state, lerped for smooth motion.
 *
 * Two render passes share one renderer, both drawn through the world layer's
 * bird's-eye camera — sharing the vantage is what makes the star orbits line up
 * with the model's. Depth is cleared between them so the model always sits in
 * front of the stars.
 * Palette: white/silver/gray only — no color pops.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three'
import type { InputState } from '../lib/state'
import { createWorld } from './world'

export interface SceneController {
  update(time: number, state: InputState): void
  resize(): void
}

// The camera sits inside the disc and only a narrow cone of it is ever on
// screen, so the count is high to keep the on-screen star density looking the
// way it did before. Points are cheap; only the angle is recomputed per frame.
const PARTICLE_COUNT = 5800

// --- Orbital cloud ---
// Distances are in the world layer's units, where the model spans ~3.1, so the
// stars sit in the same space as the model's own embedded stars.
//
// The shape is a flattened ball centred on the model, not a thin disc. The
// camera pitches ~50° down, so its frustum dives straight through a thin disc
// and out the underside within ~25 units — which leaves the frame empty. A
// squashed ball keeps stars all around the frustum while FLATTEN still biases
// them toward the model's own plane. Every star orbits the same Y axis either
// way, so the motion reads as one system regardless of the thickness.
const CLOUD_RADIUS = 48
const CLOUD_INNER = 3 // keeps stars off the camera's lens
const CLOUD_FLATTEN = 0.7 // y squash: < 1 favours the model's orbital plane

// Angular speeds in rad/s, all in the model's own direction of spin. Tiered so
// most stars are slow, a few are quick, and each one is randomised within its
// tier — a single uniform rate reads mechanical.
const SPEED_TIERS = [
  { chance: 0.78, min: 0.01, max: 0.05 }, // most: barely creeping
  { chance: 0.18, min: 0.05, max: 0.14 }, // some: mid-paced
  { chance: 0.04, min: 0.14, max: 0.38 }, // few: noticeably fast
]

// --- Interaction tuning (mouse parallax; gentle / clamped) ---
const MAX_TILT = 0.09 // max parallax tilt from the mouse (~5°), radians
const TILT_LERP = 0.05 // how fast tilt eases toward the target

/** Soft round sprite so points are dots, not squares. */
function createCircleTexture(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Pick an orbital speed from the weighted tiers, randomised within the tier. */
function randomOrbitSpeed(): number {
  let roll = Math.random()
  for (const tier of SPEED_TIERS) {
    if (roll < tier.chance) return rand(tier.min, tier.max)
    roll -= tier.chance
  }
  const last = SPEED_TIERS[SPEED_TIERS.length - 1]
  return rand(last.min, last.max)
}

export function initScene(canvas: HTMLCanvasElement): SceneController {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.setClearColor(0x000000, 0) // transparent: the CSS black shows through
  renderer.autoClear = false // two passes per frame, cleared manually below

  const scene = new Scene()

  // --- Particle geometry: a flared disc orbiting the model's centre ---
  // Each star keeps its own radius / height / angle / angular speed; only the
  // angle changes per frame, so a star can never drift off its own orbit.
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const colors = new Float32Array(PARTICLE_COUNT * 3)
  const radii = new Float32Array(PARTICLE_COUNT)
  const angles = new Float32Array(PARTICLE_COUNT)
  const speeds = new Float32Array(PARTICLE_COUNT)
  const c = new Color()

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3

    // A point spread evenly through the volume of a ball: cbrt for the
    // distance (volume grows with r^3) and an even direction on the sphere,
    // then squash y. Without cbrt the centre reads as a dense blob.
    const dist = CLOUD_INNER + Math.cbrt(Math.random()) * (CLOUD_RADIUS - CLOUD_INNER)
    const cosPolar = rand(-1, 1)
    const sinPolar = Math.sqrt(1 - cosPolar * cosPolar)
    const phi = Math.random() * Math.PI * 2

    // Orbit radius is the distance from the model's *vertical axis*, so height
    // drops out of it — that is what keeps each star on a level circle.
    const radius = dist * sinPolar
    const angle = phi

    radii[i] = radius
    angles[i] = angle
    speeds[i] = randomOrbitSpeed()

    positions[i3] = Math.cos(angle) * radius
    positions[i3 + 1] = dist * cosPolar * CLOUD_FLATTEN // fixed: orbits stay level
    positions[i3 + 2] = Math.sin(angle) * radius

    // White/silver only — grayscale brightness from pure white down to
    // a slightly dimmer silver-white, no color tint.
    const v = rand(0.78, 1.0)
    c.setRGB(v, v, v)
    colors[i3] = c.r
    colors[i3 + 1] = c.g
    colors[i3 + 2] = c.b
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))

  const material = new PointsMaterial({
    // The cloud lives in world-layer units, far closer than the old deep
    // volume, so the point size scales down to match. Three sizes points as
    // `size * 0.5 * drawingBufferHeight / distance` (fov plays no part), so
    // this is set from the old size/distance ratio to keep dots the same size.
    size: 0.11,
    sizeAttenuation: true,
    map: createCircleTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    opacity: 0.85,
  })

  const points = new Points(geometry, material)
  scene.add(points)

  const posAttr = geometry.getAttribute('position') as Float32BufferAttribute

  // --- Scene 1 world layer (the model), drawn over the starfield ---
  const world = createWorld(window.innerWidth / window.innerHeight)

  // --- Animation: constant drift + smoothed mouse parallax ---
  let prevTime = performance.now()

  function update(time: number, state: InputState): void {
    const delta = Math.min((time - prevTime) / 1000, 0.1) // clamp big tab-switch gaps
    prevTime = time

    // Mouse parallax — tilt the field a few degrees, lerped.
    const tiltY = state.mouseX * MAX_TILT
    const tiltX = -state.mouseY * MAX_TILT
    points.rotation.y += (tiltY - points.rotation.y) * TILT_LERP
    points.rotation.x += (tiltX - points.rotation.x) * TILT_LERP

    // Advance each star along its own orbit. Increasing the angle with
    // x = cos, z = sin turns the disc clockwise from the bird's-eye camera —
    // the same direction the model spins. Height is never rewritten, so every
    // star stays on its own level circle around the model's centre.
    const arr = posAttr.array as Float32Array
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = angles[i] + speeds[i] * delta
      angles[i] = angle
      const i3 = i * 3
      arr[i3] = Math.cos(angle) * radii[i]
      arr[i3 + 2] = Math.sin(angle) * radii[i]
    }
    posAttr.needsUpdate = true

    world.update(delta)

    renderer.clear()
    renderer.render(scene, world.camera) // same vantage -> same orbital plane
    renderer.clearDepth() // world layer sits in front of the starfield
    renderer.render(world.scene, world.camera)
  }

  function resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    world.resize(w / h) // one camera now drives both passes
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
  }

  return { update, resize }
}
