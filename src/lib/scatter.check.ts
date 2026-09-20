/**
 * Self-check for the scatter. Run it with `npm run check`.
 *
 * Three things, every one of which fails silently on screen:
 *
 *  1. **Scene 1's opening composition is untouched.** Every driver has to be
 *     exactly 0 at the top of the page, except the spin, which has to be
 *     exactly 1 — the ring is turning at full rate in the resting frame, and
 *     that frame is protected.
 *  2. **The sequence rewinds exactly.** Nothing may accumulate: scrolling down
 *     through the whole of Scene 1 and back up has to return every driver to
 *     the value it set out from. A wind-up written as a rotational *speed*
 *     rather than an angle would pass every other test here and fail this one.
 *  3. **Everything has finished, and is exactly pinned, once Scene 1 is
 *     over.** `three/scene.ts` skips its position pass on the strength of
 *     these values not changing, so a driver that crept by a float's width
 *     past the end of Scene 1 would redraw 20,600 points for the rest of the
 *     page and the gate would quietly buy nothing.
 */
import {
  REST_MAX,
  REST_MIN,
  SCATTER_END,
  SCATTER_TO,
  BOLD_SIZE_GAIN,
  SETTLE_TO,
  SCATTER_SPAN,
  SCATTER_STAGGER,
  SPIN_EASE,
  WAVE_SHARE,
  STILL_FROM,
  STILL_TO,
  SWIRL_TO,
  scatterAt,
  scene1At,
  settleAt,
  spinAt,
  swirlAt,
} from './scatter.ts'
import { HOLD } from './phases.ts'

/** Deliberately not `node:assert` — that would drag `@types/node` in for one file. */
function ok(condition: boolean, what: string): void {
  if (!condition) throw new Error(what)
}

const drivers = { swirlAt, scatterAt, settleAt }
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

// 3. Everything runs, overlaps, and is finished and pinned by the handover.
//
// **The overlap is the whole look**: the wind-up has to still be turning while
// the scatter is travelling, or the stars leave along straight radial lines
// instead of spiralling out. That was asked for explicitly.
ok(SWIRL_TO > 0 && SCATTER_TO > 0, 'the field does not move on scroll at all')
ok(STILL_FROM < SCATTER_TO, 'the orbit only starts dying after the scatter is over')
ok(SWIRL_TO > SCATTER_TO * 0.5, 'the wind-up ends too early — the scatter will read as straight lines')

for (const name of Object.keys(drivers) as Driver[]) {
  ok(drivers[name](HOLD) === 1, `${name} has not finished when Scene 1 hands over`)
}
ok(spinAt(HOLD) === 0, 'the field is still turning when the statements arrive')
ok(Math.max(SWIRL_TO, SCATTER_TO, STILL_TO, SETTLE_TO) <= 1, 'a driver runs past Scene 1')

const sample = (u: number): number[] => {
  const p = at(u)
  return [swirlAt(p), scatterAt(p), settleAt(p), spinAt(p)]
}
const constantOver = (from: number, to: number, what: string): void => {
  const first = sample(from)
  for (let i = 0; i <= 100; i++) {
    const got = sample(from + ((to - from) * i) / 100)
    ok(got.every((v, k) => v === first[k]), `${what}: a driver moves at ${from + (to - from) * (i / 100)}`)
  }
}
// Past the end of Scene 1, i.e. through the whole of Scenes 2 and 3.
constantOver(1, 1.5, 'a driver is still moving after Scene 1 has handed over')
ok(sample(0).join() !== sample(0.3).join(), 'nothing changes over the first third of Scene 1')

// **Where the stars come to rest, which is what the settled composition is.**
// The band they land in has to reach past the ring on both sides — short of
// that and the ring's own radius is still the busiest place in the frame —
// and it has to keep clear of the axis, where a star's orbit radius goes to
// zero and any number of them would stack into a knot in the middle of the
// screen. Both of those shipped and both were seen.
ok(REST_MIN > 0, 'stars settle on the spin axis itself — they will pile up in the centre')
ok(REST_MIN < 2.6, 'nothing settles inside the ring — its middle will read as a hole')
ok(REST_MAX > 2.8, 'nothing settles outside the ring — the ring itself will be the edge')
// The draw itself — even by area, not by radius — is `three/scene.ts`'s, and
// is not checkable from here without pulling Three in. The bounds above are
// what this file can hold.
ok(BOLD_SIZE_GAIN > 1, 'the stars are no heavier inside the white half — they will not read on it')

// **The stagger is what keeps the ring a ring.** Every star reading the same
// driver at the same moment is what made the first version dissolve into haze
// within a few percent of the page; these guard the shape of the fix.
ok(SCATTER_STAGGER > 0, 'every star lets go at once — the ring will not unravel, it will vanish')
ok(SCATTER_STAGGER < 1, 'the last star never lets go')
ok(Math.abs(SCATTER_SPAN - (1 - SCATTER_STAGGER)) < 1e-12, 'the span and the stagger disagree')
// The last star to be let go still has to finish inside the scatter's window.
ok(SCATTER_STAGGER + SCATTER_SPAN <= 1 + 1e-12, 'the slowest star is still travelling when Scene 1 ends')
ok(WAVE_SHARE > 0 && WAVE_SHARE < 1, 'the delay is all wave or all jitter — one reads mechanical, the other as noise')

// **The field has to come to rest, not be cut off.** A linear fall in the
// orbit's rate is still dropping at full clip the instant it reaches zero,
// which reads as the motion stopping rather than running out. The curve has to
// shed speed early and arrive with no slope left.
ok(SPIN_EASE > 1, 'the orbit stops on a corner instead of easing to rest')
const spinSlopeAtRest = (spinAt(HOLD) - spinAt(HOLD * 0.999)) / 0.001
ok(Math.abs(spinSlopeAtRest) < 0.02, `the orbit is still slowing hard as it stops (${spinSlopeAtRest})`)
ok(spinAt(at(0.5)) < 0.5, 'the orbit sheds most of its speed late — it should go early and then ease')
ok(scene1At(HOLD) === 1 && scene1At(0) === 0, 'Scene 1 does not span its own stretch')

// **The field stops inside Scene 1, and stops without a corner.** The old tail
// ran to the very end of the scene, which spent its last third creeping. Both
// halves of the replacement are checked here: that the stop lands where
// SCATTER_END says it does and leaves a still stretch after it, and that the
// driver arrives there with no slope left — the constants alone would clamp it
// while it was still travelling at most of full rate.
ok(SCATTER_END < 1, 'the scatter runs to the end of Scene 1 — there is no still frame to hand over on')
ok(scene1At(HOLD * SCATTER_END) === 1, 'the scatter does not finish where SCATTER_END says it does')
constantOver(SCATTER_END, 1, 'a driver is still moving after the field was meant to have stopped')
const stopSlope = (1 - scene1At(HOLD * (SCATTER_END - 0.001))) / 0.001
ok(stopSlope < 0.05, `the field is cut off rather than brought to rest (${stopSlope})`)

console.log('scatter: ok')
