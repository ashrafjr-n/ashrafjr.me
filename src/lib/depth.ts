/**
 * Depth engine — "camera flying through depth".
 *
 * Sections do not live in document flow. Each is registered as a depth item at a
 * fixed Z in a perspective world. Scrolling advances a virtual camera FORWARD,
 * so items emerge from deep distance, grow toward the screen plane, then enlarge
 * and fade as the camera passes through them. Nothing slides up from below.
 *
 * CSS perspective (on `.world`) turns translateZ into real depth + scale:
 *   relZ very negative -> far away, tiny
 *   relZ ~ 0           -> at the screen plane, natural size
 *   relZ -> +PERSPECTIVE-> rushing past the camera (we fade/hide before that)
 */

export interface DepthItem {
  el: HTMLElement
  baseZ: number
  index: number
  fadeScale: number
}

/** CSS perspective applied to the world (keep in sync with .world in CSS). */
export const PERSPECTIVE = 1000

/** Z distance between consecutive sections. */
const Z_GAP = 1400

// Alpha thresholds along relZ (mirrors the reference's vizZ fade logic).
const Z_FADE_IN_START = -Z_GAP // far edge: fully transparent beyond this
const Z_FADE_IN_END = -Z_GAP * 0.28 // faded fully in by here as it approaches
const Z_FADE_OUT_START = Z_GAP * 0.12 // starts fading once it pushes past center
const Z_NEAR = Z_GAP * 0.5 // gone by here (kept < PERSPECTIVE so it never blows up)

const items: DepthItem[] = []

/**
 * Register a section element at depth index `index` (Hero = 0).
 *
 * `fadeScale` narrows the fade-in/fade-out window around the screen plane
 * (1 = default, matches a full section like Hero/projects; <1 = quicker,
 * for brief transitional items that shouldn't linger).
 */
export function registerSection(el: HTMLElement, index: number, fadeScale = 1): DepthItem {
  const item: DepthItem = { el, baseZ: -index * Z_GAP, index, fadeScale }
  items.push(item)
  return item
}

/** Number of registered depth items (used to size the scroll proxy). */
export function getSectionCount(): number {
  return items.length
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Opacity for a given relative Z: fade in from afar, fade out just past camera.
 * `fadeScale` scales the whole window in toward the screen plane (relZ = 0),
 * so a smaller value fades in/out over a shorter stretch of scroll.
 */
function alphaFor(relZ: number, fadeScale: number): number {
  const fadeInStart = Z_FADE_IN_START * fadeScale
  const fadeInEnd = Z_FADE_IN_END * fadeScale
  const fadeOutStart = Z_FADE_OUT_START * fadeScale
  const near = Z_NEAR * fadeScale

  if (relZ <= fadeInStart || relZ >= near) return 0
  if (relZ < fadeInEnd) {
    return clamp01((relZ - fadeInStart) / (fadeInEnd - fadeInStart))
  }
  if (relZ > fadeOutStart) {
    return clamp01(1 - (relZ - fadeOutStart) / (near - fadeOutStart))
  }
  return 1
}

/**
 * Advance the camera from the current scroll value and lay out every item.
 * CAM_SPEED is derived so one viewport of scroll ≈ one Z_GAP (one section).
 */
export function updateDepth(scroll: number): void {
  const camSpeed = Z_GAP / window.innerHeight // cameraZ = scroll * CAM_SPEED
  const cameraZ = scroll * camSpeed

  for (const item of items) {
    const relZ = item.baseZ + cameraZ
    const alpha = alphaFor(relZ, item.fadeScale)
    const style = item.el.style

    if (alpha <= 0.001) {
      // Behind the camera or too far away — drop it entirely for performance.
      style.visibility = 'hidden'
      style.opacity = '0'
      style.pointerEvents = 'none'
      continue
    }

    style.visibility = 'visible'
    style.opacity = alpha.toFixed(3)
    style.pointerEvents = alpha > 0.6 ? 'auto' : 'none'
    style.transform = `translate(-50%, -50%) translateZ(${relZ.toFixed(1)}px)`
    // Nearer items (higher relZ) paint on top during cross-fades.
    style.zIndex = String(1000 + Math.round(relZ))
  }
}
