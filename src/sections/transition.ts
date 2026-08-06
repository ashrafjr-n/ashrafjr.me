/**
 * "SELECTED WORK" transition — a brief depth item between Hero and the first
 * project. Not a real section: just a large centered label that flies past
 * quickly (shorter fade window than a project item), giving a beat of
 * breathing room before the work starts.
 */
import { registerSection } from '../lib/depth'

/** Narrower fade window than the default (1) so this passes by quickly. */
const FADE_SCALE = 0.5

/**
 * Build the transition depth item into `world` and register it with the
 * depth engine at `index` (between Hero and the first project).
 */
export function initTransition(world: HTMLElement, index: number): void {
  const item = document.createElement('div')
  item.className = 'depth-item depth-item--transition'

  const content = document.createElement('div')
  content.className = 'transition__content'
  content.innerHTML = `
    <h2 class="transition__title">Selected Work</h2>
  `

  item.append(content)
  world.append(item)
  registerSection(item, index, FADE_SCALE)
}
