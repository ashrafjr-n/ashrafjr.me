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

/**
 * How wide a star draws, in CSS pixels per pixel of viewport height.
 *
 * **Matching the colour was not enough on its own, and this is why.** The
 * orbiting layers are in world space with `sizeAttenuation` on, so Three sizes
 * them as `size * 0.5 * drawingBufferHeight / distance`; the constellation is
 * in screen space with attenuation off, where `size` is already CSS pixels.
 * Two different units for the same thing, so nothing lines them up unless it
 * is done by hand — and the constellation's first size was set against the
 * artwork's glyph grid instead, which drew it at **2.36 CSS px against the
 * band's 1.06: 2.2x the width and 4.9x the area**. Additive blending stacks
 * area, so it read as glaring even once the colours matched exactly.
 *
 * The factor is the band's own attenuation solved out: `BAND_POINT_SIZE
 * (0.025) * 0.5 / the band's ~10-unit distance`, which leaves a plain
 * multiple of the viewport height. It is height-dependent because the
 * orbiting stars are — a taller window draws them larger, and these have to
 * follow. The device-pixel ratio cancels: Three multiplies an unattenuated
 * `size` by it, and divides the attenuated one by it through
 * `drawingBufferHeight`.
 *
 * **Re-derive it if `BAND_POINT_SIZE` or the band's radii change.** It is the
 * one number here that is a restatement of something in `scene.ts` rather than
 * a value `scene.ts` reads back.
 */
export const STAR_SIZE_PER_VH = 0.00125
