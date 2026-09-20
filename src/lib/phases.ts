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
 * together): Scene 1 gets **600vh**, identity 205vh, and the move into
 * Scene 3 155vh — **eased in and out**, so the transition leaves identity
 * gently instead of resuming at full speed.
 *
 * **Scene 1's 600vh is what paces the scatter, and it is the only honest way
 * to slow it down.** Every beat is a pure function of this value, so speed on
 * screen is distance over scroll and nothing else. It was 300vh, and with
 * `SCATTER_END` cutting the move to the scene's first 29% the whole
 * dispersal — the ring unravelling, every star's travel, the wind-up and the
 * settle — was spent in **87vh**. That is what read as flung rather than
 * cinematic, and no curve fixes it. At 600vh the same move has 174vh: exactly
 * twice as slow, with the composition untouched.
 *
 * **The scroll it took came from Scene 3, which had 340vh for a panel that
 * finished in 70 of them.** Nothing was compressed to pay for it; 280vh of
 * the old split was a finished composition being scrolled past.
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
export const IDENTITY_FROM = 600 / 960
export const IDENTITY_TO = 805 / 960

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
 *
 * Exported because `lib/scatter.ts` needs the same shape to bring the field to
 * a stop inside Scene 1 — one curve, not two that have to agree.
 */
export function easeEnds(u: number, head: number, tail: number): number {
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
 * **The two scenes overlap on purpose, and the lead is how much.** Nothing
 * leaves the frame any more — Scene 1's field disperses and *stays* — so this
 * is not covering a blank frame the way it was when it stood at 0.16 and the
 * ring flew off the screen. It is the handover itself: the statements are
 * already crossing while the field is still settling, so the page moves from
 * one scene to the next rather than finishing one and starting the other.
 *
 * **0.30 is set against where the scatter stops**, which is page 0.106 now
 * (`SCATTER_END`, 34% of Scene 1's scroll) — and it is set against **the
 * first glyph reaching the frame**, not against the scene opening. The two
 * are far apart: a statement starts 1.05 viewport widths out, so it is still
 * wholly off screen for the first ~9% of the scene and the layer's own
 * opening is invisible. `SLIDE_SPAN` and `SLIDE_FROM` put the first edge in
 * frame at **page 0.076**, well before the field stops, which is the overlap.
 * The scene itself opens at `IDENTITY_FROM - IDENTITY_LEAD` = 0.0125.
 * **Lowering `SCATTER_END` moves the field's stop earlier, so this has to go
 * up with it** or the type arrives to a page that has already gone still.
 *
 * It was 0.05, which opened at 0.2625 and put the first glyph at 0.31 — a
 * screen and a half of scroll after the field had already stopped, with
 * nothing happening in between. Solve it from the glyph, not from the lead:
 * `start + 0.088 * (0.7358 - start)` is where the first edge lands, and the
 * far end (`0.92` of the scene) has to stay under the panel's 0.70.
 *
 * **Raising it lengthens the identity scene, which pushes its fill later in
 * page terms**, so the far end is what to re-check: `FILL_FROM + 2 *
 * FILL_STEP + FILL_SPAN` of the scene has to land before `ui/invert.ts`'s
 * panel starts rising at page 0.70. At 0.20 the last sweep completes at 0.686.
 * The trail at the far end is untouched.
 */
/** Exported for `phases.check.ts`. */
export const IDENTITY_LEAD = 0.575
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
const MODEL_TO = 0.8

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
