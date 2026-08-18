/**
 * The five project cards that live inside the reveal window's 3D space.
 *
 * These are real DOM elements, not textures: `three/reveal.ts` hands each one
 * to a CSS3DObject and places it in the world beside the planets, so a card is
 * a rectangle standing out in the space rather than an overlay pinned to the
 * screen. Everything about how a card *looks* is here and in style.css;
 * everything about *where it stands* is in reveal.ts.
 *
 * Each card is a two-element sandwich for one reason: CSS3DRenderer writes its
 * own `transform` onto the element it is given, so that element can never carry
 * a transform of ours. The outer `.pcard-slot` is what the renderer drives; the
 * inner `.pcard` is free to scale on hover.
 *
 * Palette rules apply as everywhere else — white card, black type, and both
 * icons recoloured to a single white on the black VIEW button.
 */

/** GitHub's Invertocat (Simple Icons), the site's mark recoloured white. */
const GITHUB_MARK = `
  <svg class="pcard-view-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#ffffff" d="M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
`

/** Material Design's `open_in_new` — the standard "opens a live site" mark. */
const EXTERNAL_MARK = `
  <svg class="pcard-view-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#ffffff" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zM14 3v2h3.59l-9.83 9.83l1.41 1.41L19 6.41V10h2V3z"/>
  </svg>
`

interface Project {
  name: string
  /** The one-line tech stack, revealed with the card's hover. */
  stack: string
  href: string
  /**
   * Which mark the VIEW button carries. A repo link gets GitHub's; a deployed
   * site gets the external-link one, so the button says where it lands before
   * it is clicked.
   */
  kind: 'repo' | 'site'
}

/** Left to right along the row. */
const PROJECTS: Project[] = [
  {
    name: 'REJOX',
    stack: 'React TS · Python',
    href: 'https://github.com/ashrafjr-n/REJOX',
    kind: 'repo',
  },
  {
    name: 'TTU Clinic',
    stack: 'Laravel · Blade · PHP',
    href: 'https://ttu-7oji.onrender.com/',
    kind: 'site',
  },
  {
    name: 'Datassert',
    stack: 'React JS · JavaScript · Python',
    href: 'https://synthetic-data-lab-omega.vercel.app/',
    kind: 'site',
  },
  {
    name: 'AGB Media',
    stack: 'React JS',
    href: 'https://agb-media.net/',
    kind: 'site',
  },
  {
    name: 'Naelj',
    stack: 'React JS',
    href: 'https://naelj.aannaelj.workers.dev/',
    kind: 'site',
  },
]

/**
 * One card, as the slot element the 3D layer will drive.
 *
 * Nothing here decides what paints over what. Inside the row's `preserve-3d`
 * container the browser paints by depth, so neither reordering the element nor
 * `z-index` can lift a hovered card out from behind its neighbour — both were
 * tried and measured. `three/reveal.ts` moves the hovered card into a second
 * layer instead, which is a fact about where it stands rather than what it is.
 */
function buildProjectCard({ name, stack, href, kind }: Project): HTMLDivElement {
  const slot = document.createElement('div')
  slot.className = 'pcard-slot'

  const card = document.createElement('article')
  card.className = 'pcard'

  const title = document.createElement('h3')
  title.className = 'pcard-name'
  title.textContent = name

  const line = document.createElement('p')
  line.className = 'pcard-stack'
  line.textContent = stack

  const view = document.createElement('a')
  view.className = 'pcard-view'
  view.href = href
  view.target = '_blank'
  view.rel = 'noopener noreferrer'
  view.setAttribute('aria-label', `View ${name}`)
  view.innerHTML = `<span>VIEW</span>${kind === 'repo' ? GITHUB_MARK : EXTERNAL_MARK}`

  card.append(title, line, view)
  slot.append(card)

  /**
   * Taking the link hands the page to another tab, so the card has no business
   * standing open behind it — but neither state that holds it open lapses on
   * its own. The cursor is still inside the card, so `:hover` stays true, and
   * the link keeps focus after the click, so `:focus-within` stays true too.
   * Dropping the focus and marking the card is what puts it back at rest.
   *
   * Keyboard activation is left alone (a click synthesised from Enter or Space
   * reports `detail` 0). There the focus ring is still on VIEW, and closing the
   * card would hide the very element holding it.
   */
  view.addEventListener('click', (event) => {
    if (event.detail === 0) return
    view.blur()
    card.classList.add('is-dismissed')
  })
  // Leaving and coming back is a fresh hover, so the card opens out again.
  slot.addEventListener('pointerleave', () => {
    card.classList.remove('is-dismissed')
  })

  return slot
}

/**
 * How far behind its right-hand neighbour each card sets off, in ms. Half of
 * --pcard-enter-dur in style.css (1300ms), so a card leaves the ground as the
 * one beside it passes its own halfway point and the row arrives as one wave
 * rather than five separate moves. Keep the halves relation if either number is
 * retuned; the whole cascade is 3.9s and unhurried on purpose, since each card
 * climbs from below the frame rather than from just under its place.
 *
 * Halfway in *time* is only halfway in *motion* if the curve cooperates: under
 * the front-loaded easing this row used to carry, a card was ~90% of the way
 * home when its neighbour set off, and the overlap was invisible. That is a
 * --pcard-enter-ease question, not a stagger one — see style.css.
 *
 * Only the stagger is duplicated here; the duration, distance and curve are all
 * the stylesheet's. This is written per card as an inline
 * --pcard-enter-delay because the row's order cannot be an nth-child rule —
 * the hovered card is moved into a layer of its own (three/reveal.ts), which
 * would renumber everything left behind.
 */
const ENTER_STAGGER_MS = 650

/** Every card, in row order, ready to be placed in the 3D scene. */
export function buildProjectCards(): HTMLDivElement[] {
  const slots = PROJECTS.map(buildProjectCard)
  // Right to left: the last card in the row goes first, so the cascade runs
  // back toward the start of the row.
  slots.forEach((slot, i) => {
    const rank = slots.length - 1 - i
    slot.style.setProperty('--pcard-enter-delay', `${rank * ENTER_STAGGER_MS}ms`)
  })
  return slots
}

/**
 * The watcher that will take a card out of `is-arriving`, per slot, so that
 * re-arming mid-cascade can drop one that will never finish.
 */
const arrivalWatchers = new WeakMap<HTMLElement, () => void>()

/**
 * Hold a card inert until its own rise has landed, then hand it to the hover.
 *
 * A card must not be hoverable while it is still climbing, and the reason is
 * sharper than a transform clash: entering a card raises it, and raising it
 * re-appends the slot into the other CSS3D layer (`raise()` in
 * three/reveal.ts). Taking an element out of the tree cancels its running
 * transitions, so the card reappears at its resting value — it snaps into
 * place, mid-cascade, wherever the cursor happened to be waiting. Gating the
 * pointer for the length of the rise is what makes that unreachable, and it has
 * to be per card, since each one lands on its own --pcard-enter-delay.
 *
 * The signal is the card's own `transitionend` for `translate` (it bubbles to
 * the slot), not a timer: the duration and the delay both live in style.css and
 * neither is worth duplicating here. `transitioncancel` settles it too — a card
 * whose rise was interrupted must not be left permanently untouchable.
 */
function watchArrival(slot: HTMLElement): void {
  const stop = (): void => {
    slot.removeEventListener('transitionend', onEnd)
    slot.removeEventListener('transitioncancel', onEnd)
    arrivalWatchers.delete(slot)
  }
  const onEnd = (event: TransitionEvent): void => {
    // The rise is `translate`. The hover's `transform` and the entrance's own
    // `opacity` also end on this element and say nothing about landing.
    if (event.propertyName !== 'translate') return
    stop()
    slot.classList.remove('is-arriving')
  }
  slot.addEventListener('transitionend', onEnd)
  slot.addEventListener('transitioncancel', onEnd)
  arrivalWatchers.set(slot, stop)
}

/**
 * Put the row back below its place, ready to rise. Snaps — the armed state
 * carries no transition — so this is safe to call at the instant the window
 * starts opening, before anything has been painted.
 *
 * Any watcher still waiting on the previous cascade is dropped first: the rise
 * it was listening for is about to be replaced by an untransitioned jump, so
 * its `transitionend` would never arrive.
 */
export function armCardEntrance(slots: HTMLElement[]): void {
  for (const slot of slots) {
    arrivalWatchers.get(slot)?.()
    slot.classList.remove('is-arriving')
    // Last open left the row lying below the frame. Dropping the class here
    // rather than at the end of the close is what let the cards stay down while
    // the window shrank back into its word; the armed state it lands in is the
    // same position anyway, so nothing moves.
    slot.classList.remove('is-leaving')
    slot.classList.add('is-entering')
  }
}

/**
 * Let the row go. Each card then takes its own --pcard-enter-delay, so one call
 * plays the whole cascade; the browser runs it, not the RAF loop.
 *
 * `is-arriving` rides along from here until each card lands, keeping it out of
 * the pointer's reach for exactly as long as it is moving.
 */
export function playCardEntrance(slots: HTMLElement[]): void {
  for (const slot of slots) {
    slot.classList.add('is-arriving')
    watchArrival(slot)
    slot.classList.remove('is-entering')
  }
}

/**
 * How long the row takes to drop out, in ms. This is `--pcard-exit-dur` in
 * style.css, and the one timing this module duplicates in both directions: the
 * window has to know when the cards have gone before it may start shrinking, so
 * the number has to exist here as well. Keep the two equal.
 *
 * It is a timer rather than a `transitionend` on the way out for a reason a
 * stuck class does not have on the way in: nothing else would ever close the
 * window. An event that fails to arrive — a backgrounded tab, an interrupted
 * transition — would leave the window standing open for good.
 */
export const CARD_EXIT_MS = 600

/**
 * Send the row back down, all five at once. The exit is deliberately not the
 * entrance reversed: there is no stagger, so the whole row is gone in one
 * --pcard-exit-dur and the window is not left waiting on the last card.
 *
 * Any arrival watcher still pending is dropped first — a card caught mid-rise
 * turns straight around, and the landing it was waiting for is never coming.
 */
export function dropCards(slots: HTMLElement[]): void {
  for (const slot of slots) {
    arrivalWatchers.get(slot)?.()
    slot.classList.remove('is-arriving')
    slot.classList.add('is-leaving')
  }
}
