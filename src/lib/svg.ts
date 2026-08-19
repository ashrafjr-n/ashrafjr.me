/**
 * Cut a `prefers-color-scheme: light` block out of an inlined SVG's own
 * stylesheet.
 *
 * Inlined, that stylesheet is document-level: on a light-mode system it would
 * flip the artwork's greys to near-black on the site's black page. Shared by
 * every ASCII-art SVG that gets fetched and injected (see ui/mark.ts,
 * ui/folder.ts).
 */
export function stripLightScheme(svg: string): string {
  const at = svg.indexOf('@media(prefers-color-scheme:light){')
  if (at < 0) return svg
  let depth = 0
  for (let i = svg.indexOf('{', at); i < svg.length; i++) {
    if (svg[i] === '{') depth++
    else if (svg[i] === '}' && --depth === 0) return svg.slice(0, at) + svg.slice(i + 1)
  }
  return svg
}

/**
 * Rewrite every `id="..."` in an inlined SVG's markup, and every `url(#...)`
 * that references one, so this copy's ids can't collide with another
 * inlined copy on the same page.
 *
 * SVG ids resolve against the whole document, not scoped to their own
 * `<svg>` — so two of this project's ASCII-art files (or two instances of
 * the same one) that both number their clip-path ids `k0`, `k1`, `k2`... (as
 * this project's generator does) silently steal each other's clip rects the
 * moment both are inlined: `url(#k12)` resolves to whichever `id="k12"`
 * comes first in document order, not necessarily the one in the same file.
 * `prefix` should be unique per call site/instance.
 */
export function makeIdsUnique(svg: string, prefix: string): string {
  const ids = new Set<string>()
  for (const m of svg.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1])
  let out = svg
  for (const id of ids) {
    out = out.split(`id="${id}"`).join(`id="${prefix}-${id}"`)
    out = out.split(`url(#${id})`).join(`url(#${prefix}-${id})`)
  }
  return out
}
