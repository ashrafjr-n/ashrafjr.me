/**
 * How the page's one smoothed scroll value splits into the three scenes.
 *
 *   page 0 .. IDENTITY_FROM   Scene 1 -> the dive and the glass (transition 0 .. HOLD)
 *   IDENTITY_FROM .. _TO      02 — IDENTITY                   (transition held at HOLD)
 *   IDENTITY_TO .. 1          ring gathers, model rises       (transition HOLD .. 1)
 *
 * `transition` is the value every star and model constant was tuned
 * against, so none of them change: identity is inserted by pausing it. HOLD is
 * RISE_START (0.45) — by then the ambient cloud has flown past, the corridor
 * has struck the glass and its dust has drifted off it, and the model has not
 * started. Identity's sky is the black that leaves, and that is deliberate:
 * see `IDENTITY_LEAD`.
 *
 * Scroll lengths, of a 1060vh range (body is 1160vh in style.css — change them
 * together): Scene 1 gets 400vh, identity 320vh, and the move into
 * Scene 3 340vh — **eased in and out**, so the transition leaves identity
 * gently instead of resuming at full speed, and settles as the model lands.
 *
 * **Scene 1's 400vh is what paces the dive**, and it is the only lever the
 * dive has. The flight into the ring, the corridor, the impact on the glass
 * and the dust clearing are all pure functions of this value, and their
 * distances are solved against the camera frustum — so the honest way to give
 * the sequence room is to spend more scroll on it. It was 240vh when Scene 1
 * was a scatter and nothing more; four beats do not fit in that.
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
export const IDENTITY_FROM = 400 / 1060
export const IDENTITY_TO = 720 / 1060

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
 * **The lead is 0, and that is the change the dive brought.** It was 0.16, and
 * it existed to close a black gap: Scene 1 used to empty well before its own
 * stretch was up, so the page passed through a stretch with a blank frame and
 * a line that had not started filling, and reaching the statements back into
 * it was what turned two events into one handover.
 *
 * Scene 1 now ends on the impact and **the black after it is the composition,
 * not a gap** — it is the beat the reader is given to register that everything
 * that had depth is now stuck to a flat surface, and the statements arrive
 * onto that surface rather than over the tail of something else. Reaching them
 * back into it would land them on top of the dust still clearing off the
 * glass, which is the one thing the sequence is building toward. The trail at
 * the far end is untouched: the model still has to rise into a block that is
 * already complete.
 */
/** Exported for `phases.check.ts`. */
export const IDENTITY_LEAD = 0
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
 * **It starts where identity does**, which is where Scene 1 ends. It used to
 * reach back into Scene 1 by the same 0.16 the statements did, to close the
 * same black gap; with the dive there is nothing to reach back into but the
 * corridor and the glass, and a model rising through either of those is
 * nonsense. The model is off (`MODEL_ENABLED`), so this costs nothing today —
 * it is here so that flipping that flag back on does not put the model inside
 * the tunnel.
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
