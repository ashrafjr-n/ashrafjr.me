/** Small numeric helpers shared by the scenes. */

/** A random number in [min, max). */
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** `value` held inside [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
