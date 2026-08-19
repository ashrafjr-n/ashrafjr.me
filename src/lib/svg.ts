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
