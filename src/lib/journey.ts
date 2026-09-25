/**
 * The journey's length, and where its beats fall, in **screens of scroll**.
 *
 * Every beat on the page is placed in screens and converted to the 0..1
 * journey value with `at()`, so one stretch can be lengthened or shortened
 * without moving any other: the approach to the tunnel was shortened this way
 * and everything from the tunnel's mouth on kept exactly its pace.
 * `main.ts` sizes `.journey` from `JOURNEY_SCREENS` (plus the stuck screen).
 */
export const JOURNEY_SCREENS = 2.76

/** A place on the journey, in screens, as a 0..1 journey value. */
export function at(screens: number): number {
  return screens / JOURNEY_SCREENS
}

/** A beat from `from` for `span`, both in screens, as a `[from, span]` of the journey. */
export function beat(from: number, span: number): readonly [number, number] {
  return [at(from), at(span)]
}

/** The camera reaches the tunnel's mouth here, in screens. */
export const MOUTH_AT = 1.4
