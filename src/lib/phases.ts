/**
 * How the page's one smoothed scroll value splits into the three scenes.
 *
 *   page 0 .. IDENTITY_FROM   Scene 1 -> the ring breaks up   (transition 0 .. HOLD)
 *   IDENTITY_FROM .. _TO      02 — IDENTITY                   (transition held at HOLD)
 *   IDENTITY_TO .. 1          ring gathers, model rises       (transition HOLD .. 1)
 *
 * `transition` is the value every star and model constant was tuned
 * against, so none of them change: identity is inserted by pausing it. HOLD is
 * RISE_START (0.45) — the ambient cloud has flown past, a scattered
 * third of the ring is still orbiting on screen, and the model has not
 * started. Those few stars are the identity scene's sky.
 *
 * Scroll lengths, of a 700vh range (body is 800vh in style.css — change them
 * together): Scene 1's break-up keeps its original 90vh, identity gets 300vh,
 * and the move into Scene 3 gets 310vh — nearly three times what it had —
 * **eased in and out**, so the transition leaves identity gently instead of
 * resuming at full speed, and settles as the model lands.
 */
export const HOLD = 0.45
const IDENTITY_FROM = 90 / 700
const IDENTITY_TO = 390 / 700

/** The Scene 1 -> Scene 3 transition value, paused through identity. */
export function toTransition(page: number): number {
  if (page < IDENTITY_FROM) return (page / IDENTITY_FROM) * HOLD
  if (page > IDENTITY_TO) {
    const u = (page - IDENTITY_TO) / (1 - IDENTITY_TO)
    return HOLD + u * u * (3 - 2 * u) * (1 - HOLD)
  }
  return HOLD
}

/** 0..1 across the identity stretch, 0 before it and 1 after. */
export function toIdentity(page: number): number {
  return Math.min(Math.max((page - IDENTITY_FROM) / (IDENTITY_TO - IDENTITY_FROM), 0), 1)
}
