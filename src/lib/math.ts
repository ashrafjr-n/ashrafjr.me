/** Small numeric helpers shared by the scenes. */

/** A random number in [min, max). */
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
