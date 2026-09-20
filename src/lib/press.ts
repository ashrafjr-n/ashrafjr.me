/**
 * **The press** — how Scene 1's 3D star system becomes Scene 2's flat one.
 *
 * The two scenes speak different languages: Scene 1 has perspective, depth,
 * curvature and perpetual motion; Scene 2 is flat, orthogonal, still, and one
 * giant block of type. The bridge between them is not something arriving and
 * something leaving — **it is the same stars losing their third dimension**.
 * Nothing is added to the page and nothing is taken off it. The field that
 * Scene 1 is made of is the field Scene 2 is read against, and Scene 3 inverts
 * that same field to black-on-white for free (see `ui/invert.ts`).
 *
 * That is also why there is no cut anywhere in the sequence, and no stretch of
 * empty black between the scenes. There is nothing to cut between.
 *
 * Every bound here is a fraction of **Scene 1's own stretch** — 0 is the top
 * of the page, 1 is the frame identity's hold begins. `scene1At()` converts.
 * `three/scene.ts` reads these; this file holds no Three.js and no DOM so that
 * `lib/press.check.ts` can run it under plain node.
 *
 *   0.00 .. 0.62  **the depth drains.** Every star is pulled along its own
 *                 sightline onto one plane facing the camera. Its place on
 *                 screen does not move — only its distance — so the field does
 *                 not rearrange itself, it *equalises*: the far faint specks
 *                 and the near bright ones converge on one size and one
 *                 weight, and the picture stops being a space.
 *   0.18 .. 0.62  **the ring turns to face you.** Its plane rotates the ~27°
 *                 that separates it from the camera, so its ellipse opens into
 *                 a true circle and lands flat with the rest. This is the one
 *                 frame the whole sequence is built around: the object has
 *                 become a mark.
 *   0.55 .. 0.78  **the motion decays.** A circular orbit pressed onto a plane
 *                 is already only a left-right swing; this takes the swing to
 *                 nothing. The movement is not switched off, it runs out.
 *   0.72 .. 1.00  **the ring lets go** and disperses into the field, which is
 *                 what makes the backdrop one even scatter rather than a ring
 *                 sitting in front of a cloud.
 *
 * Every one of these is a **pure function of scroll position**. Nothing
 * accumulates and nothing runs on a clock, so scrolling down and back up
 * returns the field exactly — `press.check.ts` is what holds that.
 */
// Explicit .ts extensions so `npm run check` can run this under plain node;
// `allowImportingTsExtensions` is on and Vite resolves them either way.
import { clamp } from './math.ts'
import { HOLD } from './phases.ts'

// --- beat 1: the depth drains ---
export const PRESS_FROM = 0.0
export const PRESS_TO = 0.62
/**
 * Ease-out. The depth goes early and then settles, so the scene reads as
 * *relaxing* into a surface rather than being crushed onto one — and the last
 * stretch, where the difference is subtlest, is given the most scroll.
 */
export const PRESS_EASE = 2.0
/**
 * The plane every star ends on, in world units from the camera.
 *
 * It sets two things at once: the size every star settles at (Three draws a
 * point as `size * 0.5 * height / depth`, so one depth means one size) and how
 * much of the field lands inside the frame. The press moves each star **along
 * its own sightline**, so nothing changes place on screen — which means the
 * settled field is Scene 1's own pattern at one uniform weight, and its
 * density is already the tuned one.
 */
export const PRESS_DIST = 12
/**
 * Below this depth a star is left alone. The press scales a star's offset from
 * the camera by `PRESS_DIST / depth`, which runs away as the depth approaches
 * zero; a star this close is outside the frustum unless it is almost exactly
 * on the axis, so there is nothing on screen to protect.
 */
export const PRESS_MIN_DEPTH = 2.0

// --- beat 2: the ring turns to face the camera ---
export const FACE_FROM = 0.18
export const FACE_TO = 0.62
/** Ease-in-out: the turn starts and ends at rest, so it reads as one move. */
export const FACE_EASE = 2.0

// --- beat 3: the motion decays ---
export const STILL_FROM = 0.55
export const STILL_TO = 0.78

// --- beat 4: the ring lets go ---
export const RELEASE_FROM = 0.72
export const RELEASE_TO = 1.0
/** Ease-out, so the ring loosens rather than bursting. */
export const RELEASE_EASE = 2.2
/**
 * How far a ring star may drift as it joins the field, in world units on the
 * pressed plane. Its direction is random per star and its distance is
 * `sqrt`-distributed, which spreads them evenly over the area rather than
 * piling them up near the ring they came from.
 *
 * At `PRESS_DIST` the frame is about 13.5 x 7.6 units, so 7 covers it with
 * enough overflow that the field has no visible edge.
 */
export const RELEASE_SPREAD = 7

/**
 * The point in the press at which the ambient cloud gives up its mipmapped
 * sprite for the plain one.
 *
 * **It is a step, and it is the one visible discontinuity in the sequence.**
 * The two textures cannot be blended, so the far stars — the ones small enough
 * for minification to be eating them — come up to full brightness on a single
 * frame. It is put at the very first frame of scroll for two reasons: the
 * resting composition is protected and nothing may change at page 0, and one
 * frame later the far field brightening *is* the press's first beat, the depth
 * cue draining out of the brightness. `PRESS_EASE` is an ease-out, so the
 * sizes are moving fastest at exactly that moment and the eye is tracking
 * that rather than the step.
 *
 * Raise it and the swap lands mid-press, where nothing else is changing fast
 * enough to cover it.
 */
export const SPRITE_SWAP_AT = 0

// --- the settled field ---
/**
 * The size every star lands on, and the reason the two layers converge on one
 * number: the ambient cloud is authored at 0.11 for its own distances and the
 * ring at 0.025 for its ~10 units, and at one shared depth that difference
 * would draw the cloud four times the size of the ring. **Uniformity is what
 * makes the settled field read as a texture rather than as a space**, which is
 * what lets it sit behind the type at all.
 */
export const SETTLED_POINT_SIZE = 0.031
/** Where the size and the mouse parallax finish converging. */
export const SETTLE_FROM = 0.3
export const SETTLE_TO = 0.62

/**
 * What the settled field actually measures, at 1536x864 with `devicePixelRatio`
 * 2 — recorded because every one of these is a silent failure if it drifts:
 *
 *   - **every point draws at 2.23px**, against the ring's 2.08px today. That
 *     is deliberately in the same range: it is a size already proven to read
 *     on this page. It is also small enough to need the plain sprite rather
 *     than the mipmapped one, which is what `setSprite` in `three/scene.ts`
 *     is for.
 *   - **the press moves nothing on screen.** Simulated over every on-screen
 *     cloud star, the largest drift in screen position across the whole press
 *     is 6e-16 — floating-point zero — and every star lands at depth 12.0000.
 *   - **the ring lands 99.0–99.8% round**, measured across three of its own
 *     heights. Aimed from the origin instead of its own centre, and without
 *     the slide onto the view axis, it lands at 91–92%: visibly an ellipse in
 *     the one frame the sequence is built around.
 *   - **the frame at the plane is 13.5 x 7.6 world units**, which is what
 *     `RELEASE_SPREAD` is sized against — a disc of 7 overruns it on both
 *     axes, so the dispersed ring has no visible edge.
 *   - **about 253 cloud stars and 600 ring stars** end up on or near the
 *     frame. The cloud's count is Scene 1's own, unchanged, because the press
 *     preserves screen position.
 */

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

/** How flat the field is, 0 = Scene 1's depth, 1 = one plane. */
export function pressAt(p: number): number {
  return easeOut(ramp(scene1At(p), PRESS_FROM, PRESS_TO), PRESS_EASE)
}

/** How far the ring has turned to face the camera, 0..1. */
export function faceAt(p: number): number {
  const u = ramp(scene1At(p), FACE_FROM, FACE_TO)
  // Ease in and out, so the turn has no visible start or stop.
  return u < 0.5
    ? Math.pow(2 * u, FACE_EASE) / 2
    : 1 - Math.pow(2 * (1 - u), FACE_EASE) / 2
}

/** What is left of the orbit's speed, 1 = full, 0 = stopped. */
export function spinAt(p: number): number {
  return 1 - ramp(scene1At(p), STILL_FROM, STILL_TO)
}

/** How far the ring has dispersed into the field, 0..1. */
export function releaseAt(p: number): number {
  return easeOut(ramp(scene1At(p), RELEASE_FROM, RELEASE_TO), RELEASE_EASE)
}

/** How far the two layers have converged on one size and no parallax, 0..1. */
export function settleAt(p: number): number {
  return ramp(scene1At(p), SETTLE_FROM, SETTLE_TO)
}

/**
 * Whether anything the press drives is still changing at this scroll value.
 *
 * **This is the whole of the render-on-demand gate.** Past the end of Scene 1
 * every one of the curves above has clamped, so the field is a fixed set of
 * points that does not move again for the remaining two thirds of the page —
 * and redrawing it is wasted work on every frame of both of them, made worse
 * by Scene 3's blended panel, which forces a recomposite of everything under
 * it whenever the canvas is touched.
 */
export function isMoving(p: number): boolean {
  return scene1At(p) < Math.max(PRESS_TO, FACE_TO, STILL_TO, RELEASE_TO, SETTLE_TO)
}
