/**
 * How a star on this site is coloured.
 *
 * Its own module because two separate layers, in two separate scenes, have to
 * agree on it exactly: the ambient orbiting cloud in `scene.ts`, and the folder
 * constellations in `constellation.ts` that fly in during Scene 2. The whole
 * point of the constellations is that they read as *the site's own stars*
 * arriving and settling into a shape — so they cannot have a palette of their
 * own, and neither can drift from the other by being retuned alone.
 *
 * Same reasoning as `MODEL_SPIN_RATE` being exported from `world.ts` for the
 * starfield's speed tiers to be multiples of: where two things have to match,
 * the shared value lives in one place and both read it.
 *
 * Grayscale from pure white down to a slightly dimmer silver-white — no colour
 * tint, ever; the site's palette is white/black/silver only.
 *
 * Note this is deliberately **not** the close-in band's look. The band is
 * brighter and whiter on purpose (`BAND_BRIGHT_*`, `BAND_OPACITY`, and its
 * over-1 `BAND_CLEAR_LEVEL` subset), and those stay private to `scene.ts`:
 * they describe one specific ring around the model, not what a star looks
 * like.
 */
export const STAR_BRIGHT_MIN = 0.78
export const STAR_BRIGHT_MAX = 1.0
export const STAR_OPACITY = 0.85
