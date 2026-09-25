/** Small numeric helpers shared by the scenes. */

/** A random number in [min, max). */
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** `value` held inside [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** How far `p` is through the stretch `from..from + span`, 0..1. */
export function range(p: number, from: number, span: number): number {
  return clamp((p - from) / span, 0, 1)
}

/** Ease in and out with zero speed and acceleration at both ends. */
export function smoother(u: number): number {
  return u * u * u * (u * (u * 6 - 15) + 10)
}
