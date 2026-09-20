/**
 * How the page's one smoothed scroll value splits into the three scenes.
 *
 *   page 0 .. IDENTITY_FROM   Scene 1 -> the press             (transition 0 .. HOLD)
 *   IDENTITY_FROM .. _TO      02 — IDENTITY                   (transition held at HOLD)
 *   IDENTITY_TO .. 1          ring gathers, model rises       (transition HOLD .. 1)
 *
 * `transition` is the value every star and model constant was tuned
 * against, so none of them change: identity is inserted by pausing it. HOLD is
 * RISE_START (0.45) — and by then **the press is complete**: the whole star
 * field has flattened onto one plane, stopped moving and settled at one size,
 * and the model has not started. That settled field is the identity scene's
 * backdrop, and Scene 3's panel inverts it to black-on-white for free.
 *
 * Scroll lengths, of a 960vh range (body is 1060vh in style.css — change them
 * together): Scene 1 gets 300vh, identity 320vh, and the move into
 * Scene 3 340vh — **eased in and out**, so the transition leaves identity
 * gently instead of resuming at full speed, and settles as the model lands.
 *
 * **Scene 1's 300vh is what paces the press.** Every beat of it is a pure
 * function of this value (`lib/press.ts`), so the only honest way to slow the
 * flattening down is to spend more scroll on it. It was 240vh when Scene 1 was
 * a scatter and nothing more; the press has four beats to get through and the
 * last of them is the subtlest.
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
export const IDENTITY_FROM = 300 / 960
export const IDENTITY_TO = 620 / 960

/**
 * 0..1 with **zero slope at both ends**, easing over only `head` and `tail` of
 * the run and travelling at a constant rate in between.
 *
 * Zero-slope ends are what make the two scene boundaries velocity-continuous:
 * whatever is moving arrives at a standstill and leaves from one, instead of
 * stopping dead or setting off at full speed. But a curve that does that has
 * to make the time up somewhere, and `smoothstep` — which is this with
 * head = tail = 0.5 — spends the whole run doing it. That is why Scene 3 used
 * to leave a long stretch of scroll where nothing had visibly happened yet.
 *
 * Naming the two ramps separately buys the ends back: the linear middle runs
 * at `1 / (1 - head / 2 - tail / 2)`, so short ramps cost very little.
 */
function easeEnds(u: number, head: number, tail: number): number {
  const rate = 1 / (1 - head / 2 - tail / 2)
  if (u < head) return (rate * u * u) / (2 * head)
  if (u > 1 - tail) {
    const d = 1 - u
    return 1 - (rate * d * d) / (2 * tail)
  }
  return rate * (u - head / 2)
}

/**
 * Scene 1 sets off at once and settles into the hold over its last 45%.
 *
 * No head ramp: the first pixel of scroll has to do something, and a full
 * ease-in-out would have run the break-up at 2x linear in the middle to pay
 * for it. This costs 1.29x, and Scene 1's pacing is not up for retuning.
 */
const HOLD_TAIL = 0.45

/**
 * Scene 3 leaves the hold over its first 18% and lands over its last 40%.
 *
 * The head has to exist — it is the other half of the identity boundary — but
 * it is deliberately short. At `smoothstep`'s implied 0.5 the model was still
 * below the frame a third of the way through Scene 3's scroll, which is most
 * of the black gap the page used to have between identity and the model.
 */
const SCENE3_HEAD = 0.18
const SCENE3_TAIL = 0.4

/** The Scene 1 -> Scene 3 transition value, paused through identity. */
export function toTransition(page: number): number {
  if (page < IDENTITY_FROM) return easeEnds(page / IDENTITY_FROM, 0, HOLD_TAIL) * HOLD
  if (page > IDENTITY_TO) {
    const u = (page - IDENTITY_TO) / (1 - IDENTITY_TO)
    return HOLD + easeEnds(u, SCENE3_HEAD, SCENE3_TAIL) * (1 - HOLD)
  }
  return HOLD
}

/**
 * How far the identity scene reaches past its own stretch, at each end, in
 * page units.
 *
 * **The lead is small now, and it used to carry the whole handover.** It was
 * 0.16, because Scene 1 emptied well before its own stretch was up: the ring
 * flew off, the cloud streamed past the camera and the page sat on a blank
 * frame waiting for the statements. That gap shipped twice.
 *
 * **The press removed the gap rather than covering it.** Nothing leaves any
 * more — Scene 1's star field flattens and *stays*, so the frame is never
 * empty and there is nothing for the statements to have to arrive early for.
 * What is left is a small overlap for its own sake: the first statement starts
 * crossing while the ring is still letting go, so the two scenes hand over
 * instead of taking turns. The trail at the far end is untouched.
 */
/** Exported for `phases.check.ts`. */
export const IDENTITY_LEAD = 0.05
const IDENTITY_TRAIL = 0.09

/**
 * Where the model rises into Scene 2, in page units.
 *
 * **It cannot be driven off the transition**, which is exactly what makes this
 * its own function: the transition is *held* at HOLD for the whole of
 * identity, so anything read off it is frozen there and the model could never
 * move during the scene it is now in. The page value keeps running, so the
 * rise is hung on that instead.
 *
 * **It starts where identity does.** It used to reach back into Scene 1 to
 * close the same blank frame the statements did; with the press there is no
 * blank frame, and a model rising through the flattening field would be
 * fighting it. The model is off (`MODEL_ENABLED`), so this costs nothing
 * today — it is here so that flipping that flag back on lands it in the scene
 * it belongs to.
 */
/** Exported for `phases.check.ts`. */
export const MODEL_FROM = IDENTITY_FROM
const MODEL_TO = 0.62

/** 0..1 across the model's rise into Scene 2, 0 before it and 1 after. */
export function toModel(page: number): number {
  return Math.min(Math.max((page - MODEL_FROM) / (MODEL_TO - MODEL_FROM), 0), 1)
}

/** 0..1 across the identity stretch, 0 before it and 1 after. */
export function toIdentity(page: number): number {
  const from = IDENTITY_FROM - IDENTITY_LEAD
  const to = IDENTITY_TO + IDENTITY_TRAIL
  return Math.min(Math.max((page - from) / (to - from), 0), 1)
}
