/**
 * **The scatter** — how Scene 1's ring gives way to Scene 2.
 *
 * Scrolling does four things at once to the star field, and every one of them
 * is a pure function of the scroll position: nothing accumulates, nothing runs
 * on a clock, and scrolling down and back up returns the field exactly.
 * `scatter.check.ts` is what holds that.
 *
 * **The camera never moves, and nothing is ever turned to face it.** Both were
 * tried and rejected: an earlier version flew the camera down the ring's axis,
 * and the one after it rotated the ring's plane until it faced the lens. Each
 * read as the camera climbing over the ring rather than as the ring doing
 * something, which is not what this scene is about. What moves here is the
 * stars, in their own plane, seen from exactly where they were always seen.
 *
 * Every bound is a fraction of **Scene 1's own stretch** — 0 is the top of the
 * page, 1 is the frame identity's hold begins. `scene1At()` converts.
 *
 *   **the ring winds up, then unwinds.** Both layers gain extra rotation the
 *   instant the reader scrolls, front-loaded hard, so the field visibly picks
 *   up speed and then eases off rather than being switched from one rate to
 *   another. The ring gains far more of it than the ambient cloud, whose stars
 *   sit twenty times further out and sweep the frame on a fraction of a turn.
 *
 *   **the ring scatters, in two directions only.** A star in the inner half of
 *   the band travels *inward* — through the centre and out the far side, which
 *   is what `radius` going negative means — and a star in the outer half
 *   travels *outward*. Nothing drifts sideways and nothing picks a random
 *   heading. Both are eased out, so the scatter leaves quickly and arrives
 *   slowly, and because the wind-up is still running underneath it no star
 *   travels in a straight line: the two compose into a spiral.
 *
 *   **the orbit runs out.** The time-based rate is scaled to nothing, so the
 *   field comes to rest instead of being stopped.
 *
 *   **the field flattens.** Every star is pulled along **its own sightline**
 *   onto one plane, which changes its distance and not its place on screen.
 *   Nothing moves as a result of it — it is what gives the settled field one
 *   uniform size and weight, so it reads as a texture behind the statements
 *   rather than as a space, and so Scene 3's panel has something evenly dark
 *   to invert. It is invisible by construction: measured over every on-screen
 *   star, the largest screen drift across the whole of it is 6e-16.
 */
// Explicit .ts extensions so `npm run check` can run this under plain node;
// `allowImportingTsExtensions` is on and Vite resolves them either way.
import { clamp } from './math.ts'
import { HOLD } from './phases.ts'

// --- the wind-up ---
export const SWIRL_TO = 0.8
/**
 * Ease-out, and the exponent is doing real work: it is what makes the field
 * read as *accelerating* on the first touch of the scroll. A gentler curve
 * gives one flat rate change and no sense of being set off.
 */
export const SWIRL_EASE = 2.0
/** Extra turns the ring gains across the wind-up. */
export const RING_SWIRL_TURNS = 1.2
/**
 * And the ambient cloud's, which has to be far smaller for the same *look*.
 * Its stars orbit at radii out to 62 against the ring's 2.7, so a turn there
 * is twenty times the arc across the frame. This is set by how far a cloud
 * star travels on screen, not by how much it turns.
 */
export const CLOUD_SWIRL_TURNS = 0.06

// --- the scatter ---
export const SCATTER_TO = 0.85
/**
 * Ease-out: it leaves fast and arrives slow, which is what was asked for — but
 * **gently**. At 2.4 the ring was 70% scattered a quarter of the way into
 * Scene 1 and off the frame entirely, so the scene was over before it had
 * started; measured on screen.
 */
export const SCATTER_EASE = 1.4
/**
 * How far an inner-half ring star travels inward, in world units.
 *
 * The band runs 2.6..2.8, so anything past ~2.8 carries the star **through the
 * centre** and out the other side — `radius` goes negative, which with
 * `x = cos * radius` is exactly the antipode. The range is wide on purpose:
 * the short travellers stop near the middle and the long ones cross it, so the
 * hole in the ring fills and then spreads instead of emptying again.
 *
 * **The far end is bounded by the frame, not by taste.** At the ring's own
 * plane the frustum reaches about 2.85 units vertically and 5.07 horizontally,
 * so a star past ~5 is gone for good — and the settled field is what Scene 2
 * is read against and what Scene 3 inverts, so the ring emptying itself off
 * screen costs both of those. These were 2..8 and the ring vanished.
 */
export const INWARD_MIN = 1.5
export const INWARD_MAX = 5.0
/** And outward, for the outer half. */
export const OUTWARD_MIN = 0.6
export const OUTWARD_MAX = 3.5

// --- the orbit running out ---
export const STILL_FROM = 0.2
export const STILL_TO = 0.85

// --- the field flattening ---
export const FLATTEN_TO = 0.7
export const FLATTEN_EASE = 2.0
/**
 * The plane every star ends on, in world units from the camera. It sets the
 * size they all settle at: Three draws a point as `size * 0.5 * height /
 * depth`, so one depth means one size.
 */
export const FLAT_DIST = 12
/**
 * Below this depth a star is left alone. The flatten scales a star's offset
 * from the camera by `FLAT_DIST / depth`, which runs away as the depth
 * approaches zero; a star this close is outside the frustum unless it is
 * almost exactly on the axis, so there is nothing on screen to protect.
 */
export const FLAT_MIN_DEPTH = 2.0

// --- the settled field ---
/**
 * The size every star lands on.
 *
 * **Sized by what it has to survive, which is Scene 3's white half.** The
 * panel inverts the canvas, so a settled star becomes a dark dot on white —
 * and at the 2.23px this used to be, those dots were too fine to read against
 * the white at all. At 0.055 they draw about 4px, which carries through the
 * inversion. It is also what makes the two layers match: the cloud is authored
 * at 0.11 for its own distances and the ring at 0.025 for its ~10 units, and
 * at one shared depth that would draw the cloud four times the ring's size.
 */
export const SETTLED_POINT_SIZE = 0.055
/** Where the size, the sprite and the mouse parallax finish converging. */
export const SETTLE_FROM = 0.25
export const SETTLE_TO = 0.7
/**
 * The point at which the cloud gives up its mipmapped sprite for the settled
 * one. It is a step — two textures cannot be blended — and it is put on the
 * first frame of scroll because page 0 is protected and because the far field
 * coming up to brightness *is* the first thing the scroll should do.
 */
export const SPRITE_SWAP_AT = 0

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

/** How far along its own travel each ring star is, 0..1. */
export function scatterAt(p: number): number {
  return easeOut(ramp(scene1At(p), 0, SCATTER_TO), SCATTER_EASE)
}

/** What is left of the orbit's rate — 1 turning, 0 at rest. */
export function spinAt(p: number): number {
  return 1 - ramp(scene1At(p), STILL_FROM, STILL_TO)
}

/** How flat the field is: 0 is Scene 1's depth, 1 is one plane. */
export function flattenAt(p: number): number {
  return easeOut(ramp(scene1At(p), 0, FLATTEN_TO), FLATTEN_EASE)
}

/** How far the layers have converged on one size, one sprite and no parallax. */
export function settleAt(p: number): number {
  return ramp(scene1At(p), SETTLE_FROM, SETTLE_TO)
}
