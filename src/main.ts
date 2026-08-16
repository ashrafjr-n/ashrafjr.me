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
    <svg class="social-icon" viewBox="0.4 0.4 19.2 19.2" fill="currentColor" aria-hidden="true">
      <path d="M10.015 9.949h-.03c-1.191 0-2.24-.303-2.861.268a1.57 1.57 0 0 0-.527 1.197c0 1.852 1.483 2.08 3.389 2.08h.029c1.905 0 3.389-.229 3.389-2.08c0-.443-.156-.856-.527-1.197c-.622-.571-1.671-.268-2.862-.268M8.393 12.48c-.363 0-.656-.408-.656-.91s.293-.908.656-.908s.657.406.657.908c.001.502-.293.91-.657.91m3.213 0c-.363 0-.657-.408-.657-.91s.294-.908.657-.908c.362 0 .656.406.656.908c.001.502-.293.91-.656.91M10 .4C4.698.4.4 4.698.4 10s4.298 9.6 9.6 9.6s9.6-4.298 9.6-9.6S15.302.4 10 .4m.876 13.539c-.172 0-.514 0-.876.002c-.362-.002-.704-.002-.876-.002c-.76 0-3.772-.059-3.772-3.689c0-.834.286-1.445.755-1.955c-.074-.184-.078-1.232.32-2.236c0 0 .916.1 2.301 1.051c.289-.081.781-.122 1.272-.122s.982.041 1.273.121c1.385-.951 2.301-1.051 2.301-1.051c.398 1.004.395 2.053.32 2.236c.469.51.755 1.121.755 1.955c-.001 3.632-3.013 3.69-3.773 3.69"/>
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
      <circle cx="10" cy="10" r="9.6" fill="#ffffff"/>
      <path fill="#0a66c2" d="M10 .4C4.698.4.4 4.698.4 10s4.298 9.6 9.6 9.6s9.6-4.298 9.6-9.6S15.302.4 10 .4M7.65 13.979H5.706V7.723H7.65zm-.984-7.024c-.614 0-1.011-.435-1.011-.973c0-.549.409-.971 1.036-.971s1.011.422 1.023.971c0 .538-.396.973-1.048.973m8.084 7.024h-1.944v-3.467c0-.807-.282-1.355-.985-1.355c-.537 0-.856.371-.997.728c-.052.127-.065.307-.065.486v3.607H8.814v-4.26c0-.781-.025-1.434-.051-1.996h1.689l.089.869h.039c.256-.408.883-1.01 1.932-1.01c1.279 0 2.238.857 2.238 2.699z"/>
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
        <path fill="#4285f4" d="M58.182 192.05V93.14L27.507 65.077L0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z"/>
        <path fill="#34a853" d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837l-27.026 25.798z"/>
        <path fill="#ea4335" d="m58.182 93.14l-4.174-38.647l4.174-36.989L128 69.868l69.818-52.364l4.669 34.992l-4.669 40.644L128 145.504z"/>
        <path fill="#fbbc04" d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945z"/>
        <path fill="#c5221f" d="m0 49.504l26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23z"/>
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
