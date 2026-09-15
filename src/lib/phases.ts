/**
 * How the page's one smoothed scroll value splits into the three scenes.
 *
 *   page 0 .. IDENTITY_FROM   Scene 1 -> the ring breaks up   (transition 0 .. HOLD)
 *   IDENTITY_FROM .. _TO      02 — IDENTITY                   (transition held at HOLD)
 *   IDENTITY_TO .. 1          ring gathers, model rises       (transition HOLD .. 1)
 *
 * `transition` is the value every star and model constant was tuned
 * against, so none of them change: identity is inserted by pausing it. HOLD is
 * ENTER_AT / RISE_START (0.45) — the ambient cloud has flown past, a scattered
 * third of the ring is still orbiting on screen, and the model has not
 * started. Those few stars are the identity scene's sky.
 *
 * The page bounds keep the first and last stretches at the scroll length they
 * had before (90vh and 110vh of a 200vh range), with identity given 200vh in
 * between — body is 500vh in style.css, a 400vh range. Change them together.
 */
export const HOLD = 0.45
const IDENTITY_FROM = 0.225
const IDENTITY_TO = 0.725

/** The Scene 1 -> Scene 3 transition value, paused through identity. */
export function toTransition(page: number): number {
  if (page < IDENTITY_FROM) return (page / IDENTITY_FROM) * HOLD
  if (page > IDENTITY_TO) return HOLD + ((page - IDENTITY_TO) / (1 - IDENTITY_TO)) * (1 - HOLD)
  return HOLD
}

/** 0..1 across the identity stretch, 0 before it and 1 after. */
export function toIdentity(page: number): number {
  return Math.min(Math.max((page - IDENTITY_FROM) / (IDENTITY_TO - IDENTITY_FROM), 0), 1)
}
