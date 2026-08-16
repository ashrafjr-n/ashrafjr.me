/**
 * Base Three.js scene — a slow drifting starfield, plus the Scene 1 world
 * layer (the model) composited on top of it.
 *
 * A constant forward drift in z (with wrap-around) gives an infinite "flying
 * through space" base. Mouse parallax is layered on top via shared input
 * state, lerped for smooth, cinematic motion.
 *
 * Two render passes share one renderer: the starfield keeps its own camera
 * fixed at the origin (so its motion is untouched), then depth is cleared and
 * the world layer is drawn over it from a bird's-eye camera.
 * Palette: white/silver/gray only — no color pops.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  PerspectiveCamera,
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

const PARTICLE_COUNT = 1500

// --- Orbital disc ---
// Distances are in the world layer's units, where the model spans ~3.1, so the
// stars sit in the same space as the model's own embedded stars.
const ORBIT_MIN_RADIUS = 5
const ORBIT_MAX_RADIUS = 60
/** Vertical spread as a fraction of orbit radius — flares the disc outward. */
const DISC_FLARE = 0.22
/** Vertical spread floor, so inner stars are not pinned flat to the plane. */
const DISC_CORE_HEIGHT = 1.5

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

  const camera = new PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    DEPTH * 2,
  )
  camera.position.set(0, 0, 0)

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
    // sqrt keeps the disc from bunching up in the middle, since area grows
    // with r^2 — without it the centre reads as a dense blob.
    const t = Math.sqrt(Math.random())
    const radius = ORBIT_MIN_RADIUS + t * (ORBIT_MAX_RADIUS - ORBIT_MIN_RADIUS)
    const angle = Math.random() * Math.PI * 2
    const spread = DISC_CORE_HEIGHT + radius * DISC_FLARE

    radii[i] = radius
    angles[i] = angle
    speeds[i] = randomOrbitSpeed()

    positions[i3] = Math.cos(angle) * radius
    positions[i3 + 1] = rand(-spread, spread) // fixed height: orbits stay level
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
    size: 3.2,
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

    // Constant forward drift + wrap. The camera sits fixed at z=0, so
    // particles wrap back to the far edge once they cross it.
    const step = DRIFT_SPEED * delta
    const arr = posAttr.array as Float32Array
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const zi = i * 3 + 2
      arr[zi] += step // move toward the camera (+z)
      while (arr[zi] > 0) {
        arr[zi] -= DEPTH // wrap back to the far edge -> infinite field
      }
    }
    posAttr.needsUpdate = true

    world.update(delta)

    renderer.clear()
    renderer.render(scene, camera)
    renderer.clearDepth() // world layer sits in front of the starfield
    renderer.render(world.scene, world.camera)
  }

  function resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    world.resize(w / h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
  }

  return { update, resize }
}
