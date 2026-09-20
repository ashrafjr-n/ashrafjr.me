/**
 * Self-check for Scene 1's dive. Run it with `npm run check`.
 *
 * It guards three things, all of which fail silently on screen:
 *
 *  1. **Scene 1 at rest is untouched.** Every one of the dive's drivers has to
 *     be exactly 0 at the top of the page, or the opening composition — the
 *     ring with nothing inside it — is not what it was. That composition is
 *     protected, and the dive's whole claim to being allowed near the camera
 *     is that it writes nothing until the reader scrolls.
 *  2. **The sequence rewinds exactly.** Nothing in the dive may accumulate:
 *     scrolling down through the flight, the corridor, the glass and the dust
 *     and back up has to return every driver to the value it set out from. An
 *     angular *speed* that rose with scroll would pass every other test here
 *     and fail this one.
 *  3. **The beats are contiguous and the black at the end is real.** Identity
 *     arrives onto that black (`IDENTITY_LEAD` is 0), so it has to exist.
 */
import {
  DIVE_FROM,
  DIVE_TO,
  IMPACT_FROM,
  IMPACT_SPIN_STOP,
  IMPACT_TO,
  IMPACT_WAVE,
  SETTLE_FROM,
  SETTLE_TO,
  diveAt,
  impactAt,
  ringSwirlAt,
  scene1At,
  settleAt,
  tunnelFadeAt,
} from './dive.ts'
import { HOLD } from './phases.ts'

/** Deliberately not `node:assert` — that would drag `@types/node` in for one file. */
function ok(condition: boolean, what: string): void {
  if (!condition) throw new Error(what)
}

/** Every driver the dive has, sampled together. */
const drivers = { diveAt, impactAt, settleAt, ringSwirlAt, tunnelFadeAt }
type Driver = keyof typeof drivers

// 1. Nothing has started at the top of the page.
for (const name of Object.keys(drivers) as Driver[]) {
  ok(drivers[name](0) === 0, `${name} is not 0 at the top of the page — Scene 1's rest state moved`)
}

// 2. The sweep down and back. Sampled finely enough to catch a curve that
// drifts rather than one that jumps, and compared exactly: these are pure
// functions of one number, so anything but an exact match is accumulation.
const STEPS = 4000
for (const name of Object.keys(drivers) as Driver[]) {
  const down: number[] = []
  for (let i = 0; i <= STEPS; i++) down.push(drivers[name]((i / STEPS) * HOLD))
  for (let i = STEPS; i >= 0; i--) {
    const back = drivers[name]((i / STEPS) * HOLD)
    ok(back === down[i], `${name} does not rewind at ${i / STEPS} of Scene 1 — it accumulates`)
  }
  let previous = -Infinity
  for (const value of down) {
    ok(value >= previous - 1e-12 || name === 'tunnelFadeAt', `${name} goes backwards mid-scene`)
    previous = value
  }
}

// 3. The beats meet end to end, and the black after them is not empty.
ok(DIVE_FROM === 0, 'the flight begins on the first pixel of scroll')
ok(DIVE_TO === IMPACT_FROM, 'the camera stops at its fastest, on the glass — no coast between them')
ok(IMPACT_TO === SETTLE_FROM, 'the dust starts clearing as the last point lands')
ok(SETTLE_TO < 1, 'Scene 1 ends on black, which is what the statements arrive onto')

// The stop has to be read as an impact, so all rotation must be dead before
// even the nearest points have finished landing.
ok(IMPACT_SPIN_STOP < 1 - IMPACT_WAVE, 'rotation outlives the first landing — the stop will not read')
// And the wave has to be a wave: the furthest points land strictly after the
// nearest ones, or the corridor collapses as one sheet.
ok(IMPACT_WAVE > 0, 'the impact is simultaneous — it will read as a layer being switched off')
ok(IMPACT_WAVE < 1, 'the wave never finishes inside its own window')

// The corridor is only ever shown between the two: it is not in the resting
// composition, and it is gone before Scene 1 hands over.
ok(tunnelFadeAt(0) === 0, 'the corridor is in the resting frame')
ok(tunnelFadeAt(HOLD) === 0, 'the corridor is still on screen when identity arrives')
ok(tunnelFadeAt(HOLD * ((DIVE_TO + IMPACT_FROM) / 2)) > 0, 'the corridor is never shown at all')
// It is revealed by the flight, not announced before it: the camera has to be
// genuinely on its way before the well inside the ring becomes visible.
ok(tunnelFadeAt(HOLD * 0.1) === 0, 'the corridor gives itself away before the camera has moved')

// The wind-up is frozen by the glass and never resumes.
ok(
  ringSwirlAt(HOLD * IMPACT_FROM) === ringSwirlAt(HOLD),
  'the ring keeps winding on after it has been stopped',
)
ok(scene1At(HOLD) === 1 && scene1At(0) === 0, 'Scene 1 does not span its own stretch')

console.log('dive: ok')
