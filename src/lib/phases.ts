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
 * Scroll lengths, of a 900vh range (body is 1000vh in style.css — change them
 * together): Scene 1's break-up gets 240vh, identity 320vh, and the move into
 * Scene 3 340vh — **eased in and out**, so the transition leaves identity
 * gently instead of resuming at full speed, and settles as the model lands.
 *
 * **Scene 1's 240vh is what paces the scatter.** The ring flying apart and the
 * cloud streaming past the camera are pure functions of this value, and their
 * own distances and easings are solved against the camera frustum and must not
 * be retuned — so the only honest way to slow the break-up down is to spend
 * more scroll on it. It ran in 90vh and read as far too quick.
 *
 * **Both ends of the hold are velocity-continuous, and that is the point.**
 * Scene 1's break-up used to run dead linear and then stop the instant
 * identity began — the scatter was travelling at full speed one frame and
 * frozen the next, which is the lurch you feel between the two scenes. It is
 * now rounded off into the hold (`easeIntoHold`), and Scene 3 already leaves
 * the hold on a smoothstep, so nothing on screen changes speed abruptly at
 * either boundary.
 */
export const HOLD = 0.45
/** Exported for `phases.check.ts`, so its boundaries cannot go stale. */
export const IDENTITY_FROM = 240 / 900
export const IDENTITY_TO = 560 / 900

/**
 * Fraction of the last stretch of Scene 1 spent decelerating into the hold.
 *
 * Any curve that lands at a standstill has to make that time up earlier, so a
 * full ease-out would run the break-up at 2x linear from the very first pixel
 * of scroll — Scene 1's pacing is not up for retuning. Rounding only the tail
 * costs 1 / (1 - TAIL / 2) = 1.29x at the top instead, which is the cheapest
 * start that still arrives at rest.
 */
const HOLD_TAIL = 0.45
/** Slope of the linear stretch, solved so the eased tail still reaches 1. */
const HOLD_SLOPE = 2 / (2 - HOLD_TAIL)

/** 0..1 across Scene 1: linear, then a quadratic settle over the last HOLD_TAIL. */
function easeIntoHold(u: number): number {
  const a = 1 - HOLD_TAIL
  if (u <= a) return HOLD_SLOPE * u
  const d = u - a
  return HOLD_SLOPE * (a + d - (d * d) / (2 * HOLD_TAIL))
}

/** The Scene 1 -> Scene 3 transition value, paused through identity. */
export function toTransition(page: number): number {
  if (page < IDENTITY_FROM) return easeIntoHold(page / IDENTITY_FROM) * HOLD
  if (page > IDENTITY_TO) {
    const u = (page - IDENTITY_TO) / (1 - IDENTITY_TO)
    return HOLD + u * u * (3 - 2 * u) * (1 - HOLD)
  }
  return HOLD
}

/**
 * How far the identity scene reaches past its own stretch, at each end, in
 * page units.
 *
 * **This is what closes the black gap between the scenes.** The transition is
 * held through identity, so at the hold the ambient cloud has already streamed
 * past the camera and all that is left of Scene 1 is a scattered handful of
 * ring stars — and the model does not clear the bottom of the frame until well
 * into Scene 3. Without an overlap the page passes through two stretches with
 * nothing on them at all. Reaching back lets the thread start climbing while
 * Scene 1 is still breaking up, and reaching forward keeps the last statement
 * fading as the model rises into it.
 */
const IDENTITY_LEAD = 0.055
const IDENTITY_TRAIL = 0.05

/** 0..1 across the identity stretch, 0 before it and 1 after. */
export function toIdentity(page: number): number {
  const from = IDENTITY_FROM - IDENTITY_LEAD
  const to = IDENTITY_TO + IDENTITY_TRAIL
  return Math.min(Math.max((page - from) / (to - from), 0), 1)
}
