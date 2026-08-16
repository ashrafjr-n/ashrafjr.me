import './style.css'
import { initScene } from './three/scene'
import { state, initPointer } from './lib/state'

const app = document.querySelector<HTMLDivElement>('#app')!

/** Background WebGL canvas — fixed, full-screen, sits below everything else. */
const canvas = document.createElement('canvas')
canvas.id = 'scene'

/** Top-left GitHub badge — icon + username, links out. */
function buildGithubBadge(): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'github-badge'
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

app.append(canvas, buildGithubBadge())

// --- Particle starfield ---
const scene = initScene(canvas)
window.addEventListener('resize', () => scene.resize())

// --- Pointer parallax input ---
initPointer()

// --- Single RAF loop: drives the starfield ---
function raf(time: number) {
  scene.update(time, state)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
