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
  FLATTEN_TO,
  INWARD_MAX,
  INWARD_MIN,
  OUTWARD_MAX,
  OUTWARD_MIN,
  SCATTER_TO,
  SETTLED_POINT_SIZE,
  SETTLE_TO,
  SPRITE_SWAP_AT,
  STILL_FROM,
  STILL_TO,
  SWIRL_TO,
  flattenAt,
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

const drivers = { swirlAt, scatterAt, flattenAt, settleAt }
type Driver = keyof typeof drivers
const at = (u: number): number => u * HOLD

// 1. The resting frame.
for (const name of Object.keys(drivers) as Driver[]) {
  ok(drivers[name](0) === 0, `${name} is not 0 at the top of the page — Scene 1's rest state moved`)
}
ok(spinAt(0) === 1, 'the ring is not turning at full rate in the opening frame')
ok(SPRITE_SWAP_AT >= 0 && flattenAt(0) <= SPRITE_SWAP_AT, 'the sprite swaps in the resting frame')

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
ok(FLATTEN_TO <= SCATTER_TO, 'the field is still flattening after the scatter has arrived')

for (const name of Object.keys(drivers) as Driver[]) {
  ok(drivers[name](HOLD) === 1, `${name} has not finished when Scene 1 hands over`)
}
ok(spinAt(HOLD) === 0, 'the field is still turning when the statements arrive')
ok(Math.max(SWIRL_TO, SCATTER_TO, STILL_TO, FLATTEN_TO, SETTLE_TO) <= 1, 'a driver runs past Scene 1')

const sample = (u: number): number[] => {
  const p = at(u)
  return [swirlAt(p), scatterAt(p), flattenAt(p), settleAt(p), spinAt(p)]
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

// The scatter's two directions. The inner half has to travel far enough to
// actually cross the centre for most of its stars, or it reads as the ring
// shrinking rather than as stars passing through the middle.
ok(INWARD_MIN > 0 && OUTWARD_MIN > 0, 'a scatter direction has no travel')
ok(INWARD_MAX > 2.8, 'no inner star reaches the centre, let alone passes through it')
ok(INWARD_MIN < 2.6, 'every inner star crosses the centre — none of them stop short in it')
ok(OUTWARD_MAX > OUTWARD_MIN, 'every outer star travels exactly the same distance')
ok(SETTLED_POINT_SIZE > 0, 'the settled field has no size')
ok(scene1At(HOLD) === 1 && scene1At(0) === 0, 'Scene 1 does not span its own stretch')

console.log('scatter: ok')
