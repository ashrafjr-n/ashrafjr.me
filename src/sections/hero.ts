/**
 * Hero + persistent overlays.
 *
 * In the depth system the Hero is just the index-0 depth item: its content
 * (name + tagline) is returned so main.ts can place it in the perspective world,
 * where it recedes INTO the distance as the camera flies past it.
 *
 * The HUD, scroll hint and cinematic layers are NOT depth items — they're fixed
 * full-screen overlays that stay put and are appended directly to the root.
 */

/** Small typed helper for building elements with class + innerHTML. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (html !== undefined) node.innerHTML = html
  return node
}

/** Cinematic full-screen overlay layers (scanlines, noise, vignette). */
function buildOverlays(): HTMLDivElement {
  const overlays = el('div', 'fx-overlays')
  overlays.append(
    el('div', 'fx-scanlines'),
    el('div', 'fx-noise'),
    el('div', 'fx-vignette'),
  )
  return overlays
}

/** Fixed corner HUD overlay. */
function buildHud(): HTMLDivElement {
  const hud = el('div', 'hud')
  hud.append(
    buildGithubBadge(),
    el('div', 'hud__item hud__tr', 'FPS <strong id="fps">60</strong>'),
    el('div', 'hud__item hud__bl', 'COORD <strong id="coord">000.000</strong>'),
    el('div', 'hud__item hud__br', '↓ scroll to enter'),
  )
  return hud
}

/** Top-left GitHub badge — icon + username, links out, re-enables pointer events. */
function buildGithubBadge(): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'hud__item hud__github'
  link.href = 'https://github.com/ashrafjr-n'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.setAttribute('aria-label', 'GitHub: ashrafjr-n')
  link.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.1 3.29 9.42 7.86 10.95.57.1.78-.25.78-.55
        0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69
        -1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96
        .1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1
        -.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 2.9-.39c.98 0 1.97.13
        2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.84 1.18
        3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17
        0 .3.2.66.79.55A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"/>
    </svg>
    <span>ashrafjr-n</span>
  `
  return link
}

/** Fixed bottom-center pulsing scroll hint. */
function buildScrollHint(): HTMLDivElement {
  const hint = el('div', 'hero__scroll-hint')
  hint.append(
    el('span', 'hero__scroll-label', 'SCROLL'),
    el('span', 'hero__scroll-line'),
  )
  return hint
}

/** The Hero content (name + tagline) — becomes the index-0 depth item. */
function buildHeroContent(): HTMLDivElement {
  const content = el('div', 'hero__content')
  content.append(
    el('h1', 'hero__name', 'ASHRAF'),
    el('p', 'hero__tagline', 'Software Engineer · AI Engineer'),
  )
  return content
}

export interface HeroParts {
  canvas: HTMLCanvasElement
  heroContent: HTMLDivElement
  scrollHint: HTMLDivElement
}

/**
 * Append the persistent fixed overlays (canvas, HUD, scroll hint, cinematic
 * layers) to `root`, and return the pieces main.ts needs — the WebGL canvas and
 * the Hero content (to register as depth item 0).
 */
export function initHero(root: HTMLElement = document.querySelector<HTMLDivElement>('#app')!): HeroParts {
  // Background WebGL canvas — fixed, full-screen, sits below everything else.
  const canvas = el('canvas')
  canvas.id = 'scene'

  const scrollHint = buildScrollHint()

  // Fixed overlays straight onto the root (not depth items).
  root.append(canvas, buildHud(), scrollHint, buildOverlays())

  return { canvas, heroContent: buildHeroContent(), scrollHint }
}
