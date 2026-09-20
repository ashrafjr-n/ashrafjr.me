/**
 * **The scatter** — how Scene 1's ring gives way to Scene 2.
 *
 * Scrolling does four things to the star field at once, and every one of them
 * is a pure function of the scroll position: nothing accumulates, nothing runs
 * on a clock, and scrolling down and back up returns the field exactly.
 * `scatter.check.ts` is what holds that.
 *
 * **The camera never moves, nothing is ever turned to face it, and no star's
 * depth is touched.** Three bridges that broke one of those were built and
 * rejected — a flight down the ring's axis, a version that rotated the ring's
 * plane to face the lens, and one that pulled the whole field onto a single
 * plane. Each read as *the viewer moving* rather than as the stars moving. See
 * **Removed** in CLAUDE.md. What moves here is the stars, in their own plane,
 * seen from exactly where they were always seen.
 *
 * Every bound is a fraction of **Scene 1's own stretch** — 0 is the top of the
 * page, 1 is the frame identity's hold begins. `scene1At()` converts.
 *
 * **The whole of the difference between this and a crowd of dots flying apart
 * is that no two stars do the same thing at the same time.** Four things are
 * rolled per star, once, at build:
 *
 *   **when it leaves.** Mostly a wave running once around the ring's
 *   circumference, plus a jitter so the edge of the wave is ragged rather than
 *   a clean sweep. The ring therefore *unravels* from a point and keeps its
 *   shape everywhere the wave has not reached yet — where a single shared
 *   start makes the whole ring dissolve into haze at once, which is what the
 *   first version did.
 *   **where it goes.** Inward through the centre and out the far side, or
 *   outward — the two directions, and nothing in between.
 *   **how it slows.** Its own ease-out exponent, so the ones that arrive do
 *   not all arrive alike.
 *   **how much it turns on the way.** Its own spiral, **larger the shorter its
 *   travel**, which is what a real orbiting body does as it moves in and out:
 *   the ones that barely move wind round a long way, the ones flung furthest
 *   barely turn at all. That one correlation is most of what makes the paths
 *   read as a system rather than as a dispersal.
 */
// Explicit .ts extensions so `npm run check` can run this under plain node;
// `allowImportingTsExtensions` is on and Vite resolves them either way.
import { clamp } from './math.ts'
import { easeEnds, HOLD } from './phases.ts'

/**
 * Where the scatter is **over**, as a share of Scene 1's transition stretch.
 * The rest of Scene 1 is deliberately a still frame.
 *
 * It used to be 1: every curve here ran to the very end of the scene, and the
 * last third of that scroll was the tail of `toTransition`'s own ramp into the
 * hold — the field creeping the last few percent of a travel it had visibly
 * finished. Measured on the rendered page, the frames at 64%, 77% and 100% of
 * Scene 1's scroll are the same composition. Ending here spends that scroll on
 * a settled frame instead of on movement nobody can see.
 *
 * **It is the scroll fraction that this is set by, not its own value.** 0.3742
 * of the transition is **29% of Scene 1's scroll** — `toTransition` has its
 * own ramp into the hold, so the two are not the same number and the second
 * is the one anybody can see. It was 0.85 (68%), then 0.77 (60%), 0.645
 * (50%), 0.555 (43%), 0.516 (40%) and 0.4387 (34%). At or under 0.55 the
 * whole run sits inside `toTransition`'s linear middle, so the scroll
 * fraction is simply this over 1.29; above it the ramp into the hold makes
 * the two diverge.
 *
 * **`IDENTITY_LEAD` has to move with it.** The statements are meant to start
 * crossing the frame just *before* the field stops, so lowering this without
 * raising that inverts the handover and the type arrives to a still page.
 */
export const SCATTER_END = 0.3742
/**
 * How much of the run above is spent slowing down, as a share of it.
 *
 * **The field has to arrive at rest, not be cut off**, and `SCATTER_END` alone
 * would cut it off: the transition is still travelling at most of full rate
 * where it now clamps. This is the deceleration, and it is the whole of what
 * the stop feels like.
 *
 * **It was 0.34, then 0.6, and both still read as stopping too soon.** The
 * slope at the stop was already zero — `scatter.check.ts` measures it — but
 * the run it belongs to keeps being shortened, so a share of it is fewer and
 * fewer vh: at 0.34 of a 34% run the slowing had ~35vh to happen in. At 0.7
 * of a 29% run it has ~61vh, and it is now the larger half of the whole move.
 */
const STOP_TAIL = 0.7
/**
 * And how much is spent getting going, at the other end.
 *
 * **It was 0, on the argument that the first pixel of scroll has to do
 * something.** That holds for `toTransition`, which has a whole page to pace;
 * it did not hold here once the run was squeezed into the scene's first
 * third, where starting at full rate made both the dispersal and the wind-up
 * read as flung rather than released. The two ramps together leave no linear
 * middle at all, which is the price: the fastest the field ever moves is
 * `1 / (1 - HEAD / 2 - TAIL / 2)` = 2x linear, at the midpoint. That is the
 * ease-in-out shape, and it is what was asked for at both ends.
 */
const SET_HEAD = 0.3

// --- the wind-up ---
export const SWIRL_TO = 0.8
/**
 * **1, i.e. no curve of its own.** It was 2.0, an ease-out that made the
 * wind-up *accelerate* on the first touch of the scroll — which was the point
 * when Scene 1 had its whole stretch to play with, and is exactly what read
 * as the field being flung once the run was squeezed into the scene's first
 * third. `scene1At`'s `SET_HEAD` is the ease-in now, and it is the only one:
 * stacking a second curve on top of it is what put the speed back.
 */
export const SWIRL_EASE = 1.0
/**
 * Extra turns the ring gains across the wind-up, on top of its own orbit.
 *
 * **Deliberately almost nothing.** It was 0.45, and stacked on top of the
 * orbit and each star's own spiral it made three separate rotations running at
 * once — the scatter read as several movements happening together rather than
 * as one. The per-star spiral is what turns a scattering star now; this is
 * only enough to feel the field pick up on the first touch of the scroll.
 */
export const RING_SWIRL_TURNS = 0.12
/**
 * And the ambient cloud's, which has to be far smaller for the same *look*.
 * Its stars orbit at radii out to 62 against the ring's 2.7, so a turn there
 * is twenty times the arc across the frame. Set by how far a cloud star
 * travels on screen, not by how much it turns.
 */
export const CLOUD_SWIRL_TURNS = 0.035

// --- the scatter ---
export const SCATTER_TO = 1.0
/**
 * The share of the scatter spent letting stars go, before the last of them has
 * started. **This is the single most load-bearing number here.**
 *
 * At 0 every star sets off together and the ring stops being a ring within a
 * few percent of the page. The larger it is, the longer an intact arc of ring
 * survives while the rest is eaten away: at driver `t` roughly `1 - t/STAGGER`
 * of the ring has not moved at all. It was 0.55, and the ring still read as
 * finished by the halfway point of Scene 1 — because a ring only 0.2 units
 * thick loses its identity after a very small displacement, so what has to
 * last is the part that has not been touched yet, not the part in flight.
 */
export const SCATTER_STAGGER = 0.45
/**
 * **Every star arrives at the same moment, whenever it was let go.** A star's
 * travel runs from its own `delay` to the driver's end — `1 - delay` of the
 * run, not a fixed span — so the one released last and the one released first
 * come to rest on the same frame.
 *
 * It used to be a fixed `1 - SCATTER_STAGGER` for all of them, which meant a
 * star let go at 0 stopped at 0.28 of the driver and sat there while the rest
 * of the field carried on for another two thirds of Scene 1. Part of the
 * canvas freezing while part of it kept going was read as movement left over
 * rather than as a field settling, and it was called out.
 *
 * **That is what `SCATTER_STAGGER` is now bounded by.** The spans it produces
 * run `1 - STAGGER` to 1, and a star with a short span crosses the same
 * ground in less of the run — so the stagger is now also the spread of
 * *speeds*, not just of start times. At 0.72 the last stars would have moved
 * 3.6x faster than the first; at 0.45 it is 1.8x, which reads as a field
 * rather than as stragglers rushing to catch up. The ring still unravels: the
 * wave runs around its circumference over the first 45% of the driver, and a
 * star that has just been let go has barely moved.
 */
/**
 * How much of a star's delay comes from a **wave running once around the
 * ring**, the rest being a per-star jitter.
 *
 * All wave and the ring unzips with a clean edge, which reads mechanical. All
 * jitter and it erodes evenly all over, which reads like noise. Most of the
 * way toward the wave, with enough jitter to soften its edge, is what makes it
 * look like something coming apart rather than something being animated.
 */
export const WAVE_SHARE = 0.8
/**
 * The range of ease-out exponents rolled per star, so arrivals differ.
 *
 * **They were 1.9..2.7, and that is what made the scatter read as fast.** The
 * perceived speed of one of these is its release, not its average rate: at 2.3
 * a star covered half its travel in the first fifth of its own span, which
 * over a schedule this short is a flick. Nearer 1.7 the same distance is spent
 * more evenly, so the star sets off at a pace it can hold and glides into
 * place. Both ends stay above 1, which is what lands each star with no speed
 * left.
 */
export const EASE_MIN = 1.4
export const EASE_MAX = 2.0
/**
 * Where a ring star comes to rest, as a distance from the spin axis.
 *
 * **What is rolled is the destination, not the distance travelled**, and that
 * swap is the whole of the fix for a settled field that had two marks on it.
 * It used to roll a signed travel — `INWARD_MIN..MAX` for the band's inner
 * half, `OUTWARD_MIN..MAX` for its outer — and a travel drawn flat off a ring
 * only 0.2 units thick lands its stars in a narrow range of radii. That gave
 * the outer half an **annulus** out past the frame's edge, the ghost of the
 * ring it had just left, and the inner half a range that straddled zero, which
 * piles stars into the **middle of the frame**: a radius drawn flat puts the
 * same count in every ring however little ground that ring covers. Both were
 * on screen and both were called out.
 *
 * The draw is `sqrt` of a uniform over the *squared* bounds, which is even by
 * **area** rather than by radius — the standard way to scatter points over a
 * disc without a knot in the middle of it.
 *
 * `REST_MAX` is set by the frame: at the ring's plane the frustum reaches
 * ~2.85 units vertically and ~5.1 horizontally, so this is a little past the
 * far corner. `REST_MIN` is what keeps the centre open.
 */
export const REST_MIN = 0.8
export const REST_MAX = 5.6
/**
 * Turns a star winds on across its own travel: the **most** for the shortest
 * travel, the least for the longest. See the note at the top of the file —
 * this inverse correlation is what makes the paths read as one system. Halved
 * from 0.62 along with everything else, so the whole move stays one unhurried
 * gesture rather than a flourish.
 *
 * **The reach came down with the schedule, and for the same reason the eases
 * did.** Speed on screen is distance over scroll, and the scroll the scatter
 * gets was cut to the scene's first 40% — so holding the old distances would
 * have made the same move half again as fast. `REST_MIN`/`REST_MAX` are what
 * set it now, and the average travel under them is about what it was.
 */
export const SPIRAL_MIN = 0.05
export const SPIRAL_MAX = 0.24
/** The furthest any ring star can travel — what `spiral` is scaled against. */
export const TRAVEL_MAX = REST_MAX - 2.6

// --- the orbit running out ---
export const STILL_FROM = 0.25
export const STILL_TO = 1.0
/**
 * How the orbit's rate falls away: `(1 - u) ** SPIN_EASE`.
 *
 * **It was linear, and a linear fall stops the field on a corner** — the rate
 * is still dropping at a constant clip right up to the instant it reaches
 * zero, so the last of the motion is cut off rather than spent. This sheds
 * most of the speed early and then eases the rest away, so the field slows
 * quickly, keeps drifting for a while, and comes to rest without a seam. It
 * reaches exactly 0 at `STILL_TO`, with zero slope there.
 */
export const SPIN_EASE = 2.4

// --- the settled field's even spread ---
/**
 * The share of ambient stars that drift to an evenly spread target as the
 * field settles.
 *
 * **Seen from the bird's-eye camera the ambient cloud is very far from even**,
 * and it was never meant to be: the top of the frame looks out along the
 * cloud's full depth and the bottom looks steeply down through a thin slice of
 * it. Measured on the rendered page, the top tenth of the frame is 1.81% lit
 * and the bottom three tenths 0.08–0.16% — around fifteen times sparser.
 *
 * That is Scene 1's composition and it stays. But **Scene 3's white half
 * covers the bottom of the frame**, so it was inverting a part of the picture
 * with almost nothing in it: 0.03% of it came out inked against 1.24% of the
 * black half. The stars there were not faint, there were barely any, and
 * neither size nor sprite could fix that — both were tried and measured.
 *
 * **It is 1 now, and the frame is what limits the spread, not this.** It was
 * 0.038 of the whole cloud, and that only worked because it was drawing on
 * the whole cloud: **measured, 0.65% of those 20,000 stars project inside the
 * frustum at a time** — about 130 of them — so nearly every star it picked was
 * one that had to fly in over the edge of the picture to reach its target.
 * That was seen on screen and called out as wrong. `three/scene.ts` now tests
 * the frustum before it rolls, so the pool is only what is already in the
 * frame, and taking all of it is the most the spread can do without an
 * arrival. Measured at 1536x864 at page 0.9, over the band below the type:
 * **0.186% of the white half inked**, against 0.306% lit in the black half's
 * densest band and the 0.03% that was the broken case.
 */
export const FILL_CHANCE = 1.0
/** The depths the spread targets are drawn between, in world units. */
export const FILL_NEAR = 14
export const FILL_FAR = 46
/**
 * How far past the frame edge targets may land, as a fraction of the half
 * frame. A little over 1 so the spread has no visible border.
 */
export const FILL_REACH = 1.15
export const SETTLE_FROM = 0.15
/**
 * **1, so the drift stops where everything else does.** It was 0.95, and
 * `settleAt` is a plain linear ramp — clamping it early left the cloud's drift
 * running at a constant rate one frame and frozen the next, which is the one
 * hard stop left in Scene 1. Landing it on `scene1At`'s own zero-slope end is
 * what takes the corner off it.
 */
export const SETTLE_TO = 1.0

// --- the weight worn inside Scene 3's white half ---
/**
 * How much bigger a star draws **only where the white panel is over it**.
 *
 * It is not part of the settle and it is not a property of the field: the same
 * star is light on the black page and heavy an inch lower inside the white
 * half, on the same frame, and scrolling back up takes the weight off again.
 * `three/scene.ts` does it by drawing the field twice behind a scissor split
 * on the panel's own edge, so there is one number and no second copy of
 * anything. A soft small point inverts to a pale smudge on white; this is what
 * makes it a mark.
 *
 * **It was 2.6, and the black stars read as too heavy** — thinned on request.
 * Measured at 1536x864 at page 0.9, over the band below the type: 0.657% of
 * the white half inked at 2.6 against 0.368% at 2.0, with the black half lit
 * at 0.306% either way. So the white half still carries a little more ink than
 * the black page it is the negative of, which is the floor this has — much
 * under it and the half goes back to the pale smudges it exists to fix.
 */
export const BOLD_SIZE_GAIN = 2.0

/**
 * 0..1 across Scene 1's own stretch, from the transition value — **the one
 * driver every curve below reads**, so where this reaches 1 is where the whole
 * field comes to rest.
 *
 * It is not the raw share of the scene any more. It finishes at `SCATTER_END`
 * of it, eases *out of* rest over `SET_HEAD` and back into it over
 * `STOP_TAIL` — both ends soft, which is what leaves the
 * last third of Scene 1 a still frame — see both constants. Compressing the
 * run here rather than retuning each curve is what keeps the four of them in
 * the same relation to each other that they were tuned in.
 */
export function scene1At(p: number): number {
  return easeEnds(clamp(p / (HOLD * SCATTER_END), 0, 1), SET_HEAD, STOP_TAIL)
}

/** 0..1 across `from`..`to`, flat outside it. */
export function ramp(u: number, from: number, to: number): number {
  return clamp((u - from) / (to - from), 0, 1)
}

/** Ease-out: fast away from 0, settling into 1. */
function easeOut(u: number, power: number): number {
  return 1 - Math.pow(1 - u, power)
}

/** How far through the wind-up the field is, 0..1. */
export function swirlAt(p: number): number {
  return easeOut(ramp(scene1At(p), 0, SWIRL_TO), SWIRL_EASE)
}

/**
 * How far through the scatter **as a whole** it is, 0..1 — the driver each
 * star reads its own delayed, differently-eased travel off. Deliberately
 * linear: every curve that shapes this is per star.
 */
export function scatterAt(p: number): number {
  return ramp(scene1At(p), 0, SCATTER_TO)
}

/** What is left of the orbit's rate — 1 turning, 0 at rest. */
export function spinAt(p: number): number {
  return Math.pow(1 - ramp(scene1At(p), STILL_FROM, STILL_TO), SPIN_EASE)
}

/** How far the field has spread out and let go of the pointer, 0..1. */
export function settleAt(p: number): number {
  return ramp(scene1At(p), SETTLE_FROM, SETTLE_TO)
}
