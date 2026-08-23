/**
 * Scene 2 folder icon — an ASCII-art folder mark, used for both SYSTEM and
 * PROJECTS on tablets and desktop.
 *
 * It arrives one of two ways, decided by the caller once at startup:
 *  - **narrow** (the min-width: 768px row, below 4:3): `update()` types it in
 *    top to bottom once Scene 2 is reached, then holds — the same draw-once
 *    controller as the portrait (`lib/ascii-reveal.ts`), so the two read as
 *    one system.
 *  - **wide** (the flanking composition): `fill()` on load, and the star
 *    constellation assembles it on screen instead and cross-fades to it
 *    (`three/constellation.ts`), which is what `ready` is for.
 *
 * This module stays agnostic between them — it is the element, the file and
 * the speed, nothing more.
 */
import { createAsciiReveal, type AsciiReveal } from '../lib/ascii-reveal'

const FOLDER_SRC = '/assets/svg/folder.svg'

/**
 * How long the draw-in takes, in ms. Matches the file's own previous native
 * SMIL timing (86 lines at ~29.6ms each, ending at ~2545.6ms) — the file used
 * to just play that once on its own at load and freeze; now it's driven
 * manually so the same draw can wait for Scene 2, but the speed carries over
 * unchanged.
 */
const DRAW_MS = 2546

/** Every call gets its own id prefix — two instances share this one file. */
let instanceCount = 0

export interface FolderIcon {
  /** The element to put in the row. Empty until the artwork has loaded. */
  el: HTMLSpanElement
  /**
   * Advance the draw. `visible` comes from the row's own fade, so it only
   * starts once Scene 2 is on screen, and pauses (without rewinding) if
   * scrolled away before it finishes.
   */
  update: AsciiReveal['update']
  /** Show the artwork complete at once, instead of typing it in. */
  fill: AsciiReveal['fill']
  /** The injected `<svg>`, once it is in the page. */
  ready: AsciiReveal['ready']
}

/**
 * One folder mark. Purely decorative: the button it goes in supplies its own
 * accessible name via the visible label beside it, so this is `aria-hidden`.
 */
export function createFolderIcon(): FolderIcon {
  const el = document.createElement('span')
  el.className = 'scene2-folder-icon'
  el.setAttribute('aria-hidden', 'true')

  const reveal = createAsciiReveal(el, FOLDER_SRC, `folder-${instanceCount++}`, DRAW_MS)

  return { el, update: reveal.update, fill: reveal.fill, ready: reveal.ready }
}
