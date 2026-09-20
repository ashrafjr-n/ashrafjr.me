/**
 * Scene 1's three beats — the flight into the ring, the corridor, and the
 * invisible surface it all ends on — and every number they are tuned with.
 *
 * **This file is the tuning surface for the whole sequence.** It is deliberate
 * that it holds no Three.js and no DOM: `three/scene.ts` builds the corridor
 * and flies the camera from these, and `lib/dive.check.ts` runs them under
 * plain node, so the one property the sequence rests on — that scrolling down
 * through all three beats and back up returns the frame exactly — is a check
 * rather than a claim.
 *
 * `prefers-reduced-motion` is **not** handled here. Every function below is the
 * dive as authored; `three/scene.ts` is where it is switched off, at each of
 * the four places it feeds, so each of those reads next to its own fallback.
 */
// Explicit .ts extensions, so `npm run check` can run this file under plain
// node — `allowImportingTsExtensions` is on and Vite resolves them either way.
import { clamp } from './math.ts'
import { HOLD } from './phases.ts'

// ============================================================================
// --- The dive: the ring is a tunnel mouth, and the corridor hits glass ---
// ============================================================================
/**
 * Scene 1's three beats, and every number they are tuned with. **Nothing about
 * the dive is tuned outside this block** — the corridor's geometry, the
 * camera's flight and the glass all read from here.
 *
 * Every bound is a fraction of **Scene 1's own stretch**, not of the
 * transition value: 0 is the top of the page, 1 is the frame identity's hold
 * begins. `scene1At()` is the conversion.
 *
 *   0.00 .. 0.55  beat 1, the approach. The camera accelerates down the ring's
 *                 own axis; the ring winds up with it and the ambient cloud
 *                 rushes past. The mouth is crossed at about 0.37, leaving
 *   0.37 .. 0.55  ~18% of Scene 1 inside the corridor. **Deliberately short.**
 *                 This is the one part of the sequence that reads as a stock
 *                 warp tunnel, and length is what makes it read that way.
 *   0.55 .. 0.70  beat 2, the glass. The camera stops dead at its fastest,
 *                 rotation is killed, and every point ahead of the lens
 *                 collapses onto one plane facing the viewer — nearest first,
 *                 the rest following as a wave. This is the whole point of the
 *                 sequence: it converts depth into a flat surface on screen,
 *                 which is the thing the identity statements then arrive onto.
 *   0.70 .. 0.88  beat 3, the dust drifts off the glass and fades.
 *   0.88 .. 1.00  black. **A pause, not a gap** — `IDENTITY_LEAD` is 0 so
 *                 nothing reaches back to fill it, and that is on purpose.
 *
 * **None of it happens under `prefers-reduced-motion`**, but none of that is
 * decided here — see the file header. `three/scene.ts` zeroes each of these
 * feeds, so the camera holds its opening pose, the corridor is never drawn,
 * nothing lands on the glass, and Scene 1 falls back to the ring breaking up
 * on `bandScatterAt` / `bandExitAt` exactly as it always has. **Nothing the
 * fallback depends on has been deleted** — both of those are still the band
 * layer's `curve` / `flyCurve` on that path.
 *
 * Every one of these is a **pure function of scroll position**. Nothing here
 * accumulates and nothing runs on a clock, so scrolling down through all three
 * beats and back up returns the frame to exactly where it was.
 */

// --- beat 1: the approach ---
/** Where the camera's flight begins and ends, in Scene 1 fractions. */
export const DIVE_FROM = 0.0
export const DIVE_TO = 0.55
/**
 * Ease-in on the flight: the camera is at its fastest the instant it stops,
 * which is what makes the stop read as hitting something. It also sets where
 * the mouth is crossed — raising it shortens the corridor, lowering it
 * lengthens it. At 2.2 the corridor is ~18% of Scene 1.
 */
export const DIVE_EASE = 2.2
/** Where the camera comes to rest, on the ring's axis, looking straight down. */
export const DIVE_END_Y = -12
/** Extra turns the ring and the corridor wind on during the approach. */
export const DIVE_TURNS = 2.5
/** Ease-in on that wind-up, so the spin visibly gathers speed. */
export const SWIRL_EASE = 1.6
/**
 * Extra travel the ambient cloud makes during the dive, as a share of its own
 * `FLY_DISTANCE_*`. Without it the cloud is only ~11% of the way past the lens
 * when the corridor arrives and floods it. At 0.9 the field is genuinely gone
 * by the glass, and the rush is most of what the speed is read from.
 */
export const CLOUD_RUSH = 0.9

// --- beat 2: the corridor, and the glass ---
/** The corridor: the ring's orbits, extended a long way down its own axis. */
export const TUNNEL_COUNT = 5000
export const TUNNEL_Y_TOP = 1.0
export const TUNNEL_Y_BOTTOM = -40
/**
 * Sized for the corridor's own distances (~9 to 22 units at rest), not the
 * band's fixed ~10. It takes the band's **non-mipmapped** sprite for the same
 * reason the band does — see `sprite.ts`; at this size its far end lands under
 * 2 device pixels and would sample away to nothing.
 */
export const TUNNEL_POINT_SIZE = 0.05
export const TUNNEL_BRIGHT_MIN = 0.88
export const TUNNEL_BRIGHT_MAX = 1.0
export const TUNNEL_CLEAR_CHANCE = 0.3
/**
 * How much of Scene 1 the corridor takes to appear. **It cannot simply be
 * visible from the start**: at a wide aspect the far end of it falls inside
 * the frame at page 0, and Scene 1's resting composition is the ring with
 * nothing inside it.
 */
export const TUNNEL_FADE_TO = 0.1
/**
 * How far in front of the camera's resting place the invisible surface sits.
 *
 * It decides what the impact looks like, so it is the first thing to reach
 * for. The corridor's stars land at their own radius (~2.7) on this plane, and
 * the frame's half-height there is `tan(fov/2) * WALL_DIST` — at 14 that puts
 * the landed ring at about 61% of the way out, so it reads as a ring of spray
 * inside the frame with the centre still black. Shorten it and the spray lands
 * on the frame's edge; lengthen it and it closes on the centre.
 */
export const WALL_DIST = 14
/** The plane itself. Everything ahead of the lens collapses onto it. */
export const WALL_Y = DIVE_END_Y - WALL_DIST
export const IMPACT_FROM = 0.55
export const IMPACT_TO = 0.7
/** Ease-out on each point's own landing, so it arrives and stops rather than drifting in. */
export const IMPACT_EASE = 3.0
/**
 * The share of the impact window spent spreading the wave from the nearest
 * point to the furthest. **The impact is deliberately not simultaneous** — the
 * nearest land first and the rest follow across this, which is what reads as a
 * surface being struck rather than a layer being switched off.
 *
 * It is scroll-driven like everything else here, not a timer, so how long the
 * wave takes in milliseconds depends on how fast the page is being scrolled.
 * At an ordinary wheel pace 0.6 of this window lands at a few hundred ms.
 */
export const IMPACT_WAVE = 0.6
/**
 * How far into the impact all rotation is dead, as a share of the window.
 * Short on purpose: the spin has to stop *at* the wall, not ease down to it.
 */
export const IMPACT_SPIN_STOP = 0.18
/** How far a point may scatter across the glass as it lands, in world units. */
export const SPLAT_SPREAD = 1.2

// --- beat 3: the dust clears ---
export const SETTLE_FROM = 0.7
export const SETTLE_TO = 0.88
/** How far the landed dust slides outward off the glass before it is gone. */
export const SETTLE_DRIFT = 4.5

/** 0..1 across Scene 1's own stretch, from the transition value. */
export function scene1At(p: number): number {
  return clamp(p / HOLD, 0, 1)
}

/** 0..1 across `from`..`to`, flat outside it. */
function ramp(u: number, from: number, to: number): number {
  return clamp((u - from) / (to - from), 0, 1)
}

/** How far the camera is down its flight into the ring, 0..1. */
export function diveAt(p: number): number {
  return Math.pow(ramp(scene1At(p), DIVE_FROM, DIVE_TO), DIVE_EASE)
}

/** How far the impact wave has run across the corridor, 0..1. */
export function impactAt(p: number): number {
  return ramp(scene1At(p), IMPACT_FROM, IMPACT_TO)
}

/** How far the landed dust has drifted off the glass, 0..1. */
export function settleAt(p: number): number {
  return ramp(scene1At(p), SETTLE_FROM, SETTLE_TO)
}

/**
 * The ring's and the corridor's wind-up, in turns of `BAND_SWIRL`.
 *
 * **It ramps rather than accelerating**, and that distinction is the whole
 * reason it is written this way: an angular *speed* that rises with scroll has
 * to be integrated over time, so the total depends on how long the reader took
 * and scrolling back up would not unwind it. An extra *angle* as a function of
 * scroll looks identical on screen and rewinds exactly.
 *
 * It clamps at `IMPACT_FROM`, so the wind-up is frozen the moment the glass is
 * struck and the stars stay where they landed.
 */
export function ringSwirlAt(p: number): number {
  return DIVE_TURNS * Math.pow(ramp(scene1At(p), 0, IMPACT_FROM), SWIRL_EASE)
}

/** The corridor's opacity: in over the approach, out with the settle. */
export function tunnelFadeAt(p: number): number {
  return ramp(scene1At(p), 0, TUNNEL_FADE_TO) * (1 - settleAt(p))
}
