/**
 * The sky: a flat blue with a fine grain, and a ring of clouds turning in it.
 * In the dark theme the blue goes to near-black and stars come out behind the
 * clouds (`ui/theme.ts`).
 *
 * The ring is built from four photographed clouds (`public/assets/hero/clouds/`,
 * keyed to transparent PNGs), each used several times as a sprite. Every sprite
 * is turned so its top faces the ring's centre on screen, which is what lets the
 * crescent's curve follow the circle and the rest read as one band.
 *
 * On scroll the ring **opens**: its radius grows faster than its clouds do, so
 * they draw apart as the camera dives through the middle (`three/scene.ts`).
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  TextureLoader,
  Vector3,
} from 'three'
import type { PerspectiveCamera, Texture } from 'three'
import { rand } from '../lib/math'
import { createCircleTexture } from './sprite'

const CLOUDS = [
  { url: '/assets/hero/clouds/cloud-crescent.png', weight: 3 },
  { url: '/assets/hero/clouds/cloud-wide.png', weight: 2 },
  { url: '/assets/hero/clouds/cloud-wisp.png', weight: 1 },
  { url: '/assets/hero/clouds/cloud-puff.png', weight: 2 },
  // The shreds: torn remnants, only ever used along the ring's two edges.
  { url: '/assets/hero/clouds/cloud-shred-a.png', weight: 0 },
  { url: '/assets/hero/clouds/cloud-shred-b.png', weight: 0 },
  { url: '/assets/hero/clouds/cloud-shred-c.png', weight: 0 },
  { url: '/assets/hero/clouds/cloud-shred-d.png', weight: 0 },
]
const FIRST_SHRED = 4
const CLOUD_COUNT = 30
/**
 * Remnants scattered just inside and just outside the ring, smaller and fainter
 * than the clouds, drawn behind them — what keeps the band's edges from reading
 * as cut out.
 */
const SHRED_COUNT = 26
const SHRED_INNER = [2.05, 2.3]
const SHRED_OUTER = [2.7, 2.82]
/**
 * A cloud is thick, so its middle sits well inside the ring's outer edge
 * (2.92, what `three/scene.ts` fits to the screen). Kept low (`y`) as well —
 * the ring's far side must stay under the intro line.
 */
const RING_RADIUS = 2.55
const RING_JITTER = 0.1
/** World width of one cloud; the camera's perspective makes the near ones larger. */
const SIZE_MIN = 1.55
const SIZE_MAX = 2.1
/** Clockwise, rad/s: ~63s a revolution. */
const RING_RATE = 0.099
/** Seconds the clouds take to fade in once every texture has arrived. */
const FADE_IN = 1.2
/**
 * Fully open, the ring is this many times its radius, and each cloud this many
 * times its size — a little, since the camera's fall does the rest.
 */
const OPEN_RADIUS = 1.3
const OPEN_SIZE = 1.2

/**
 * The dark theme's stars: a thin shell far out around everything, so the
 * camera's whole dive stays inside it. Only drawn while the sky is dark.
 */
const STAR_COUNT = 5000
const STAR_RADIUS = [200, 300]
/** In drawing-buffer px: no attenuation, the shell is far off anyway. */
const STAR_SIZE = 1.4
/** A slow turn of the whole shell, rad/s. */
const STAR_DRIFT = 0.01

/**
 * The sky: one flat colour, sampled off the reference, with a static grain at
 * the reference's own strength (std ~5.9 / 4.9 / 2.2 per channel). Drawn
 * straight in clip space, so no camera touches it, and the grain is per CSS
 * pixel so it looks the same on any pixel ratio.
 */
const SKY_VERTEX = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`
const SKY_FRAGMENT = /* glsl */ `
uniform float uPixelRatio;
uniform float uDark;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uPixelRatio);
  float n = hash(cell) * 2.0 - 1.0;
  vec3 base = mix(vec3(78.5, 152.9, 210.3), vec3(17.0), uDark) / 255.0;
  vec3 grain = mix(vec3(10.2, 8.4, 3.9), vec3(4.0), uDark) / 255.0;
  gl_FragColor = vec4(base + n * grain, 1.0);
}
`

interface Cloud {
  sprite: Sprite
  kind: number
  angle: number
  radius: number
  y: number
  width: number
  /** A small turn of its own on top of facing the centre, so no two align. */
  tilt: number
  /** Its opacity once faded in. */
  alpha: number
}

export interface Sky {
  scene: Scene
  /**
   * `turning` is false under reduced motion: the ring holds still. `open` is
   * how far the ring has opened, 0..1, `fade` how much of it is left, and
   * `dark` how far into the dark theme the sky is, and `sink` how far the
   * ring has come down with the camera, in world units.
   */
  update(
    delta: number,
    turning: boolean,
    open: number,
    fade: number,
    dark: number,
    sink: number,
  ): void
  /** The ring is scaled down to fit a narrow screen. */
  setScale(k: number): void
}

export function createSky(camera: PerspectiveCamera): Sky {
  const scene = new Scene()

  const skyMaterial = new ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uDark: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  })
  const skyQuad = new Mesh(new PlaneGeometry(2, 2), skyMaterial)
  skyQuad.frustumCulled = false
  skyQuad.renderOrder = -1
  scene.add(skyQuad)

  const starPositions = new Float32Array(STAR_COUNT * 3)
  const starColors = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT; i++) {
    // An even direction on the sphere, at a random distance in the shell.
    const y = rand(-1, 1)
    const a = rand(0, Math.PI * 2)
    const r = rand(STAR_RADIUS[0], STAR_RADIUS[1])
    const ring = Math.sqrt(1 - y * y) * r
    starPositions.set([Math.cos(a) * ring, y * r, Math.sin(a) * ring], i * 3)
    const v = rand(0.35, 1)
    starColors.set([v, v, v], i * 3)
  }
  const starGeometry = new BufferGeometry()
  starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3))
  starGeometry.setAttribute('color', new Float32BufferAttribute(starColors, 3))
  const starMaterial = new PointsMaterial({
    size: STAR_SIZE * Math.min(window.devicePixelRatio, 2),
    sizeAttenuation: false,
    map: createCircleTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    opacity: 0,
  })
  const stars = new Points(starGeometry, starMaterial)
  stars.frustumCulled = false
  // Over the sky, under every cloud.
  stars.renderOrder = -0.8
  scene.add(stars)

  const textures: (Texture | null)[] = CLOUDS.map(() => null)
  /** Height over width of each cloud image, read once it has loaded. */
  const ratios = CLOUDS.map(() => 0.5)
  const loader = new TextureLoader()
  CLOUDS.forEach(({ url }, i) =>
    loader.load(url, (tex) => {
      tex.colorSpace = SRGBColorSpace
      const img = tex.image as HTMLImageElement
      ratios[i] = img.height / img.width
      textures[i] = tex
      for (const cloud of clouds) {
        if (cloud.kind !== i) continue
        cloud.sprite.material.map = tex
        cloud.sprite.material.needsUpdate = true
      }
    }),
  )

  // Weighted so the crescent, whose curve follows the ring, turns up most.
  const bag = CLOUDS.flatMap((c, i) => Array<number>(c.weight).fill(i))
  const clouds: Cloud[] = []
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const kind = bag[(i * 3 + Math.floor(Math.random() * 2)) % bag.length]
    // Its own material, so it can carry its own rotation.
    const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }))
    clouds.push({
      sprite,
      kind,
      angle: ((i + rand(-0.3, 0.3)) / CLOUD_COUNT) * Math.PI * 2,
      radius: RING_RADIUS + rand(-RING_JITTER, RING_JITTER),
      y: rand(-0.2, 0.1),
      width: rand(SIZE_MIN, SIZE_MAX),
      tilt: rand(-0.18, 0.18),
      alpha: 1,
    })
    scene.add(sprite)
  }
  for (let i = 0; i < SHRED_COUNT; i++) {
    const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }))
    // Drawn before every cloud, so a shred only ever shows past a cloud's edge.
    sprite.renderOrder = -0.5
    const [lo, hi] = i % 2 ? SHRED_OUTER : SHRED_INNER
    clouds.push({
      sprite,
      kind: FIRST_SHRED + (i % 4),
      angle: ((i + rand(-0.4, 0.4)) / SHRED_COUNT) * Math.PI * 2,
      radius: rand(lo, hi),
      y: rand(-0.2, 0.05),
      width: rand(0.8, 1.3),
      tilt: rand(-0.6, 0.6),
      alpha: rand(0.6, 0.85),
    })
    scene.add(sprite)
  }

  let spin = 0
  let scale = 1
  let fade = 0
  const p = new Vector3()
  const c = new Vector3()

  function update(
    delta: number,
    turning: boolean,
    open: number,
    left: number,
    dark: number,
    sink: number,
  ): void {
    if (turning) spin += RING_RATE * delta
    skyMaterial.uniforms.uDark.value = dark
    starMaterial.opacity = dark
    stars.visible = dark > 0
    if (turning) stars.rotation.y -= STAR_DRIFT * delta
    if (fade < 1 && textures.every(Boolean)) fade = Math.min(1, fade + delta / FADE_IN)
    const eased = fade * fade * (3 - 2 * fade) * left
    const aspect = camera.aspect
    const spread = scale * (1 + (OPEN_RADIUS - 1) * open)
    const grow = scale * (1 + (OPEN_SIZE - 1) * open)

    for (const cloud of clouds) {
      cloud.sprite.visible = eased > 0
      if (!cloud.sprite.visible) continue
      const a = cloud.angle + spin
      const r = cloud.radius * spread
      const y = cloud.y * scale - sink
      cloud.sprite.position.set(Math.cos(a) * r, y, Math.sin(a) * r)

      const w = cloud.width * grow
      cloud.sprite.scale.set(w, w * ratios[cloud.kind], 1)
      const m = cloud.sprite.material
      m.opacity = eased * cloud.alpha

      // Top of the image toward the ring's centre, as seen on screen.
      p.copy(cloud.sprite.position).project(camera)
      c.set(0, y, 0).project(camera)
      m.rotation = Math.atan2(-(c.x - p.x) * aspect, c.y - p.y) + cloud.tilt
    }
  }

  function setScale(k: number): void {
    scale = k
    skyMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
    starMaterial.size = STAR_SIZE * Math.min(window.devicePixelRatio, 2)
  }

  return { scene, update, setScale }
}
