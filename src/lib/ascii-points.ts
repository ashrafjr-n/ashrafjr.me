/**
 * Read an ASCII-art SVG back as a point cloud — one point per character,
 * carrying the grey that character is drawn in.
 *
 * This is what lets the star constellation (`three/constellation.ts`) land on
 * the folder artwork exactly: the stars are not *near* the picture, each one
 * is aimed at a specific glyph's centre, so when the SVG cross-fades in
 * underneath there is nothing to line up. It works because of how these files
 * are generated (see `lib/ascii-reveal.ts` for the rest of that shape):
 *
 *   <text y="284.1" font-size="8.0">
 *     <tspan x="114.8" textLength="460.8" class="i">cccc…</tspan>
 *   </text>
 *
 * The face is monospace and every run's advance comes out at exactly
 * `textLength / length` (4.8 units per character in folder.svg, uniform across
 * all 3198 runs), so a character's centre is plain arithmetic. Nothing here
 * measures the DOM — no `getExtentOfChar`, no layout read — which keeps it
 * deterministic and cheap over the ~10k glyphs these files carry.
 */

/** A sampled character: viewBox coordinates, plus its own grey 0..1 (see RAMP). */
export interface GlyphPoint {
  x: number
  y: number
  level: number
}

/**
 * Where a glyph's ink sits above its baseline, as a fraction of the font size.
 *
 * The generator writes each line as a `<text>` on a baseline inside a 9.4-unit
 * clip band, with the baseline 5.9 units down that band. These files use only
 * mid-weight characters (`c * o + = #` and a few more), whose ink runs from the
 * baseline up to roughly the cap height, so the ink's centre lands about a
 * third of an em above the baseline. At the size this is drawn — one line is
 * ~2.2px on screen — a tenth of an em either way is under a fifth of a pixel.
 */
const GLYPH_CENTRE_LIFT = 0.32
const FALLBACK_FONT_SIZE = 8

/**
 * The generator's grey ramp: classes `a`..`m` run #3d3d3d to #ffffff in even
 * steps (the real steps alternate 16/17 per channel, which the linear fit here
 * reproduces to within 1/255). Anything unrecognised reads as full white.
 *
 * **Nothing reads `level` at the moment.** The constellation used to colour
 * each star by the glyph it was going to become, and that was dropped: the
 * stars have to look like the site's other stars, not like the artwork (see
 * the note at the top of `three/constellation.ts`). It is kept because it is a
 * real property of the data — reading an ASCII-art SVG back as points means
 * reading its shading too — and it costs one lookup per `<tspan>`, not per
 * glyph. Don't wire it back into star colour without re-reading why it went.
 */
const RAMP = 'abcdefghijklm'
const RAMP_MIN = 0x3d / 0xff

function levelOf(className: string | null): number {
  const i = className ? RAMP.indexOf(className) : -1
  if (i < 0) return 1
  return RAMP_MIN + (i * (1 - RAMP_MIN)) / (RAMP.length - 1)
}

/** One `<tspan>`, reduced to what a character's position needs. */
interface Run {
  x: number
  y: number
  advance: number
  level: number
  length: number
}

function readRuns(svg: SVGSVGElement): Run[] {
  const runs: Run[] = []
  for (const span of svg.querySelectorAll('tspan')) {
    const length = span.textContent?.length ?? 0
    if (!length) continue

    const x = Number(span.getAttribute('x'))
    const advance = Number(span.getAttribute('textLength')) / length
    const text = span.parentElement
    const baseline = Number(text?.getAttribute('y'))
    const fontSize = Number(text?.getAttribute('font-size')) || FALLBACK_FONT_SIZE
    if (!Number.isFinite(x) || !Number.isFinite(advance) || !Number.isFinite(baseline)) continue

    runs.push({
      x,
      y: baseline - fontSize * GLYPH_CENTRE_LIFT,
      advance,
      level: levelOf(span.getAttribute('class')),
      length,
    })
  }
  return runs
}

/**
 * Sample up to `count` characters, spread evenly over the artwork.
 *
 * The stride is uniform over document order rather than random, so coverage is
 * even by construction — a random draw clumps, and clumps read as holes in a
 * picture this dense. Document order is top-to-bottom, left-to-right, so an
 * even stride is an even sampling of the ink itself; these files emit no
 * spaces, so every character sampled is real ink.
 */
export function sampleGlyphPoints(svg: SVGSVGElement, count: number): GlyphPoint[] {
  const runs = readRuns(svg)
  let total = 0
  for (const run of runs) total += run.length
  if (!total || count <= 0) return []

  const wanted = Math.min(count, total)
  const stride = total / wanted
  const points: GlyphPoint[] = []

  // One walk over the runs, with the sample index chasing it — both sequences
  // only ever increase, so this stays linear rather than searching per sample.
  let seen = 0
  let next = 0
  for (const run of runs) {
    while (next < wanted) {
      const glyph = Math.floor(next * stride)
      if (glyph >= seen + run.length) break
      points.push({
        x: run.x + (glyph - seen + 0.5) * run.advance,
        y: run.y,
        level: run.level,
      })
      next++
    }
    seen += run.length
  }
  return points
}

/**
 * Project sampled points into CSS pixels, writing x/y into `out` as an xyz
 * triple per point (z untouched).
 *
 * Straight off `getScreenCTM()` — the browser's own viewBox-to-screen matrix,
 * so this cannot drift from where the artwork actually paints however the SVG
 * is sized or centred. Applied by hand rather than through `SVGPoint`, which
 * would allocate once per glyph.
 *
 * Returns the matrix's uniform scale (viewBox units per CSS pixel), which is
 * also what a caller should size a point by; **0 means the element is not
 * rendered** (`display: none`, or not in the document yet) and nothing was
 * written.
 */
export function toScreenPoints(
  svg: SVGSVGElement,
  points: GlyphPoint[],
  out: Float32Array,
): number {
  const m = svg.getScreenCTM()
  if (!m || !m.a) return 0

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    out[i * 3] = m.a * p.x + m.c * p.y + m.e
    out[i * 3 + 1] = m.b * p.x + m.d * p.y + m.f
  }
  return m.a
}
