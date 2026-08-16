/**
 * Scene 1 world layer — the model and the platform it rests on.
 *
 * Kept as its own scene + camera so the starfield can keep its original
 * fixed-at-origin camera and behave exactly as before. `scene.ts` renders the
 * starfield first, clears depth, then renders this layer on top.
 *
 * Palette: white/silver/gray only.
 */
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/** Must stay identical to `--silver` in src/style.css. */
export const SILVER = 0xa9aeb3

// --- Framing ---
const CAMERA_FOV = 35
const CAMERA_POS = { x: 0, y: 8, z: 6.5 } // ~47° above the horizon: bird's-eye
const CAMERA_TARGET = { x: 0, y: 0.25, z: 0 } // model's own mid-height: centers it on screen

const PLATFORM_SIZE = 4.4 // world units, square — a silver margin around the model
const PLATFORM_Y = -0.015 // just under y=0 so it never z-fights the model's base

const MODEL_URL = '/models/space_boi.glb'
/**
 * Target world size of the model's widest horizontal dimension. The GLB is a
 * wide, shallow diorama, so it is fitted by footprint rather than height —
 * fitting by height would blow the footprint far past the viewport.
 */
const MODEL_SPAN = 3.1

/**
 * Normalize the GLB: uniform-scale it to MODEL_SPAN, center it on x/z and drop
 * it so its lowest point sits on the platform.
 */
function fitToPlatform(model: Object3D): void {
  const box = new Box3().setFromObject(model)
  const size = box.getSize(new Vector3())
  model.scale.setScalar(MODEL_SPAN / (Math.max(size.x, size.z) || 1))

  const fitted = new Box3().setFromObject(model)
  const center = fitted.getCenter(new Vector3())
  model.position.set(-center.x, -fitted.min.y, -center.z)
}

/**
 * Flat square pedestal at y = 0.
 *
 * Deliberately unlit (`MeshBasicMaterial`, no tone mapping on the renderer) so
 * it renders the raw SILVER hex and stays pixel-identical to the CSS body
 * background — any lit material would shade it and break the match.
 */
function createPlatform(): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(PLATFORM_SIZE, PLATFORM_SIZE),
    new MeshBasicMaterial({ color: SILVER, side: DoubleSide, toneMapped: false }),
  )
  mesh.rotation.x = -Math.PI / 2 // lay it flat
  mesh.position.y = PLATFORM_Y
  return mesh
}

export interface WorldLayer {
  scene: Scene
  camera: PerspectiveCamera
  resize(aspect: number): void
}

export function createWorld(aspect: number): WorldLayer {
  const scene = new Scene()

  const camera = new PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 200)
  camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z)
  camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z)

  // Pure-white lights only — they shape the model without tinting it. The
  // platform is unlit, so none of this touches the background match.
  const key = new DirectionalLight(0xffffff, 2.2)
  key.position.set(4, 8, 5)
  const fill = new DirectionalLight(0xffffff, 0.8)
  fill.position.set(-5, 3, -4)
  scene.add(new AmbientLight(0xffffff, 1.1), key, fill)

  scene.add(createPlatform())

  // Async — the starfield and platform render immediately, the model pops in
  // when it has loaded. No animation is driven off it yet.
  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      fitToPlatform(gltf.scene)
      scene.add(gltf.scene)
    },
    undefined,
    (err) => console.error(`[world] failed to load ${MODEL_URL}`, err),
  )

  function resize(nextAspect: number): void {
    camera.aspect = nextAspect
    camera.updateProjectionMatrix()
  }

  return { scene, camera, resize }
}
