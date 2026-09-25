/**
 * The day half: a clear blue sky with a ring of clouds turning in it, seen
 * through the starfield's own bird's-eye camera so the two rings read as one
 * ellipse split by the rope.
 *
 * `cloud_ring.glb` is "Cloud Ring" by RandyGF (CC-BY-4.0, Sketchfab). Its three
 * concentric rings are turned here, clockwise at the star band's pace, and the
 * GLB's own animation is not used.
 */
import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  Group,
  SRGBColorSpace,
  Scene,
} from 'three'
import type { Material, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MODEL_SPIN_RATE } from './world'

const CLOUD_URL = '/assets/hero/cloud_ring.glb'
/** Puts the rings' middle on the star band's radius (~2.8). */
const CLOUD_SCALE = 0.52
const CLOUD_Y = 0
/** Inner ring fastest, like an orbit; all clockwise, around the band's rate. */
const RING_RATES = [1.25, 1.1, 0.95].map((k) => -k * MODEL_SPIN_RATE)
/** The clouds' own alpha, over the texture's. */
const CLOUD_OPACITY = 0.82
/** Seconds the clouds take to fade in once the GLB has arrived. */
const FADE_IN = 1.2

/** Top to bottom of the frame: deep blue overhead, clearer toward the horizon. */
function skyTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#0d3a86')
  grad.addColorStop(0.55, '#2f6fc4')
  grad.addColorStop(1, '#6fa6e3')
  g.fillStyle = grad
  g.fillRect(0, 0, 2, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export interface Sky {
  scene: Scene
  /** `turning` is false under reduced motion: the rings hold still, like the stars. */
  update(delta: number, turning: boolean): void
  /** The ring's size follows the star band's on narrow screens. */
  setScale(k: number): void
}

export function createSky(): Sky {
  const scene = new Scene()
  scene.background = skyTexture()
  scene.add(new AmbientLight(0xffffff, 2.2))
  const sun = new DirectionalLight(0xffffff, 2.4)
  sun.position.set(-3, 10, 4)
  scene.add(sun)

  const holder = new Group()
  holder.position.y = CLOUD_Y
  holder.scale.setScalar(CLOUD_SCALE)
  scene.add(holder)

  const rings: Object3D[] = []
  const materials: Material[] = []
  let opacity = 0
  let loaded = false

  new GLTFLoader().load(CLOUD_URL, (gltf) => {
    holder.add(gltf.scene)
    gltf.scene.traverse((o) => {
      // GLTFLoader sanitises node names: `Cloud GN.001` arrives as `Cloud_GN001`.
      if (o.name.startsWith('Cloud_GN')) rings.push(o)
      // The innermost ring fills the middle in; the star ring is hollow.
      if (o.name.startsWith('Cloud_GN001')) o.visible = false
      const mesh = o as Mesh
      // All three rings share one material; read its opacity only once.
      if (mesh.isMesh && !materials.includes(mesh.material as Material)) {
        const m = mesh.material as MeshStandardMaterial
        // The GLB ships a dark grey at 0.4 alpha, which reads as smoke on blue.
        m.color.set(0xffffff)
        m.userData.full = CLOUD_OPACITY
        m.opacity = 0
        materials.push(m)
      }
    })
    loaded = true
  })

  function update(delta: number, turning: boolean): void {
    if (turning) for (let i = 0; i < rings.length; i++) rings[i].rotation.y += RING_RATES[i % 3] * delta
    if (loaded && opacity < 1) {
      opacity = Math.min(1, opacity + delta / FADE_IN)
      const eased = opacity * opacity * (3 - 2 * opacity)
      for (const m of materials) (m as Material & { opacity: number }).opacity = m.userData.full * eased
    }
  }

  function setScale(k: number): void {
    holder.scale.setScalar(CLOUD_SCALE * k)
  }

  return { scene, update, setScale }
}
