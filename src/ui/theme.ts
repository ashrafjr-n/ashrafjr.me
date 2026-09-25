/**
 * Light and dark, after mohitvirli.github.io: one button top-right flips the
 * sky from blue to near-black over a second and brings the stars out; the
 * clouds and the type stay as they are. The choice is remembered, and the
 * phone's browser bar takes the sky's colour.
 *
 * `index.html` applies a remembered theme before the first paint, so a dark
 * visit never flashes blue.
 */
const THEMES = {
  light: '#4f99d2',
  dark: '#111111',
} as const
type Theme = keyof typeof THEMES
const KEY = 'theme'
/** Seconds the sky takes to change. */
const DURATION = 1

// Lucide `moon` / `sun` (ISC).
const lucide = (paths: string): string =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
const MOON = lucide('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>')
const SUN = lucide(
  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
)

export interface ThemeSwitch {
  el: HTMLButtonElement
  /** How dark the sky is, 0..1, eased — read once a frame by the scene. */
  update(delta: number): number
  /** Fade the button in, once the loader has gone. */
  show(): void
}

export function createThemeSwitch(): ThemeSwitch {
  let theme: Theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  let shown = theme === 'dark' ? 1 : 0

  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'theme-switch'

  function apply(): void {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[theme])
    el.innerHTML = theme === 'dark' ? SUN : MOON
    el.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')
  }
  apply()

  el.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Private mode or blocked storage: the switch still works for this visit.
    }
    apply()
  })

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  return {
    el,
    update(delta) {
      const target = theme === 'dark' ? 1 : 0
      const step = reduced.matches ? 1 : delta / DURATION
      shown = target > shown ? Math.min(target, shown + step) : Math.max(target, shown - step)
      return shown * shown * (3 - 2 * shown)
    },
    show: () => el.classList.add('is-shown'),
  }
}
