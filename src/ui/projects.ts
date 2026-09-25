/**
 * The projects, behind a portal — after mohitvirli.github.io's GridTile.
 *
 * At the end of the journey one large tile sits under PROJECTS: a black face
 * (the world it opens onto) with the screenshots floating in it. On hover the
 * face lifts, a grey box with white edges comes out behind it and the tile's
 * title fades in. Pressed, the black **opens out of the tile to fill the
 * screen** (0.5s, as the portal's blend there), a close cross turns in over a
 * second from -180°, and the projects are inside: one column that alternates
 * sides — first on the right, second on the left, and so on — under an
 * ordinary scroll of its own. The cross or Escape folds it back into the tile
 * (1s).
 *
 * Each row slides in from its own side as it scrolls into view. On hover the
 * card's stack unfolds under its name, pill by pill, and a short note on the
 * project appears in the empty half beside it.
 *
 * Each card turns so **the side the pointer is on comes toward the viewer**: a
 * pointer on the right brings the right edge forward, one near the bottom
 * brings the bottom forward. It is a CSS transform written through two custom
 * properties, with the transition doing the smoothing — no loop of its own.
 *
 * Over a card the pointer becomes a translucent silver disc reading
 * "View <name>", grown out of a point. Fine pointers only.
 */

import { range, smoother } from '../lib/math'

interface Project {
  name: string
  url: string
  /** Path under `public/`. */
  image: string
  /** Two to four lines, shown in the empty side beside the card on hover. */
  about: string
  /** Everything it is built with, in any number — shown as pills on hover. */
  stack: string[]
  inProgress?: boolean
}

const PROJECTS: Project[] = [
  {
    name: 'Vecto',
    url: 'https://vecto.aannaelj.workers.dev/',
    image: '/assets/projects/Vecto.png',
    about:
      'A personal project in full-stack engineering, data analysis and AI-assisted workflows. It reads a dataset before you train on it — quality, relationships, target signal — entirely in the browser.',
    stack: [
      'React',
      'React Router',
      'Tailwind CSS',
      'Framer Motion',
      'Papa Parse',
      'Vite',
      'Cloudflare Workers',
      'Cloudflare D1',
    ],
  },
  {
    name: 'REJOX',
    url: 'https://github.com/ashrafjr-n/REJOX',
    image: '/assets/projects/REJOX.png',
    about:
      'Moves React web projects to React Native. Rules do the work rules can do; AI is kept for what genuinely needs reasoning. Compiler tooling, backend systems and applied AI.',
    stack: [
      'TypeScript',
      'React',
      'Vite',
      'Tailwind CSS',
      'Zustand',
      'React Flow',
      'Three.js',
      'GSAP',
      'Framer Motion',
      'Python',
      'FastAPI',
      'Pydantic',
      'ts-morph',
      'Gemini',
      'Redis',
      'RQ',
      'Docker',
      'Playwright',
    ],
    inProgress: true,
  },
  {
    name: 'TTU Clinic',
    url: 'https://ttu-7oji.onrender.com/',
    image: '/assets/projects/TTU.png',
    about:
      'A clinic system for a university — booking, visit records, medication stock and oversight across four roles, in Arabic and English. Full-stack web engineering.',
    stack: [
      'PHP',
      'Laravel',
      'Blade',
      'Tailwind CSS',
      'Alpine.js',
      'Chart.js',
      'PostgreSQL',
      'Groq',
      'Vite',
      'Docker',
    ],
  },
  {
    name: 'Edenic World',
    url: 'https://edenic-wrold.vercel.app/',
    image: '/assets/projects/Edenic-World.png',
    about:
      "A home for a children's brand — songs, learning stages and small browser games in one place. Full-stack web and game development.",
    stack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Prisma', 'PostgreSQL', 'Phaser', 'Vercel'],
    inProgress: true,
  },
]

// Lucide icons (ISC), stroked in currentColor.
const lucide = (paths: string): string =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
const WEBSITE = lucide('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>')
const GITHUB = lucide(
  '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
)

/** Largest tilt at the card's edges, in degrees. */
const TILT_Y = 7
const TILT_X = 5

/** A repo gets GitHub's mark, anything else is a website. Read off the URL. */
const isRepo = (url: string): boolean => new URL(url).hostname === 'github.com'

function buildProject(project: Project, index: number): HTMLLIElement {
  const item = document.createElement('li')
  // First on the right, then alternating.
  item.className = `project ${index % 2 === 0 ? 'project--right' : 'project--left'}`

  const card = document.createElement('a')
  card.className = 'project-card'
  card.href = project.url
  card.target = '_blank'
  card.rel = 'noopener noreferrer'
  card.dataset.name = project.name

  const media = document.createElement('div')
  media.className = 'project-media'
  const img = document.createElement('img')
  img.src = project.image
  img.alt = `${project.name} preview`
  img.loading = 'lazy'
  img.decoding = 'async'
  media.append(img)

  const meta = document.createElement('div')
  meta.className = 'project-meta'
  const head = document.createElement('div')
  head.className = 'project-head'
  const title = document.createElement('h3')
  title.className = 'project-name'
  title.textContent = project.name
  head.append(title)
  if (project.inProgress) {
    const status = document.createElement('span')
    status.className = 'project-status'
    // The dot pulses, so it reads as live work rather than a label.
    status.innerHTML = '<span class="project-status-dot" aria-hidden="true"></span>In progress'
    head.append(status)
  }
  const icon = document.createElement('span')
  icon.className = 'project-icon'
  icon.innerHTML = isRepo(project.url) ? GITHUB : WEBSITE
  head.append(icon)

  // Three levels so the row can unfold from nothing: the grid animates its one
  // track from 0fr to 1fr, and the clip is what hides the list's own spacing
  // while it is closed.
  const stack = document.createElement('div')
  stack.className = 'project-stack'
  const clip = document.createElement('div')
  clip.className = 'project-stack-clip'
  const pills = document.createElement('ul')
  pills.setAttribute('aria-label', 'Built with')
  project.stack.forEach((tech, i) => {
    const pill = document.createElement('li')
    pill.textContent = tech
    // Each pill arrives a beat after the one before it.
    pill.style.setProperty('--i', String(i))
    pills.append(pill)
  })
  clip.append(pills)
  stack.append(clip)
  meta.append(head, stack)
  card.setAttribute(
    'aria-label',
    `${project.name}${project.inProgress ? ', in progress' : ''} — ${isRepo(project.url) ? 'GitHub repository' : 'website'}`,
  )

  card.append(media, meta)

  // A sibling of the card, not inside it: it sits in the empty half of the
  // row, so it must not tilt with the card or become part of the link.
  const about = document.createElement('p')
  about.className = 'project-about'
  about.textContent = project.about

  item.append(card, about)
  return item
}

/** Tilt a card toward the pointer: the side it is on comes forward. */
function bindTilt(card: HTMLElement): void {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect()
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1
    card.style.setProperty('--tilt-y', `${(-nx * TILT_Y).toFixed(2)}deg`)
    card.style.setProperty('--tilt-x', `${(ny * TILT_X).toFixed(2)}deg`)
    card.style.setProperty('--shift-x', `${(-nx * 1.2).toFixed(2)}%`)
    card.style.setProperty('--shift-y', `${(-ny * 1.2).toFixed(2)}%`)
  })
  card.addEventListener('pointerleave', () => {
    for (const p of ['--tilt-x', '--tilt-y', '--shift-x', '--shift-y']) card.style.removeProperty(p)
  })
}

const CLOSE_LABEL = 'Close projects'
/** The tile's own title, shown on hover — two lines, like the reference's. */
const TILE_TITLE = 'SELECTED WORK'
/**
 * The tile's entrance, as the reference's: there the camera pulls back as the
 * tiles come in (z 5 → 15 over the last stretch, damped λ 7), so a tile
 * arrives from right up against the lens and settles into place. Here it
 * starts `PULL` times its size and recedes, over `TILE_IN` of the journey,
 * chased at that same λ.
 */
const TILE_IN = [0.84, 0.16] as const
const PULL = 1.6
const LAMBDA = 7

export interface Projects {
  /** The tile, for the journey's stage. */
  tile: HTMLButtonElement
  /** Bring the tile in off the journey. */
  update(p: number, delta: number): void
  /** The one element the page's scroll lock has to leave scrollable. */
  scroller: HTMLElement
}

/**
 * Mount the section into `parent` and build the tile. `onOpenChange` is told
 * at the start of every open and close — `main.ts` freezes the page behind it
 * on that.
 */
export function createProjects(
  parent: HTMLElement,
  onOpenChange: (open: boolean) => void,
  /** Siblings that stay live over the section — the social badges. */
  keepLive: Element[] = [],
): Projects {
  // --- The tile ---
  const tile = document.createElement('button')
  tile.type = 'button'
  tile.className = 'tile'
  tile.setAttribute('aria-label', 'Open projects')
  const preview = PROJECTS.map((p) => `<img src="${p.image}" alt="" decoding="async" loading="lazy">`).join('')
  tile.innerHTML =
    '<span class="tile-box" aria-hidden="true"></span>' +
    `<span class="tile-face" aria-hidden="true"><span class="tile-preview">${preview}</span></span>` +
    `<span class="tile-title" aria-hidden="true">${TILE_TITLE}</span>`
  const face = tile.querySelector<HTMLElement>('.tile-preview')!

  // --- The section ---
  const root = document.createElement('section')
  root.className = 'projects'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-label', 'Projects')

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'projects-close'
  close.setAttribute('aria-label', CLOSE_LABEL)

  // The scroller is separate from the section so the cross can sit still over
  // it while the list scrolls.
  const scroller = document.createElement('div')
  scroller.className = 'projects-scroller'
  scroller.tabIndex = -1
  const list = document.createElement('ol')
  list.className = 'projects-list'
  list.append(...PROJECTS.map(buildProject))
  scroller.append(list)
  // The pointer over a card: a silver disc that grows out of a point and
  // reads "View <name>". It replaces the system cursor on the cards only.
  const view = document.createElement('div')
  view.className = 'projects-cursor'
  view.setAttribute('aria-hidden', 'true')
  const viewName = document.createElement('strong')
  view.innerHTML = '<span>View</span>'
  view.append(viewName)

  root.append(scroller, close, view)
  parent.append(root)

  const cards = [...list.querySelectorAll<HTMLElement>('.project-card')]
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (finePointer) {
    // Gated from here, not the stylesheet, so a failed script keeps the
    // system cursor over the cards.
    root.classList.add('has-view-cursor')
    root.addEventListener(
      'pointermove',
      (e) => {
        view.style.translate = `${e.clientX}px ${e.clientY}px`
      },
      { passive: true },
    )
    for (const card of cards) {
      card.addEventListener('pointerenter', () => {
        viewName.textContent = card.dataset.name ?? ''
        view.classList.add('is-on')
      })
      card.addEventListener('pointerleave', () => view.classList.remove('is-on'))
    }
    if (!REDUCED_MOTION.matches) {
      for (const card of cards) bindTilt(card)
      // The tile's face is a window: what is inside it drifts against the
      // pointer, a little, so it reads as depth behind the frame.
      tile.addEventListener('pointermove', (e) => {
        const r = tile.getBoundingClientRect()
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1
        face.style.translate = `${(-nx * 3).toFixed(2)}% ${(-ny * 3).toFixed(2)}%`
      })
      tile.addEventListener('pointerleave', () => face.style.removeProperty('translate'))
    }
  }

  // Each row slides in from its own side the first time it scrolls into view,
  // and again on every open.
  const items = [...list.children] as HTMLElement[]
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        reveal.unobserve(entry.target)
      }
    },
    { root: scroller, rootMargin: '0px 0px -12% 0px' },
  )

  let isOpen = false

  /** Everything else in `parent` is taken out of reach while it is open. */
  function setOthersInert(inert: boolean): void {
    for (const el of parent.children) {
      if (el !== root && !keepLive.includes(el)) (el as HTMLElement).inert = inert
    }
  }

  /** The tile's box as a clip on the full-screen section. */
  function tileClip(): string {
    const r = tile.getBoundingClientRect()
    return `inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px)`
  }

  function open(): void {
    if (isOpen) return
    isOpen = true
    scroller.scrollTop = 0
    // Every row back to its hidden start **instantly**, so none is seen
    // sliding away from the last visit while the portal opens.
    for (const item of items) {
      item.style.transition = 'none'
      item.classList.remove('is-in')
      reveal.unobserve(item)
    }
    // The section starts exactly on the tile, then opens out of it.
    root.style.transition = 'none'
    root.style.clipPath = tileClip()
    void root.offsetWidth // commit both before the transitions come back
    for (const item of items) item.style.transition = ''
    root.style.transition = ''
    root.style.clipPath = ''
    root.classList.add('is-open')
    // The rows start watching once the portal is fully open.
    if (REDUCED_MOTION.matches) watchRows()
    else root.addEventListener('transitionend', onOpened)
    setOthersInert(true)
    onOpenChange(true)
    // So the keys scroll the list, not the page behind it.
    scroller.focus({ preventScroll: true })
  }

  function watchRows(): void {
    if (isOpen) for (const item of items) reveal.observe(item)
  }

  function onOpened(e: TransitionEvent): void {
    if (e.target !== root || e.propertyName !== 'clip-path') return
    root.removeEventListener('transitionend', onOpened)
    watchRows()
  }

  function shut(): void {
    if (!isOpen) return
    isOpen = false
    root.removeEventListener('transitionend', onOpened)
    // Folds back into the tile, then stops being painted (the stylesheet).
    root.style.clipPath = tileClip()
    root.classList.remove('is-open')
    view.classList.remove('is-on')
    setOthersInert(false)
    onOpenChange(false)
    tile.focus({ preventScroll: true })
  }

  tile.addEventListener('click', open)
  close.addEventListener('click', shut)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') shut()
  })

  let shown = 0
  let drawn = -1
  function update(p: number, delta: number): void {
    const target = smoother(range(p, ...TILE_IN))
    const chase = REDUCED_MOTION.matches ? 1 : 1 - Math.exp(-LAMBDA * delta)
    shown = Math.abs(target - shown) < 1e-4 ? target : shown + (target - shown) * chase
    const t = shown
    if (t === drawn) return
    drawn = t
    tile.style.opacity = String(Math.min(1, t * 2))
    tile.style.scale = String(1 + PULL * (1 - t))
    // Out of reach, keyboard included, until it is really there.
    tile.style.visibility = t > 0 ? 'visible' : 'hidden'
    tile.style.pointerEvents = t > 0.6 ? 'auto' : 'none'
  }

  return { tile, update, scroller }
}
