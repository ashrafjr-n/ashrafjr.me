/**
 * Scene 2 folder icon — an ASCII-art folder mark, used for both SYSTEM and
 * PROJECTS on tablets and desktop. Inlined the same way the portrait is (see
 * ui/mark.ts): fetched and injected as markup, not an `<img>`, because the
 * file's internal hover rule (on its own `<g class="glyphs">`) can only be
 * reached that way.
 *
 * The file ships its own SMIL typewriter draw, the same technique as the
 * portrait's artwork, and it is deliberately left alone here rather than
 * taken over: two static icons flanking the row want to end up simply
 * fully-drawn, and running the built-in animation once and letting it freeze
 * (`fill="freeze"` on every line) is exactly that end state — no update loop
 * needed. It finishes in ~2.5s, long before a page-load visitor scrolls down
 * to Scene 2.
 *
 * Two independent instances share this one file; each call fetches and
 * injects its own copy, so their SMIL timelines (and the doubled inline
 * `<style>`) are independent but identical — harmless duplication, not a
 * bug.
 */
import { stripLightScheme } from '../lib/svg'

const FOLDER_SRC = '/assets/svg/folder.svg'

/**
 * One folder mark. Purely decorative: the button it goes in supplies its own
 * accessible name via the visible label beside it, so this is `aria-hidden`.
 */
export function createFolderIcon(): HTMLSpanElement {
  const el = document.createElement('span')
  el.className = 'scene2-folder-icon'
  el.setAttribute('aria-hidden', 'true')

  fetch(FOLDER_SRC)
    .then((res) => res.text())
    .then((svg) => {
      el.innerHTML = stripLightScheme(svg)
    })
    .catch((err) => console.error(`[folder] failed to load ${FOLDER_SRC}`, err))

  return el
}
