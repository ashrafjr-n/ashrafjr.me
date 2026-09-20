/**
 * Self-check for the press. Run it with `npm run check`.
 *
 * Four things, every one of which fails silently on screen:
 *
 *  1. **Scene 1's opening composition is untouched.** Every driver has to be
 *     exactly 0 at the top of the page, except the spin, which has to be
 *     exactly 1 — the ring is turning at full rate in the resting frame.
 *  2. **The sequence rewinds exactly.** Nothing may accumulate: scrolling down
 *     through all four beats and back up has to return every driver to the
 *     value it set out from.
 *  3. **The beats overlap in the right order**, so the press reads as one move
 *     rather than four.
 *  4. **Everything has finished by the time Scene 1 is over.** The settled
 *     field is Scene 2's backdrop and Scene 3's inverted one, and `isMoving`
 *     is what lets the renderer stop entirely for those two scenes — if any
 *     curve were still running past the end of Scene 1 that gate would be
 *     lying and the field would freeze mid-press.
 */
import {
  FACE_FROM,
  PRESS_DIST,
  PRESS_MIN_DEPTH,
  RELEASE_SPREAD,
  SETTLED_POINT_SIZE,
  SPRITE_SWAP_AT,
  FACE_TO,
  PRESS_TO,
  RELEASE_FROM,
  RELEASE_TO,
  STILL_TO,
  SETTLE_TO,
  STILL_FROM,
  faceAt,
  isMoving,
  pressAt,
  releaseAt,
  scene1At,
  settleAt,
  spinAt,
} from './press.ts'
import { HOLD } from './phases.ts'

/** Deliberately not `node:assert` — that would drag `@types/node` in for one file. */
function ok(condition: boolean, what: string): void {
  if (!condition) throw new Error(what)
}

/** Everything the press drives, and where each one has to start and end. */
const drivers = { pressAt, faceAt, releaseAt, settleAt }
type Driver = keyof typeof drivers
const at = (u: number): number => u * HOLD

// 1. The resting frame.
for (const name of Object.keys(drivers) as Driver[]) {
  ok(drivers[name](0) === 0, `${name} is not 0 at the top of the page — Scene 1's rest state moved`)
}
ok(spinAt(0) === 1, 'the ring is not turning at full rate in the opening frame')

// 2. The sweep down and back. These are pure functions of one number, so
// anything but an exact match on the way back is accumulation.
const STEPS = 4000
for (const name of [...(Object.keys(drivers) as Driver[]), 'spinAt' as const]) {
  const fn = name === 'spinAt' ? spinAt : drivers[name as Driver]
  const down: number[] = []
  for (let i = 0; i <= STEPS; i++) down.push(fn(at(i / STEPS)))
  for (let i = STEPS; i >= 0; i--) {
    ok(fn(at(i / STEPS)) === down[i], `${name} does not rewind at ${i / STEPS} of Scene 1`)
  }
}

// 3. The beats overlap, in order: the ring starts turning while the depth is
// still draining, lands with it, and only then does the motion run out and the
// ring let go.
ok(FACE_FROM > 0, 'the ring starts turning before the press has begun to bite')
ok(FACE_FROM < PRESS_TO, 'the turn and the press are sequential — they will read as two moves')
ok(FACE_TO === PRESS_TO, 'the ring does not land flat with the rest of the field')
ok(STILL_FROM < PRESS_TO, 'the motion only starts dying after the field is already flat')
ok(RELEASE_FROM > PRESS_TO, 'the ring lets go before it has become a circle — the money frame is lost')
ok(RELEASE_FROM > STILL_FROM, 'the ring disperses while it is still spinning')
// **The still frame.** Everything has to land, and then be left alone for a
// while, before the ring lets go — a flat, circular, motionless composition is
// what the whole bridge exists to produce, and it is not produced if the
// release overlaps the last of the spin. It did not exist at first.
ok(RELEASE_FROM >= STILL_TO, 'the ring lets go before it has come to rest')
ok(RELEASE_FROM - STILL_TO > 0.05, 'the still frame is too brief to register as a held one')
const held = (STILL_TO + RELEASE_FROM) / 2
ok(
  pressAt(held * HOLD) === 1 &&
    faceAt(held * HOLD) === 1 &&
    spinAt(held * HOLD) === 0 &&
    releaseAt(held * HOLD) === 0 &&
    settleAt(held * HOLD) === 1,
  'the held frame is not actually still — something is mid-move inside it',
)

// 4. Everything is finished, and finished together, by the end of Scene 1.
for (const name of Object.keys(drivers) as Driver[]) {
  ok(drivers[name](HOLD) === 1, `${name} has not finished when Scene 1 hands over`)
}
ok(spinAt(HOLD) === 0, 'the field is still turning when the statements arrive')
ok(RELEASE_TO === 1 && Math.max(PRESS_TO, FACE_TO, STILL_TO, SETTLE_TO) <= 1, 'a beat runs past Scene 1')

// The still-frame gate. This is what stops the renderer for two thirds of the
// page, so it has to agree exactly with the curves it is standing in for.
ok(isMoving(0), 'the press is asleep at the top of the page')
ok(!isMoving(HOLD), 'the renderer never stops — Scenes 2 and 3 will redraw a field that cannot change')
for (let i = 0; i <= 200; i++) {
  const p = at(i / 200)
  const changing =
    pressAt(p) < 1 || faceAt(p) < 1 || releaseAt(p) < 1 || settleAt(p) < 1 || spinAt(p) > 0
  ok(isMoving(p) === changing, `the still-frame gate disagrees with the curves at ${i / 200}`)
}
ok(scene1At(HOLD) === 1 && scene1At(0) === 0, 'Scene 1 does not span its own stretch')

// The geometry the beats stand on. None of these is tuning — each one is a
// relationship the press stops working at all without.
ok(PRESS_MIN_DEPTH < PRESS_DIST, 'stars at the plane fall under the guard and are never pressed')
ok(PRESS_MIN_DEPTH > 0, 'the press divides by a depth it has not bounded away from zero')
ok(RELEASE_SPREAD > 0, 'the ring has nowhere to disperse to and will stay a ring')
// The swap has to leave page 0 alone: the resting composition is protected,
// and the mipmapped sprite is part of it.
ok(SPRITE_SWAP_AT >= 0 && pressAt(0) <= SPRITE_SWAP_AT, 'the sprite swaps in the resting frame')
// One size for both layers is what makes the settled field read as a texture
// rather than two populations; it has to sit between the two authored sizes.
ok(SETTLED_POINT_SIZE > 0, 'the settled field has no size')

console.log('press: ok')
