/**
 * App entry: mounts the page's elements, starts the scenes and runs the single
 * RAF loop.
 *
 * The loop reads one number — the smoothed scroll progress the 3D scene
 * returns — and drives the DOM side of the Scene 1 -> Scene 2 transition off
 * exactly that value, so nothing here can drift out of sync with the camera,
 * the spin or the stars. Never read `state.scroll` directly for animation.
 */
import './style.css'
import { clamp } from './lib/math'
import { initScene } from './three/scene'
import type { Side } from './three/constellation'
import { lockScroll, unlockScroll } from './lib/scroll-lock'
import { state, initPointer, initScroll } from './lib/state'
import { buildSocialBadges } from './ui/social'
import { createFolderIcon, type FolderIcon } from './ui/folder'
import { createRevealWindow } from './ui/reveal-window'

/**
 * Scroll progress at which the intro line has fully gone. It clears early in
 * the transition so it is never left hanging over Scene 2.
 */
const INTRO_FADE_END = 0.28
/** How far the line drifts upward as it goes, in px. */
const INTRO_DRIFT = 70

/**
 * Scroll progress at which the Scene 2 row starts appearing. It belongs to
 * Scene 2 only, so it stays fully invisible through Scene 1 and the bulk of
 * the transition and is only there once the camera has settled.
 */
const ROW_FADE_START = 0.82

/**
 * Fade fraction above which the row's words accept input. The row is still
 * arriving below that, so they are inert (and untouchable) until Scene 2 has
 * effectively landed.
 */
const ROW_ACTIVE_AT = 0.9

/** Scene 1 intro line, centred near the top of the viewport above the model. */
function buildIntro(): HTMLParagraphElement {
  const intro = document.createElement('p')
  intro.className = 'intro'
  intro.textContent = 'Hi! I am ASHRAF.'
  return intro
}

/**
 * One of the row's words. A real button, so Enter/Space come for free.
 *
 * `modifier` names the word for CSS. It carries nothing on desktop; the mobile
 * layout stacks the two in a column and needs to order them by identity, and
 * `nth-of-type` would tie that to where they happen to sit in the DOM.
 *
 * On tablets and desktop the button holds a folder icon (`ui/folder.ts`)
 * above the label; on phones the icon is hidden by CSS (`.scene2-folder-icon`
 * defaults to `display: none`, shown again only from the `min-width: 768px`
 * block) and the button reads as plain text, exactly as it did before —
 * mobile's layout and behaviour are untouched. The label lives in its own
 * span rather than as the button's direct text so the icon can sit beside it;
 * it carries no styling of its own; every font/color rule still comes from
 * `.scene2-word` and is inherited. The folder icon draws itself in on the
 * same schedule as the portrait (`ui/folder.ts`), so its `update()` is
 * handed back alongside the button for the RAF loop to drive.
 */
function buildRowWord(text: string, modifier: string): { word: HTMLButtonElement; folder: FolderIcon } {
  const word = document.createElement('button')
  word.className = `scene2-word scene2-word--${modifier}`
  word.type = 'button'

  const label = document.createElement('span')
  label.className = 'scene2-folder-label'
  label.textContent = text

  const folder = createFolderIcon()
  word.append(folder.el, label)
  return { word, folder }
}

/**
 * Scene 2 row: SYSTEM and PROJECTS. No cards, no frames, no dividers: the two
 * flush bordered cards that used to be here were removed deliberately, so
 * nothing in this row may grow a background, border or rectangle of its own.
 *
 * **The portrait is temporarily not mounted.** `ui/mark.ts`, the `.scene2-mark`
 * rules in style.css and me.svg itself are all still there and untouched — it
 * is only left out of the row while where it belongs in this composition is
 * decided. Putting it back is `createMark()` plus one `row.append` and one
 * `mark.update()` call in the loop; nothing else was unpicked for this.
 */
function buildScene2Row(): {
  row: HTMLDivElement
  projects: HTMLButtonElement
  /** `side` is the screen edge each word stands on in the wide composition —
   *  and therefore the half of the model's ring its stars are shed from. */
  words: { word: HTMLButtonElement; folder: FolderIcon; side: Side }[]
} {
  const row = document.createElement('div')
  row.className = 'scene2-row'

  // SYSTEM is still deliberately inert as far as the projects reveal window
  // goes: it is built and styled exactly like PROJECTS but is not returned,
  // so nothing can bind it to that window. It does get the same click
  // plumbing PROJECTS gets from bindTrigger (stopPropagation, so a future
  // click-away listener doesn't fight it) so it is ready to be pointed at its
  // own target the moment one exists.
  const { word: system, folder: systemFolder } = buildRowWord('SYSTEM', 'system')
  system.addEventListener('click', (e) => {
    e.stopPropagation()
  })
  const { word: projects, folder: projectsFolder } = buildRowWord('PROJECTS', 'projects')

  row.append(system, projects)
  return {
    row,
    projects,
    words: [
      { word: system, folder: systemFolder, side: 'left' },
      { word: projects, folder: projectsFolder, side: 'right' },
    ],
  }
}

// --- Mount ---
const app = document.querySelector<HTMLDivElement>('#app')!

/** Background WebGL canvas — fixed, full-screen, sits below everything else. */
const canvas = document.createElement('canvas')
canvas.id = 'scene'

const intro = buildIntro()
const { row: scene2Row, projects, words: scene2Words } = buildScene2Row()
app.append(canvas, intro, scene2Row)

// --- Starfield + model, and the input they read ---
const scene = initScene(canvas)

/**
 * Whether Scene 2 runs its flanking composition — the two folders standing to
 * the model's left and right, built on screen by the star constellations.
 *
 * **The same query is written in style.css**, on the block that lays that
 * composition out, and the two have to move together (see the note there for
 * why the aspect bound is what it is). Read once, at startup, rather than
 * live: below it the folders type themselves in and there is nowhere beside
 * the model to put them anyway, and swapping between the two mid-session is
 * not a case worth carrying — the same call the reveal window makes about the
 * phone drag it binds once at construction.
 */
const WIDE = window.matchMedia('(min-width: 900px) and (min-aspect-ratio: 4/3)').matches

/**
 * Whether the site behind the reveal window is standing still.
 *
 * The window covers the screen, so while it is open there is nothing back there
 * to see: Scene 1's starfield, model and transition are all paused, and only
 * the window's own scene keeps drawing. It is one flag rather than a second
 * loop — see `raf()` below.
 */
let isPaused = false

/**
 * Hand the page over to the window, and take it back.
 *
 * Two things go with it. The scroll, because the transition underneath is
 * driven by scroll position and nothing in the covered page would show it
 * moving — the viewer would close the window to find themselves somewhere else
 * entirely. And the loop, because every frame it spends on a scene nobody can
 * see is wasted, and because a spin that kept turning behind the window would
 * be a jump on the way back rather than continuity.
 */
function setPageTakenOver(open: boolean): void {
  if (open) {
    lockScroll()
    isPaused = true
    return
  }
  // Order matters on the way back: the clock is re-anchored before any frame
  // can run, so the paused stretch is never spent, and the scroll is handed
  // back at exactly the position it was taken at.
  scene.resync()
  isPaused = false
  unlockScroll()
}

// The reveal window mounts itself here and brings its own 3D layer with it. It
// has no resting box on screen: it grows out of the word that opened it, and
// PROJECTS is the only word that opens it.
const revealWindow = createRevealWindow(app, setPageTakenOver)
revealWindow.bindTrigger(projects)
app.append(buildSocialBadges())

window.addEventListener('resize', () => {
  scene.resize()
  revealWindow.resize()
})

initPointer()
initScroll()

// Wide screens: the folder marks are not typed in line by line — the stars
// assemble them and cross-fade to them, so each file has to be sitting there
// complete and simply transparent (style.css starts .scene2-word at opacity 0
// in that block, and the constellation owns it from there). Registration waits
// on the fetch, since the glyph positions come out of the injected <svg>
// itself; if a fetch never lands, that word stays hidden, exactly as an
// undrawn folder does today.
if (WIDE) {
  for (const { folder } of scene2Words) folder.fill()
  for (const { word, folder, side } of scene2Words) {
    folder.ready.then((svg) => scene.constellation.addSource(svg, side, word))
  }
}

let introShown = -1
let rowShown = -1
let rowLive = false

/** Fade and lift the intro line, driven by the same progress as the scene. */
function updateIntro(progress: number): void {
  const t = Math.min(progress / INTRO_FADE_END, 1)
  if (Math.abs(t - introShown) < 0.002) return // skip redundant style writes
  introShown = t
  intro.style.opacity = String(1 - t)
  intro.style.transform = `translate(-50%, ${-t * INTRO_DRIFT}px)`
}

/**
 * Fade the Scene 2 row in, off the same progress as everything else. The
 * reveal window is not part of the row and carries no opacity of its own here:
 * it is invisible until it is opened, which only the row's live words can do.
 *
 * On wide screens the row itself carries no fade at all: it is a full-viewport
 * layer whose only children are the two words, and those answer entirely to
 * the constellation, which starts far earlier than ROW_FADE_START and reverses
 * with the scroll. An opacity here would multiply into them. Which is also why
 * the words go live there when the constellation says they are built, rather
 * than at ROW_ACTIVE_AT — by then the folders would have been sitting there,
 * readable and apparently clickable, for most of the transition.
 */
function updateScene2Row(progress: number): void {
  const t = clamp((progress - ROW_FADE_START) / (1 - ROW_FADE_START), 0, 1)
  if (!WIDE && Math.abs(t - rowShown) >= 0.002) {
    // skip redundant style writes
    rowShown = t
    scene2Row.style.opacity = String(t)
  }

  const active = WIDE ? scene.constellation.live : t > ROW_ACTIVE_AT
  if (active === rowLive) return
  rowLive = active
  scene2Row.classList.toggle('is-live', active) // lets the words take the pointer
  // Scrolling back toward Scene 1 also puts an open window away, rather than
  // leaving a preview over the transition.
  revealWindow.setInteractive(active)
}

// --- Single RAF loop: the only one in the app; hook new per-frame work in here
//
// It keeps running while the reveal window is open — it is still the only loop
// in the app — but everything belonging to the covered page is skipped, and
// only the window's own scene is advanced. The scroll is frozen while that is
// true, so `progress` could not have moved anyway; skipping it is what also
// stops the model's spin from running unseen.
function raf(time: number) {
  if (!isPaused) {
    const progress = scene.update(time, state)
    updateIntro(progress)
    updateScene2Row(progress)
    // Each word's own label waits for that word's own folder mark to arrive
    // before it is allowed to show (see .is-label-shown in style.css, scoped
    // to tablets/desktop where the mark actually appears). What it waits on
    // depends on how the mark got there: the typed-in draw reporting itself
    // done, or — on wide screens, where folder.update() is already retired by
    // the fill() above — the constellation reporting the folders built.
    // `classList.add` is idempotent, so no extra bookkeeping is needed to
    // call it again on every later frame once that has happened. It is never
    // removed: on wide screens the label is inside the word the constellation
    // is fading, so it goes back out with it on a scroll up anyway.
    for (const { word, folder } of scene2Words) {
      const arrived = WIDE ? scene.constellation.live : folder.update(time, rowShown > 0)
      if (arrived) word.classList.add('is-label-shown')
    }
  }
  revealWindow.update(state)
  requestAnimationFrame(raf)
}

requestAnimationFrame(raf)
