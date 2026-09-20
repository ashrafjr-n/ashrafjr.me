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
 * **It is the scroll fraction that this is set by, not its own value.** 0.77
 * of the transition is **60% of Scene 1's scroll** — `toTransition` has its
 * own ramp into the hold, so the two are not the same number and the second
 * is the one anybody can see. It was 0.85, which landed at 68%.
 */
export const SCATTER_END = 0.77
/**
 * How much of the run above is spent slowing down, as a share of it.
 *
 * **The field has to arrive at rest, not be cut off**, and `SCATTER_END` alone
 * would cut it off: the transition is still travelling at ~87% of full rate
 * where it now clamps. This is the deceleration — a short one, so the motion
 * stays brisk and then sheds its speed quickly and stops dead, rather than
 * drifting out over half the scene the way the old tail did.
 */
const STOP_TAIL = 0.34

// --- the wind-up ---
export const SWIRL_TO = 0.8
/**
 * Ease-out, and the exponent is doing real work: it is what makes the field
 * read as *accelerating* on the first touch of the scroll rather than simply
 * changing rate.
 */
export const SWIRL_EASE = 2.0
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
export const SCATTER_STAGGER = 0.72
/** What is left for any one star's own travel, once it has been let go. */
export const SCATTER_SPAN = 1 - SCATTER_STAGGER
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
 * How far an inner-half ring star travels inward, in world units.
 *
 * The band runs 2.6..2.8, so anything past ~2.8 carries the star **through the
 * centre** and out the far side — `radius` goes negative, which with
 * `x = cos * radius` is exactly the antipode. The far end is wide so the ones
 * that cross keep going instead of piling into a knot in the middle.
 */
export const INWARD_MIN = 0.7
export const INWARD_MAX = 3.1
/**
 * And outward, which is bounded hard **by the frame, not by taste**. At the
 * ring's own plane the frustum reaches about 2.85 units vertically against the
 * ring's 2.7, so the ring already fills the frame's height and *any* outward
 * travel starts pushing stars off the top and bottom at once. Measured: at
 * 2..8 the whole ring was gone by a tenth of the page.
 */
export const OUTWARD_MIN = 0.3
export const OUTWARD_MAX = 1.15
/**
 * Turns a star winds on across its own travel: the **most** for the shortest
 * travel, the least for the longest. See the note at the top of the file —
 * this inverse correlation is what makes the paths read as one system. Halved
 * from 0.62 along with everything else, so the whole move stays one unhurried
 * gesture rather than a flourish.
 *
 * **The travels above came down with it, and for the same reason the eases
 * did.** Speed on screen is distance over scroll, and the scroll the scatter
 * gets was cut to 60% of the scene — so holding the old distances would have
 * made the same move half again as fast. The reach was trimmed with the
 * schedule instead. `INWARD_MAX` stays well past the ring's own 2.8 radius, so
 * the inner half still carries through the centre and out the far side; that
 * is the character of the move and it is not what was costing the calm.
 */
export const SPIRAL_MIN = 0.05
export const SPIRAL_MAX = 0.24

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
 * of it and eases into that stop over `STOP_TAIL`, which is what leaves the
 * last third of Scene 1 a still frame — see both constants. Compressing the
 * run here rather than retuning each curve is what keeps the four of them in
 * the same relation to each other that they were tuned in.
 */
export function scene1At(p: number): number {
  return easeEnds(clamp(p / (HOLD * SCATTER_END), 0, 1), 0, STOP_TAIL)
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
