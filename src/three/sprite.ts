/**
 * The star sprite used by the dark theme's stars (`three/sky.ts`).
 */
import { CanvasTexture, LinearFilter } from 'three'

/**
 * Soft round sprite so points draw as dots, not squares.
 *
 * **No mipmaps**, and that matters for points that all draw small: the texture
 * is 64x64 and a point sprite maps the whole of it across `gl_PointSize`
 * pixels, so a ~2px dot is a ~30x minification. With mipmaps the GPU samples
 * a level where this mostly-transparent gradient has been averaged to almost
 * nothing, and the dot renders at a few 255ths whatever colour it carries —
 * measured once at 92/255 against 247/255 without.
 */
export function createCircleTexture(): CanvasTexture {
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
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter // the default is a mipmap filter
  return texture
}
