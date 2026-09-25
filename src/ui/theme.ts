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

// Phosphor `moon-stars` / `sun-dim`, fill weight (MIT).
const phosphor = (d: string, kind: string): string =>
  `<svg class="theme-icon theme-icon--${kind}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`
const MOON = phosphor(
  'M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm65.14,94.33A88.07,88.07,0,0,1,105.67,46.86a8,8,0,0,0-10.6-9.06A96,96,0,1,0,218.2,160.93a8,8,0,0,0-9.06-10.6Z',
  'moon',
)
const SUN = phosphor(
  'M120,40V32a8,8,0,0,1,16,0v8a8,8,0,0,1-16,0Zm8,24a64,64,0,1,0,64,64A64.07,64.07,0,0,0,128,64ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-8-8A8,8,0,0,0,50.34,61.66Zm0,116.68-8,8a8,8,0,0,0,11.32,11.32l8-8a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l8-8a8,8,0,0,0-11.32-11.32l-8,8A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l8,8a8,8,0,0,0,11.32-11.32ZM40,120H32a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16Zm88,88a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-8A8,8,0,0,0,128,208Zm96-88h-8a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16Z',
  'sun',
)
/** One quick, smooth turn of the icon on every switch, ms. */
const SPIN_MS = 520

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
  // Both icons, stacked: the stylesheet cross-fades them off `data-theme`
  // while the pair turns, so the swap happens inside the spin.
  el.innerHTML = `<span class="theme-icons">${MOON}${SUN}</span>`
  const icons = el.firstElementChild as HTMLElement
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

  function apply(): void {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[theme])
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
    if (!reduced.matches) {
      icons.animate([{ rotate: '0deg' }, { rotate: '360deg' }], {
        duration: SPIN_MS,
        easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
      })
    }
  })

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
