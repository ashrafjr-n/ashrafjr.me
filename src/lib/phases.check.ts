/**
 * Self-check for the page -> transition map. Run it with `npm run check`.
 *
 * What it guards is the one property the three scenes' smoothness rests on:
 * the map's **slope** is continuous at both ends of the identity hold. A value
 * jump would be obvious on screen; a slope jump is the thing that is only felt
 * — the scatter travelling at full speed one frame and frozen the next — and
 * it is exactly what the linear version of Scene 1 used to do.
 */
import {
  HOLD,
  IDENTITY_FROM,
  IDENTITY_LEAD,
  IDENTITY_TO,
  MODEL_FROM,
  toTransition,
  toIdentity,
} from './phases.ts'

/** Deliberately not `node:assert` — that would drag `@types/node` in for one file. */
function ok(condition: boolean, what: string): void {
  if (!condition) throw new Error(what)
}

const FROM = IDENTITY_FROM
const TO = IDENTITY_TO
const h = 1e-6
const slope = (p: number): number => (toTransition(p + h) - toTransition(p)) / h

ok(toTransition(0) === 0, 'the top of the page is the start of the transition')
ok(Math.abs(toTransition(1) - 1) < 1e-9, 'the bottom of the page is the end of it')
ok(Math.abs(toTransition(FROM) - HOLD) < 1e-9, 'identity begins at the hold')
ok(Math.abs(toTransition(TO) - HOLD) < 1e-9, 'and ends there')

for (const boundary of [FROM, TO]) {
  const jump = Math.abs(slope(boundary - 2 * h) - slope(boundary + h))
  ok(jump < 0.01, `slope jumps by ${jump} at ${boundary} — the scenes will lurch`)
}

let previous = -1
for (let i = 0; i <= 2000; i++) {
  const value = toTransition(i / 2000)
  ok(value >= previous - 1e-12, `transition goes backwards at page ${i / 2000}`)
  previous = value
}

ok(toIdentity(0) === 0, 'identity has not started at the top of the page')
ok(toIdentity(1) === 1, 'and is over at the bottom')
ok(toIdentity(FROM - IDENTITY_LEAD) === 0, 'identity starts exactly at its lead')
ok(toIdentity(FROM - IDENTITY_LEAD + 1e-6) > 0, 'and has started just after it')

// The handover out of Scene 1. It used to be an overlap, closing a blank frame
// between the ring leaving and the next thing arriving — a gap that shipped
// twice. The dive replaced that gap with a beat that is *meant* to be empty:
// Scene 1 ends on the impact, and the black after it is what the statements
// arrive onto. So what is guarded here is the opposite of what it was — that
// nothing reaches back over the glass.
ok(IDENTITY_LEAD >= 0, 'identity never starts before the page does')
ok(toIdentity(FROM) === 0, 'the statements do not reach back over the impact')
ok(toIdentity(FROM + 1e-6) > 0, 'and start as soon as Scene 1 is over')
ok(MODEL_FROM >= FROM, 'the model never rises inside the tunnel')

console.log('phases: ok')
