/**
 * The star sprite, shared by both of the site's particle fields (`scene.ts` and
 * `reveal.ts`).
 *
 * Each scene calls this for a texture of its own rather than passing one
 * around: the two have separate renderers, so they keep separate uploads.
 */
import { CanvasTexture } from 'three'

/** Soft round sprite so points draw as dots, not squares. */
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
  return new CanvasTexture(canvas) // its constructor already flags needsUpdate
}
