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
import { HOLD } from './phases.ts'

// --- the wind-up ---
export const SWIRL_TO = 0.8
/**
 * Ease-out, and the exponent is doing real work: it is what makes the field
 * read as *accelerating* on the first touch of the scroll rather than simply
 * changing rate.
 */
export const SWIRL_EASE = 2.0
/** Extra turns the ring gains across the wind-up, on top of its own orbit. */
export const RING_SWIRL_TURNS = 0.45
/**
 * And the ambient cloud's, which has to be far smaller for the same *look*.
 * Its stars orbit at radii out to 62 against the ring's 2.7, so a turn there
 * is twenty times the arc across the frame. Set by how far a cloud star
 * travels on screen, not by how much it turns.
 */
export const CLOUD_SWIRL_TURNS = 0.05

// --- the scatter ---
export const SCATTER_TO = 0.95
/**
 * The share of the scatter spent letting stars go, before the last of them has
 * started. **This is the single most load-bearing number here.** At 0 every
 * star sets off together and the ring stops being a ring within a few percent
 * of the page; the larger it is, the longer the ring holds its shape while
 * being eaten into.
 */
export const SCATTER_STAGGER = 0.55
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
export const WAVE_SHARE = 0.68
/** The range of ease-out exponents rolled per star, so arrivals differ. */
export const EASE_MIN = 1.7
export const EASE_MAX = 3.4
/**
 * How far an inner-half ring star travels inward, in world units.
 *
 * The band runs 2.6..2.8, so anything past ~2.8 carries the star **through the
 * centre** and out the far side — `radius` goes negative, which with
 * `x = cos * radius` is exactly the antipode. The far end is wide so the ones
 * that cross keep going instead of piling into a knot in the middle.
 */
export const INWARD_MIN = 1.0
export const INWARD_MAX = 5.5
/**
 * And outward, which is bounded hard **by the frame, not by taste**. At the
 * ring's own plane the frustum reaches about 2.85 units vertically against the
 * ring's 2.7, so the ring already fills the frame's height and *any* outward
 * travel starts pushing stars off the top and bottom at once. Measured: at
 * 2..8 the whole ring was gone by a tenth of the page.
 */
export const OUTWARD_MIN = 0.4
export const OUTWARD_MAX = 2.2
/**
 * Turns a star winds on across its own travel: the **most** for the shortest
 * travel, the least for the longest. See the note at the top of the file —
 * this inverse correlation is what makes the paths read as one system.
 */
export const SPIRAL_MIN = 0.06
export const SPIRAL_MAX = 0.62

// --- the orbit running out ---
export const STILL_FROM = 0.35
export const STILL_TO = 0.95

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
 */
export const FILL_CHANCE = 0.025
/** The depths the spread targets are drawn between, in world units. */
export const FILL_NEAR = 14
export const FILL_FAR = 46
/**
 * How far past the frame edge targets may land, as a fraction of the half
 * frame. A little over 1 so the spread has no visible border.
 */
export const FILL_REACH = 1.15
export const SETTLE_FROM = 0.3
export const SETTLE_TO = 0.85

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
 */
export const BOLD_SIZE_GAIN = 2.6

/** 0..1 across Scene 1's own stretch, from the transition value. */
export function scene1At(p: number): number {
  return clamp(p / HOLD, 0, 1)
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
  return 1 - ramp(scene1At(p), STILL_FROM, STILL_TO)
}

/** How far the field has spread out and let go of the pointer, 0..1. */
export function settleAt(p: number): number {
  return ramp(scene1At(p), SETTLE_FROM, SETTLE_TO)
}
