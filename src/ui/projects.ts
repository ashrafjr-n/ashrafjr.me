/**
 * The projects page: a plain black sheet that rises from the bottom when
 * EXPLORE is pressed, holding the projects in one column that alternates
 * sides — first on the right, second on the left, and so on — under an
 * ordinary scroll of its own.
 *
 * **Deliberately bare**: no stars, no shadows, no blend, and the system cursor
 * (the inverting disc is parked while this is open — see `main.ts`). The only
 * motion is the rise itself and each card's tilt toward the pointer.
 *
 * Each card turns so **the side the pointer is on comes toward the viewer**: a
 * pointer on the right brings the right edge forward, one near the bottom
 * brings the bottom forward. It is a CSS transform written through two custom
 * properties, with the transition doing the smoothing — no loop of its own.
 */

interface Project {
  name: string
  url: string
  /** Path under `public/`. Omitted until the screenshot exists. */
  image?: string
  inProgress?: boolean
}

const PROJECTS: Project[] = [
  { name: 'Vecto', url: 'https://vecto.aannaelj.workers.dev/', image: '/assets/projects/Vecto.png' },
  { name: 'REJOX', url: 'https://github.com/ashrafjr-n/REJOX', inProgress: true },
  { name: 'TTU Clinic', url: 'https://ttu-7oji.onrender.com/' },
  {
    name: 'Edenic World',
    url: 'https://edenic-wrold.vercel.app/',
    image: '/assets/projects/Edenic-World.png',
    inProgress: true,
  },
]

// Lucide icons (ISC), stroked in currentColor.
const lucide = (paths: string): string =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
const GLOBE = lucide(
  '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
)
const GITHUB = lucide(
  '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
)
const CLOSE = lucide('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>')

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

  const media = document.createElement('div')
  media.className = 'project-media'
  if (project.image) {
    const img = document.createElement('img')
    img.src = project.image
    img.alt = `${project.name} preview`
    img.loading = 'lazy'
    img.decoding = 'async'
    media.append(img)
  } else {
    media.classList.add('project-media--empty')
    media.innerHTML = '<span>Preview soon</span>'
  }

  const meta = document.createElement('div')
  meta.className = 'project-meta'
  const title = document.createElement('h3')
  title.className = 'project-name'
  title.textContent = project.name
  meta.append(title)
  if (project.inProgress) {
    const status = document.createElement('span')
    status.className = 'project-status'
    status.textContent = 'In progress'
    meta.append(status)
  }
  const icon = document.createElement('span')
  icon.className = 'project-icon'
  icon.innerHTML = isRepo(project.url) ? GITHUB : GLOBE
  meta.append(icon)
  card.setAttribute(
    'aria-label',
    `${project.name}${project.inProgress ? ', in progress' : ''} — ${isRepo(project.url) ? 'GitHub repository' : 'website'}`,
  )

  card.append(media, meta)
  item.append(card)
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

export interface Projects {
  open(): void
  /** The one element the page's scroll lock has to leave scrollable. */
  scroller: HTMLElement
}

/**
 * Mount the page into `parent`. `onOpenChange` is told at the start of every
 * open and close — `main.ts` freezes the scene behind it on that.
 */
export function createProjects(
  parent: HTMLElement,
  onOpenChange: (open: boolean) => void,
): Projects {
  const root = document.createElement('section')
  root.className = 'projects'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-label', 'Projects')

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'projects-close'
  close.setAttribute('aria-label', 'Close projects')
  close.innerHTML = CLOSE

  // The scroller is separate from the sheet so the close button can sit still
  // over it: the sheet carries the rise's transform, and anything positioned
  // inside a scroll container would scroll away with the content.
  const scroller = document.createElement('div')
  scroller.className = 'projects-scroller'
  scroller.tabIndex = -1
  const heading = document.createElement('h2')
  heading.className = 'projects-title'
  heading.textContent = 'Projects'
  const list = document.createElement('ol')
  list.className = 'projects-list'
  list.append(...PROJECTS.map(buildProject))
  scroller.append(heading, list)
  root.append(scroller, close)
  parent.append(root)

  if (
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    for (const card of list.querySelectorAll<HTMLElement>('.project-card')) bindTilt(card)
  }

  let isOpen = false
  let returnFocus: HTMLElement | null = null

  /** Everything else in `parent` is taken out of reach while the page is up. */
  function setOthersInert(inert: boolean): void {
    for (const el of parent.children) if (el !== root) (el as HTMLElement).inert = inert
  }

  function open(): void {
    if (isOpen) return
    isOpen = true
    returnFocus = document.activeElement as HTMLElement | null
    scroller.scrollTop = 0
    root.classList.add('is-open')
    setOthersInert(true)
    onOpenChange(true)
    // So the keys scroll the list, not the page behind it.
    scroller.focus({ preventScroll: true })
  }

  function shut(): void {
    if (!isOpen) return
    isOpen = false
    root.classList.remove('is-open')
    setOthersInert(false)
    onOpenChange(false)
    returnFocus?.focus({ preventScroll: true })
  }

  close.addEventListener('click', shut)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') shut()
  })

  return { open, scroller }
}
