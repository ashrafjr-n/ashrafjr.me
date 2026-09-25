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

/**
 * A critically damped chase with a speed limit — maath's `easing.damp`, the
 * one drei's `ScrollControls` runs its scroll offset through, ported as is.
 * `state.value` moves toward `target`; `state.velocity` is its memory.
 */
export function damp(
  state: { value: number; velocity: number },
  target: number,
  smoothTime: number,
  delta: number,
  maxSpeed = Infinity,
  eps = 0.001,
): void {
  if (Math.abs(state.value - target) <= eps) {
    state.value = target
    return
  }
  const omega = 2 / Math.max(0.0001, smoothTime)
  const x = omega * delta
  const t = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const maxChange = maxSpeed * smoothTime
  const change = clamp(state.value - target, -maxChange, maxChange)
  const to = state.value - change
  const temp = (state.velocity + omega * change) * delta
  state.velocity = (state.velocity - omega * temp) * t
  let output = to + (change + temp) * t
  // No overshoot.
  if (target - state.value > 0 === output > target) {
    output = target
    state.velocity = (output - target) / delta
  }
  state.value = output
}

/** Ease in and out with zero speed and acceleration at both ends. */
export function smoother(u: number): number {
  return u * u * u * (u * (u * 6 - 15) + 10)
}
