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
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
} from 'three'

/** Must stay identical to `--silver` in src/style.css. */
export const SILVER = 0xa9aeb3

// --- Framing ---
const CAMERA_FOV = 35
const CAMERA_POS = { x: 0, y: 8, z: 6.5 } // ~47° above the horizon: bird's-eye
const CAMERA_TARGET = { x: 0, y: 1, z: 0 }

const PLATFORM_SIZE = 5.5 // world units, square

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

  scene.add(createPlatform())

  function resize(nextAspect: number): void {
    camera.aspect = nextAspect
    camera.updateProjectionMatrix()
  }

  return { scene, camera, resize }
}
