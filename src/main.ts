import './style.css'
import { initScene } from './three/scene'
import { state, initPointer, initScroll } from './lib/state'

/**
 * Scroll progress at which the intro line has fully gone. It clears early in
 * the transition so it is never left hanging over Scene 2.
 */
const INTRO_FADE_END = 0.28
/** How far the line drifts upward as it goes, in px. */
const INTRO_DRIFT = 70

/**
 * Scroll progress at which the Scene 2 cards start appearing. They belong to
 * Scene 2 only, so they stay fully invisible through Scene 1 and the bulk of
 * the transition and are only there once the camera has settled.
 */
const CARDS_FADE_START = 0.82

/* ---------------------------------------------------------------------------
 * Social icons
 *
 * Each one is circular *in the artwork*: a full-bleed disc whose viewBox is
 * cropped to the disc's own bounds, so all three paint the same circle inside
 * the same 26px box. There is no CSS circle behind them and there must not be
 * one — see the .social-icon rule in style.css. Colours are pure black/white
 * only; brand colours were tried and reverted.
 * ------------------------------------------------------------------------ */

/** GitHub's modern Invertocat (Simple Icons), black on a white disc. */
const GITHUB_ICON = `
  <svg class="social-icon" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="16" fill="#ffffff"/>
    <g transform="translate(5.2 5.2) scale(0.9)">
      <path fill="#000000" d="M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </g>
  </svg>
`

/**
 * LinkedIn's circular badge (Entypo Social `linkedin-with-circle`) filled
 * white. Its "in" is a knockout in that path, so the black circle behind is
 * what shows through the letters — explicit rather than relying on the page
 * black, so the starfield can never show through them.
 */
const LINKEDIN_ICON = `
  <svg class="social-icon" viewBox="0.4 0.4 19.2 19.2" aria-hidden="true">
    <circle cx="10" cy="10" r="9.6" fill="#000000"/>
    <path fill="#ffffff" d="M10 .4C4.698.4.4 4.698.4 10s4.298 9.6 9.6 9.6s9.6-4.298 9.6-9.6S15.302.4 10 .4M7.65 13.979H5.706V7.723H7.65zm-.984-7.024c-.614 0-1.011-.435-1.011-.973c0-.549.409-.971 1.036-.971s1.011.422 1.023.971c0 .538-.396.973-1.048.973m8.084 7.024h-1.944v-3.467c0-.807-.282-1.355-.985-1.355c-.537 0-.856.371-.997.728c-.052.127-.065.307-.065.486v3.607H8.814v-4.26c0-.781-.025-1.434-.051-1.996h1.689l.089.869h.039c.256-.408.883-1.01 1.932-1.01c1.279 0 2.238.857 2.238 2.699z"/>
  </svg>
`

/**
 * The Gmail mark on a white disc, its five brand colours flattened to one
 * black. The five shapes do not overlap, so flattening them keeps the "M"
 * readable rather than filling in as a blob.
 */
const EMAIL_ICON = `
  <svg class="social-icon" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="24" fill="#ffffff"/>
    <g transform="translate(11 14.2) scale(0.1016)" fill="#000000">
      <path d="M58.182 192.05V93.14L27.507 65.077L0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z"/>
      <path d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837l-27.026 25.798z"/>
      <path d="m58.182 93.14l-4.174-38.647l4.174-36.989L128 69.868l69.818-52.364l4.669 34.992l-4.669 40.644L128 145.504z"/>
      <path d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945z"/>
      <path d="m0 49.504l26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23z"/>
    </g>
  </svg>
`

interface SocialLink {
  href: string
  /** Accessible name; the icons themselves are aria-hidden. */
  label: string
  /** Inline SVG markup for the circular icon. */
  icon: string
  /** Visible caption. Omitted on the icon-only links. */
  text?: string
}

/** Top-left social icon row, in render order. */
const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://github.com/ashrafjr-n',
    label: 'GitHub: ashrafjr-n',
    icon: GITHUB_ICON,
    text: 'ashrafjr-n',
  },
  {
    href: 'https://www.linkedin.com/in/ashraf-al-jarabeah-a94509408/',
    label: 'LinkedIn',
    icon: LINKEDIN_ICON,
  },
  {
    href: 'mailto:aannaelj@gmail.com',
    label: 'Email',
    icon: EMAIL_ICON,
  },
]

/** One social link. All three share the `.social-badge` class and its hover. */
function buildSocialLink({ href, label, icon, text }: SocialLink): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'social-badge'
  link.href = href
  link.setAttribute('aria-label', label)
  // mailto: has nowhere to open a tab; the two outbound links do.
  if (!href.startsWith('mailto:')) {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
  link.innerHTML = text ? `${icon}<span>${text}</span>` : icon
  return link
}

function buildSocialBadges(): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'social-badges'
  for (const item of SOCIAL_LINKS) wrap.append(buildSocialLink(item))
  return wrap
}

/** Scene 1 intro line, centred near the top of the viewport above the model. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
}

/** How many cards sit in the Scene 2 row. They share one outer boundary. */
const SCENE2_CARD_COUNT = 2

/** The starfield the right card is a window onto. Planets are separate layers. */
const REVEAL_IMAGE_SRC = '/assets/projects/projects-background.png'
/**
 * The planets scattered over the open window, back to front.
 *
 * `x`/`y` are the planet's centre as a percentage of the window and `w` its
 * width in vw — both deliberately uneven, so the field reads as a composition
 * rather than a grid, and clear of the badges (top-left) and close button
 * (top-right). `depth` is how far it counter-moves at full mouse deflection,
 * in px, and comes from REVEAL_TIER.
 */
interface PlanetSpec {
  src: string
  x: number
  y: number
  w: number
  depth: number
}

/**
 * Three depth planes, in px of travel at full mouse deflection.
 *
 * The planets are grouped rather than each given its own rate: six distinct
 * rates read as six stickers sliding over one another, where a few shared
 * planes read as one space seen through a window. Inside a plane the planets
 * differ by a couple of px only — enough that the plane is not a flat cutout.
 * Keep the gap between planes well above the spread inside one.
 */
const REVEAL_TIER = { far: 34, mid: 52, near: 76 }

const REVEAL_PLANETS: PlanetSpec[] = [
  { src: 'three.png', x: 86, y: 52, w: 6, depth: REVEAL_TIER.far - 2 },
  { src: 'two.png', x: 60, y: 72, w: 8, depth: REVEAL_TIER.far + 2 },
  { src: 'one.png', x: 44, y: 30, w: 11, depth: REVEAL_TIER.mid - 3 },
  { src: 'four.png', x: 30, y: 84, w: 14, depth: REVEAL_TIER.mid + 3 },
  { src: 'black.png', x: 72, y: 26, w: 20, depth: REVEAL_TIER.near - 3 },
  { src: 'white.png', x: 18, y: 62, w: 26, depth: REVEAL_TIER.near + 3 },
]

/**
 * The backdrop's own counter-movement, in px. Well below every planet plane —
 * it is the farthest thing in the frame — and far inside the overhang --img-w
 * leaves past the viewport, so no pointer position can pull an edge into view.
 */
const REVEAL_BACKDROP_DEPTH = 18
/** Vertical counter-movement as a fraction of the horizontal, kept subtler. */
const REVEAL_PARALLAX_Y = 0.55
/** Per-frame approach rate of every parallax layer toward its target. */
const REVEAL_PARALLAX_LERP = 0.07
/**
 * How long after opening the parallax starts, in ms. Matches --reveal-duration
 * in style.css: the field only responds once the window has finished growing.
 */
const REVEAL_OPEN_MS = 620

/** Widest tilt of the image under the mouse, in degrees, either side of centre. */
const REVEAL_TILT_MAX = 5
/** Per-frame approach rate of the tilt toward its target — damped, not jumpy. */
const REVEAL_TILT_LERP = 0.12
/**
 * Fade fraction above which the window accepts input. The row is still
 * arriving below that, so the window is inert (and untouchable) until Scene 2
 * has effectively landed.
 */
const REVEAL_ACTIVE_AT = 0.9

/**
 * The reveal window: a fixed-position mask that sits exactly on the right card
 * and holds an image far larger than itself. Kept out of the row because the
 * card is a flex item and could not fly out to the corner; the CSS derives its
 * closed geometry from the row's tokens so the two line up.
 */
function buildRevealWindow(): {
  root: HTMLDivElement
  image: HTMLImageElement
  planets: HTMLImageElement[]
  close: HTMLButtonElement
} {
  const root = document.createElement('div')
  root.className = 'reveal-window'
  root.setAttribute('role', 'button')
  root.tabIndex = 0
  root.setAttribute('aria-label', 'Open project preview')
  root.setAttribute('aria-expanded', 'false')

  const image = document.createElement('img')
  image.className = 'reveal-image'
  image.src = REVEAL_IMAGE_SRC
  image.alt = ''
  image.draggable = false

  // Scattered over the backdrop, in the array's order so the listed depth order
  // is also the paint order. Only shown once the window is open.
  const planets = REVEAL_PLANETS.map((spec) => {
    const planet = document.createElement('img')
    planet.className = 'reveal-planet'
    planet.src = `/assets/projects/${spec.src}`
    planet.alt = ''
    planet.draggable = false
    planet.style.left = `${spec.x}%`
    planet.style.top = `${spec.y}%`
    planet.style.width = `${spec.w}vw`
    return planet
  })

  const close = document.createElement('button')
  close.className = 'reveal-close'
  close.type = 'button'
  close.setAttribute('aria-label', 'Close project preview')
  close.textContent = '×'

  root.append(image, ...planets, close)
  return { root, image, planets, close }
}

/**
 * Scene 2 card row: bottom-centre, below the model in the levelled Scene 2
 * view. The cards are flush — one white boundary around the pair and a single
 * white line between them, so they read as one wide rectangle split in two.
 * Empty for now.
 */
function buildScene2Cards(): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'scene2-cards'
  for (let i = 0; i < SCENE2_CARD_COUNT; i++) {
    const card = document.createElement('div')
    card.className = 'scene2-card'
    row.append(card)
  }
  return row
}

// --- Mount ---
const app = document.querySelector<HTMLDivElement>('#app')!

/** Background WebGL canvas — fixed, full-screen, sits below everything else. */
const canvas = document.createElement('canvas')
canvas.id = 'scene'

const intro = buildIntro()
const scene2Cards = buildScene2Cards()
const reveal = buildRevealWindow()
/** The card the reveal window sits on: the last one in the row. */
const revealCard = scene2Cards.lastElementChild as HTMLDivElement
app.append(canvas, intro, scene2Cards, reveal.root, buildSocialBadges())

// --- Starfield + model, and the input they read ---
const scene = initScene(canvas)
window.addEventListener('resize', () => scene.resize())

initPointer()
initScroll()

let introShown = -1
let cardsShown = -1

/** Fade and lift the intro line, driven by the same progress as the scene. */
function updateIntro(progress: number): void {
  const t = Math.min(progress / INTRO_FADE_END, 1)
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, ${-t * INTRO_DRIFT}px)`
}

/**
 * Fade the Scene 2 cards in, off the same progress as everything else. The
 * reveal window rides the same value — it is a separate element, so it has to
 * be faded and gated by hand rather than inheriting the row's opacity.
 */
function updateScene2Cards(progress: number): void {
  const t = Math.min(Math.max((progress - CARDS_FADE_START) / (1 - CARDS_FADE_START), 0), 1)
  if (Math.abs(t - cardsShown) < 0.002) return // skip redundant style writes
  cardsShown = t
  scene2Cards.style.opacity = String(t)
  reveal.root.style.opacity = String(t)

  const active = t > REVEAL_ACTIVE_AT
  reveal.root.style.pointerEvents = active ? 'auto' : 'none'
  scene2Cards.classList.toggle('is-live', active) // lets the cards take hover
  // Scrolling back toward Scene 1 puts it away rather than leaving an open
  // preview fading over the transition.
  if (!active && isRevealOpen) closeReveal()
}

// --- Reveal window: click to open, mouse tilt while closed, parallax while open ---
let isRevealOpen = false
let tilt = 0
let tiltTarget = 0
let tiltWritten = 0

/**
 * One parallax layer. `x`/`y` are its current offset in px, `wx`/`wy` the last
 * pair written to the DOM. The backdrop also carries the closed-state tilt, so
 * its transform has to be composed rather than just set.
 */
interface ParallaxLayer {
  el: HTMLElement
  depth: number
  isBackdrop: boolean
  x: number
  y: number
  wx: number
  wy: number
}

const parallaxLayers: ParallaxLayer[] = [
  { el: reveal.image, depth: REVEAL_BACKDROP_DEPTH, isBackdrop: true, x: 0, y: 0, wx: 0, wy: 0 },
  ...reveal.planets.map((el, i) => ({
    el,
    depth: REVEAL_PLANETS[i].depth,
    isBackdrop: false,
    x: 0,
    y: 0,
    wx: 0,
    wy: 0,
  })),
]

/** True only once the window has finished growing; the mouse is ignored until then. */
let isParallaxLive = false
let parallaxTimer = 0

function openReveal(): void {
  if (isRevealOpen) return
  isRevealOpen = true
  reveal.root.classList.add('is-open')
  reveal.root.setAttribute('aria-expanded', 'true')
  tiltTarget = 0 // the tilt is a closed-state affordance only
  setRevealCardHover(false) // don't leave the card lifted under a full-screen window
  // Hand over to the parallax only when the window is actually full-screen.
  clearTimeout(parallaxTimer)
  parallaxTimer = window.setTimeout(() => {
    isParallaxLive = true
  }, REVEAL_OPEN_MS)
}

function closeReveal(): void {
  if (!isRevealOpen) return
  isRevealOpen = false
  reveal.root.classList.remove('is-open')
  reveal.root.setAttribute('aria-expanded', 'false')
  // Stop reading the mouse at once; the layers damp back to rest from wherever
  // they are and their transforms are dropped entirely once they get there.
  clearTimeout(parallaxTimer)
  isParallaxLive = false
}

reveal.root.addEventListener('click', () => {
  if (!isRevealOpen) openReveal()
})

reveal.close.addEventListener('click', (e) => {
  e.stopPropagation() // don't let it read as a click on the window itself
  closeReveal()
})

// Click-away and Escape, the two patterns expected of an expanded preview. One
// permanent listener each: the opening click's target is inside the window, so
// it can never close what it just opened.
document.addEventListener('click', (e) => {
  if (isRevealOpen && !reveal.root.contains(e.target as Node)) closeReveal()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeReveal()
})

// Keyboard equivalent of the click, since the window is a focusable control.
reveal.root.addEventListener('keydown', (e) => {
  if (isRevealOpen || (e.key !== 'Enter' && e.key !== ' ')) return
  e.preventDefault() // Space would otherwise scroll the page
  openReveal()
})

reveal.root.addEventListener(
  'mousemove',
  (e) => {
    if (isRevealOpen) return
    const rect = reveal.root.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1 // -1 left .. 1 right
    tiltTarget = Math.min(Math.max(nx, -1), 1) * REVEAL_TILT_MAX
  },
  { passive: true },
)
reveal.root.addEventListener('mouseleave', () => {
  tiltTarget = 0
  setRevealCardHover(false)
})

/**
 * The right card and the window over it grow together, but they are separate
 * subtrees. The card is left inert (see the pointer-events rule in style.css),
 * so the window's own hover is the single source for both.
 */
function setRevealCardHover(on: boolean): void {
  revealCard.classList.toggle('is-hovered', on)
  reveal.root.classList.toggle('is-hovered', on)
}

reveal.root.addEventListener('mouseenter', () => {
  if (!isRevealOpen) setRevealCardHover(true)
})

/**
 * Damp both of the window's motions and write them out.
 *
 * - the closed-state tilt: a pure rotation of the backdrop about a fixed pivot,
 *   so it can never disturb the crop the mask is showing.
 * - the open-state parallax: every layer counter-moves against the mouse, by
 *   its own `depth`. Opposite, because the camera is fixed and only its facing
 *   changes — turn your head right and the world slides left — and per-layer,
 *   so the near planets outrun the far ones and the backdrop barely stirs.
 *
 * Both settle to exact zero, at which point the inline transform is dropped so
 * nothing is left applied to a closed window.
 */
function updateRevealMotion(): void {
  tilt += (tiltTarget - tilt) * REVEAL_TILT_LERP
  if (tiltTarget === 0 && Math.abs(tilt) < 0.005) tilt = 0
  const tiltChanged = Math.abs(tilt - tiltWritten) >= 0.005
  if (tiltChanged) tiltWritten = tilt

  // Zeroed while closed, so a mouse move outside the open state moves nothing.
  const mx = isParallaxLive ? state.mouseX : 0
  const my = isParallaxLive ? state.mouseY : 0

  for (const layer of parallaxLayers) {
    layer.x += (-mx * layer.depth - layer.x) * REVEAL_PARALLAX_LERP
    layer.y += (-my * layer.depth * REVEAL_PARALLAX_Y - layer.y) * REVEAL_PARALLAX_LERP
    if (!isParallaxLive && Math.abs(layer.x) < 0.05 && Math.abs(layer.y) < 0.05) {
      layer.x = 0
      layer.y = 0
    }

    const moved = Math.abs(layer.x - layer.wx) >= 0.05 || Math.abs(layer.y - layer.wy) >= 0.05
    if (!moved && !(layer.isBackdrop && tiltChanged)) continue // skip redundant writes
    layer.wx = layer.x
    layer.wy = layer.y

    const still = layer.x === 0 && layer.y === 0
    if (layer.isBackdrop) {
      layer.el.style.transform =
        still && tilt === 0
          ? ''
          : `translate3d(${layer.x.toFixed(2)}px, ${layer.y.toFixed(2)}px, 0)` +
            ` perspective(1400px) rotateY(${tilt.toFixed(2)}deg)`
    } else {
      layer.el.style.transform = still
        ? ''
        : `translate3d(${layer.x.toFixed(2)}px, ${layer.y.toFixed(2)}px, 0)`
    }
  }
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
function raf(time: number) {
  const progress = scene.update(time, state)
  updateIntro(progress)
  updateScene2Cards(progress)
  updateRevealMotion()
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
