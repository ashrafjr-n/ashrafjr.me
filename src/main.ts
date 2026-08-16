import './style.css'
import { initScene } from './three/scene'
import { state, initPointer, initScroll } from './lib/state'

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
    <svg class="social-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#ffffff"/>
      <g transform="translate(5.2 5.2) scale(0.9)">
        <path fill="#000000" d="M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </g>
    </svg>
    <span>ashrafjr-n</span>
  `
  return link
}

/** Scene 1 intro line, centred near the top of the viewport above the model. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
}

/** Icon-only LinkedIn link, sharing the GitHub badge's hover style. */
function buildLinkedinBadge(): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'github-badge'
  link.href = 'https://www.linkedin.com/in/ashraf-al-jarabeah-a94509408/'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.setAttribute('aria-label', 'LinkedIn')
  link.innerHTML = `
    <svg class="social-icon" viewBox="0.4 0.4 19.2 19.2" aria-hidden="true">
      <circle cx="10" cy="10" r="9.6" fill="#000000"/>
      <path fill="#ffffff" d="M10 .4C4.698.4.4 4.698.4 10s4.298 9.6 9.6 9.6s9.6-4.298 9.6-9.6S15.302.4 10 .4M7.65 13.979H5.706V7.723H7.65zm-.984-7.024c-.614 0-1.011-.435-1.011-.973c0-.549.409-.971 1.036-.971s1.011.422 1.023.971c0 .538-.396.973-1.048.973m8.084 7.024h-1.944v-3.467c0-.807-.282-1.355-.985-1.355c-.537 0-.856.371-.997.728c-.052.127-.065.307-.065.486v3.607H8.814v-4.26c0-.781-.025-1.434-.051-1.996h1.689l.089.869h.039c.256-.408.883-1.01 1.932-1.01c1.279 0 2.238.857 2.238 2.699z"/>
    </svg>
  `
  return link
}

/** Icon-only email link, sharing the GitHub badge's hover style. */
function buildEmailBadge(): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'github-badge'
  link.href = 'mailto:aannaelj@gmail.com'
  link.setAttribute('aria-label', 'Email')
  link.innerHTML = `
    <svg class="social-icon" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#ffffff"/>
      <g transform="translate(11 14.2) scale(0.1016)">
        <path fill="#000000" d="M58.182 192.05V93.14L27.507 65.077L0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z"/>
        <path fill="#000000" d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837l-27.026 25.798z"/>
        <path fill="#000000" d="m58.182 93.14l-4.174-38.647l4.174-36.989L128 69.868l69.818-52.364l4.669 34.992l-4.669 40.644L128 145.504z"/>
        <path fill="#000000" d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945z"/>
        <path fill="#000000" d="m0 49.504l26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23z"/>
      </g>
    </svg>
  `
  return link
}

/** Top-left social icon row — GitHub, LinkedIn, email. */
function buildSocialBadges(): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'social-badges'
  wrap.append(buildGithubBadge(), buildLinkedinBadge(), buildEmailBadge())
  return wrap
}

const intro = buildIntro()
app.append(canvas, intro, buildSocialBadges())

// --- Particle starfield ---
const scene = initScene(canvas)
window.addEventListener('resize', () => scene.resize())

// --- Pointer parallax + scroll transition input ---
initPointer()
initScroll()

/**
 * Scroll progress at which the intro line has fully gone. It clears early in
 * the transition so it is never left hanging over Scene 2.
 */
const INTRO_FADE_END = 0.28
/** How far the line drifts upward as it goes, in px. */
const INTRO_DRIFT = 70

let introShown = -1

/** Fade and lift the intro line, driven by the same progress as the scene. */
function updateIntro(progress: number): void {
  const t = Math.min(progress / INTRO_FADE_END, 1)
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, ${-t * INTRO_DRIFT}px)`
}

// --- Single RAF loop: drives the starfield ---
function raf(time: number) {
  const progress = scene.update(time, state)
  updateIntro(progress)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
