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
 *   **the field settles.** The stars grow a little and take a harder-edged
 *   sprite, so the settled field carries through Scene 3's inversion as real
 *   dark points on white rather than as a grey haze; and the mouse parallax
 *   dies, because a backdrop that still answered the pointer would keep
 *   reading as a space.
 *
 * **Nothing changes any star's depth.** A version of this flattened the whole
 * field onto one plane to give it a single uniform size — it moved nothing on
 * screen, but it grew the far stars by up to 4.7x, and a field of points all
 * swelling at once reads as the viewer moving into it. It was removed for the
 * same reason the camera flight and the ring's turn were. Depth is the one
 * thing the scroll does not touch.
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
export const RING_SWIRL_TURNS = 0.75
/**
 * And the ambient cloud's, which has to be far smaller for the same *look*.
 * Its stars orbit at radii out to 62 against the ring's 2.7, so a turn there
 * is twenty times the arc across the frame. This is set by how far a cloud
 * star travels on screen, not by how much it turns.
 */
export const CLOUD_SWIRL_TURNS = 0.06

// --- the scatter ---
export const SCATTER_TO = 0.9
/**
 * Ease-out: it leaves fast and arrives slow, which is what was asked for — but
 * **gently**. At 2.4 the ring was 70% scattered a quarter of the way into
 * Scene 1 and off the frame entirely, so the scene was over before it had
 * started; measured on screen.
 */
export const SCATTER_EASE = 1.3
/**
 * A short slow start in front of that ease-out.
 *
 * **A pure ease-out puts maximum speed at the very first frame of scroll**,
 * and the band is only 0.2 units thick — so the ring lost its shape and became
 * a diffuse haze within 4% of the page, measured on screen, before the reader
 * had registered that anything was happening. This holds it together for the
 * first moment so there is a ring to watch fly apart. The deceleration that
 * was asked for is still the whole second half of the travel.
 */
export const SCATTER_HEAD = 1.8
/**
 * How far an inner-half ring star travels inward, in world units.
 *
 * The range is wide at the far end so the stars that cross the centre keep
 * going rather than piling up just past it: at 1.2..4.2 they settled into a
 * visible knot in the middle of the frame. The band runs 2.6..2.8, so anything
 * past ~2.8 carries the star **through the centre** and out the other side — `radius` goes negative, which with
 * `x = cos * radius` is exactly the antipode. The range is wide on purpose:
 * the short travellers stop near the middle and the long ones cross it, so the
 * hole in the ring fills and then spreads instead of emptying again.
 *
 * **The far end is bounded by the frame, not by taste**, and the outward half
 * is bounded hard. At the ring's own plane the frustum reaches about 2.85
 * units vertically against the ring's own 2.7, so the ring already fills the
 * frame's height and **any** outward travel starts pushing stars off the top
 * and bottom at once. Measured on screen: at 2..8 the whole ring was gone by a
 * tenth of the page, and at 0.6..3.5 the outward half still cleared the frame
 * before the scatter was a third done. What is left has to stay — it is what
 * Scene 2 is read against and what Scene 3 inverts.
 */
export const INWARD_MIN = 1.0
export const INWARD_MAX = 5.5
/** And outward, for the outer half. */
export const OUTWARD_MIN = 0.4
export const OUTWARD_MAX = 2.2

// --- the orbit running out ---
export const STILL_FROM = 0.2
export const STILL_TO = 0.85

// --- the settled field's even spread ---
/**
 * The share of ambient stars that drift to an evenly spread target as the
 * field settles.
 *
 * **Seen from the bird's-eye camera the ambient cloud is very far from even**,
 * and it was never meant to be: the top of the frame looks out along the
 * cloud's full depth and the bottom looks steeply down through a thin slice of
 * it. Measured on the rendered page, the top tenth of the frame is 1.81% lit
 * and the bottom three tenths are 0.08–0.16% — around fifteen times sparser.
 *
 * That is Scene 1's composition and it stays. But **Scene 3's white half
 * covers the bottom of the frame**, so it was inverting a part of the picture
 * that had almost nothing in it: 0.03% of it came out inked, against 1.24% of
 * the black half. The stars in the white half were not faint, there were
 * barely any. Nothing about size or sprite could fix that, and both were tried.
 *
 * So a slice of the cloud is given somewhere even to be by the time the
 * scatter is over. They travel there rather than appearing, over the same
 * stretch that everything else settles in, which is what was asked for: the
 * ambient stars pick up, slow down, and end up spread about at random.
 */
export const FILL_CHANCE = 0.03
/** The depths the spread targets are drawn between, in world units. */
export const FILL_NEAR = 14
export const FILL_FAR = 46
/**
 * How far past the frame edge targets may land, as a fraction of the half
 * frame. A little over 1 so the spread has no visible border.
 */
export const FILL_REACH = 1.15

// --- the settled field ---
/**
 * How much bigger every star draws once the field has settled, as a multiple
 * of the size its own layer was authored at.
 *
 * **Sized by what it has to survive, which is Scene 3's white half.** The panel
 * inverts the canvas, so a settled star becomes a dark point on white — and at
 * the sizes Scene 1 uses, those points were too fine to read against the white
 * at all. It is a multiplier rather than one shared size precisely because
 * nothing is flattened: each layer keeps its own depth spread, and a single
 * absolute size would need one.
 */
export const SETTLED_SIZE_GAIN = 2.6
/** Where the size, the sprite and the mouse parallax finish converging. */
export const SETTLE_FROM = 0.25
export const SETTLE_TO = 0.7
/**
 * How far through the settle both layers swap to the hard-edged sprite.
 *
 * The site's normal star is a soft radial gradient: full white only at its
 * centre, fading to nothing at its edge. Inverted by Scene 3's panel that
 * becomes a dot that is black only at its very centre and pale grey around it,
 * which on white barely registers — **the stars in the white half were
 * invisible**. The settled sprite holds full opacity across most of its radius
 * instead, so it inverts to a solid dark point.
 *
 * It is a step, because two textures cannot be blended, so it is put halfway
 * through the settle where the scatter is still travelling and there is plenty
 * on screen to cover it. It must stay above 0: page 0 is protected and the
 * soft sprite is part of it.
 */
export const SPRITE_SWAP_AT = 0.5

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
  return easeOut(Math.pow(ramp(scene1At(p), 0, SCATTER_TO), SCATTER_HEAD), SCATTER_EASE)
}

/** What is left of the orbit's rate — 1 turning, 0 at rest. */
export function spinAt(p: number): number {
  return 1 - ramp(scene1At(p), STILL_FROM, STILL_TO)
}

/** How far the layers have converged on one size, one sprite and no parallax. */
export function settleAt(p: number): number {
  return ramp(scene1At(p), SETTLE_FROM, SETTLE_TO)
}
