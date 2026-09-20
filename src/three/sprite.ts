/**
 * The star sprite, shared by both of the site's particle fields (`scene.ts` and
 * `reveal.ts`).
 *
 * Each scene calls this for a texture of its own rather than passing one
 * around: the two have separate renderers, so they keep separate uploads.
 */
import { CanvasTexture, LinearFilter } from 'three'

/**
 * Soft round sprite so points draw as dots, not squares.
 *
 * `mipmaps: false` turns off mipmapping and minifies with a plain
 * `LinearFilter`. **This matters far more than it looks, for any layer whose
 * points all draw small.** The texture is 64x64 and a point sprite maps the
 * whole of it across `gl_PointSize` pixels, so a dot drawn ~2px wide is a ~30x
 * minification: the GPU picks mip level ~5, where this gradient — mostly
 * transparent by area — has been averaged down to almost nothing. The sampled
 * alpha collapses to ~0.002 and the dot renders at a few 255ths whatever colour
 * it carries, which is not a subtle loss but the difference between a visible
 * star and none.
 *
 * Measured on the close-in band (every point ~2.1 device px): the brightest
 * pixel went **92 -> 247 out of 255** with mipmaps off, at an unchanged colour.
 *
 * Leave them on for a layer whose points vary in size and get genuinely large
 * up close — there minification is real and mipmaps are what stop the dot
 * shimmering as it moves.
 *
 * **A layer can need both, at different points in the page.** The ambient
 * cloud is the case: at rest its points run ~1.7px to ~7.7px and it wears the
 * mipmapped texture, but the press flattens the whole field onto one plane and
 * lands every point at 2.2px — the failing case above, for 20,000 points at
 * once. `three/scene.ts` swaps its map on the first frame of scroll rather
 * than choosing one for good. Both textures are built up front; a swap is one
 * assignment and a `needsUpdate` flag.
 */
export function createCircleTexture({ mipmaps = true }: { mipmaps?: boolean } = {}): CanvasTexture {
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
  const texture = new CanvasTexture(canvas) // its constructor already flags needsUpdate
  if (!mipmaps) {
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter // the default is a mipmap filter
  }
  return texture
}
