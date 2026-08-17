At the start of every session, and after every /clear, read vibe.md first before doing anything else.

# Personal Portfolio — Project Guide

## Stack
- **Vite** — build tool / dev server
- **TypeScript** — vanilla, no framework. `strict` is on, along with
  `noUnusedLocals`/`noUnusedParameters`; `npx tsc --noEmit` is the quick check
- **Three.js** — 3D scene work (`src/three/`)
- **Plain CSS** — no Tailwind, no CSS framework (`src/style.css`)

## Theme
- Cinematic, high-contrast.
- Palette is **white / black / silver-gray only** — no other colors anywhere
  (CSS, 3D materials, gradients, shadows). Enforce this on every visual change.
  **There are no exceptions, including brand logos.** The social icons were
  briefly shown in real brand colors (LinkedIn blue, Gmail multicolor) and that
  was reverted — every logo mark is recolored to pure white/black on the way in.
- Design tokens live in the `:root` block of `src/style.css`.
- **The page background is pure `#000000` (`--bg`) and must stay that way.**
  The `space_boi` model's own material is pure black, so at `#000000` the model
  reads as one continuous surface with the page — its base slab is invisible
  and only the white orbit rings, planets and figure show. The body background
  is deliberately flat (no gradient) to preserve that. Do not add a gradient,
  lighten the background, or put a ground/backdrop mesh behind the model.
- Fonts loaded: **Space Grotesk** (`--font-display`, still not applied to any
  element) and **JetBrains Mono** (`--font-code`, applied to body text, the
  social badges, the intro line and the Scene 2 row). JetBrains Mono is
  requested at **400 and 700**, Space Grotesk at **400 only** — the Google
  Fonts request in `index.html` carries exactly what is rendered, so anything
  set to a weight that is not in that URL will synthesize until it is added.

## Current state
Scene 1 is the static opening composition: the `space_boi` diorama seen from a
bird's-eye camera, over the drifting starfield, on pure black. Most of the
original scroll/section system was intentionally stripped out and has not come
back. What exists today:

- `src/main.ts` — wiring only: mounts the full-screen `#scene` canvas, the
  intro line and the Scene 2 row, initializes the Three.js scene
  (`src/three/scene.ts`), starts input tracking (`src/lib/state.ts`), mounts
  the social row and the reveal window, hands the window its triggers, and runs
  the single RAF loop with the DOM side of the scroll transition. Feature
  markup and behaviour live in `src/ui/`, not here.
- `src/ui/social.ts` — the social icon row: the three inline SVGs, the
  `SOCIAL_LINKS` data and the one factory that builds them.
- `src/ui/mark.ts` — the Scene 2 portrait and its draw/hold/wipe cycle (see
  **Scene 2 portrait** below).
- `src/ui/reveal-window.ts` — the reveal window as one unit: its DOM, its
  open/close behaviour, its JS-written geometry and the 3D layer behind it
  (see **Reveal window** below). `main.ts` only mounts it, binds the trigger
  words and calls its `update()`.
- `src/ui/project-cards.ts` — the five project cards' data and DOM: what a card
  *is*. Where each one stands is `src/three/reveal.ts`'s business (see
  **Project cards** below).
- `src/three/scene.ts` — owns the renderer and the orbiting particle starfield
  (white/silver dots only; see **Starfield** below). The particle field also
  tilts in response to mouse position. It owns the two-pass composite (see
  **Render passes**). It also owns the smoothed `progress` that drives the
  Scene 1 → Scene 2 transition (see **Scroll transition**).
- `src/three/reveal.ts` — the reveal window's own 3D scene: its own renderer,
  scene and fixed camera, shared with nothing (see **Reveal window** below). It
  also owns the CSS3D layer the project cards stand in, on that same camera.
- `src/three/world.ts` — the Scene 1 world layer: its own `Scene` +
  bird's-eye `PerspectiveCamera` (fov 35, at `(0, 9.3, 4.6)` looking at
  `(0, 0.25, 0)`, ~63° above the horizon), white key/fill/ambient lights, the
  GLB load, and the spin (`update(delta)`). **There is no platform/pedestal
  mesh** — one existed briefly and was deliberately removed; the model's own
  black base is the ground.
- `public/models/space_boi.glb` — loaded via `GLTFLoader` (imported from
  `three/examples/jsm/loaders/GLTFLoader.js` inside the installed `three`
  package — no extra dependency, no Draco). It is a wide, shallow diorama with
  its own black base slab, so `fitModel()` scales it by its **horizontal
  footprint** (`MODEL_SPAN`, currently 3.5), not its height — fitting by height
  overflows the viewport. It is then centered on x/z and dropped so it rests on
  `y = 0`. The camera target's `y` is the model's mid-height, so a large change
  to `MODEL_SPAN` wants `CAMERA_TARGET` nudged to keep the framing centred.
- `src/lib/state.ts` — shared `InputState` (`mouseX`, `mouseY`, `scroll`)
  written by `initPointer()` and `initScroll()`, read every frame by the scene.
- `src/lib/math.ts` (`rand`, `clamp`) and `src/three/sprite.ts`
  (`createCircleTexture`) — the handful of helpers both 3D scenes need. They
  were duplicated verbatim in `scene.ts` and `reveal.ts`; keep them shared.
  Each scene still calls `createCircleTexture()` for a texture of its own,
  since the two have separate renderers.
- Social icon row (`.social-badges`, top-left) — three `.social-badge`-class
  links built in `src/ui/social.ts`: GitHub (icon + "ashrafjr-n" label, links to
  `github.com/ashrafjr-n`), and two icon-only links (no label span) for
  LinkedIn and email (`mailto:aannaelj@gmail.com`). They are **data, not three
  functions**: the `SOCIAL_LINKS` array feeds one `buildSocialLink()` factory,
  so adding a link means adding an entry. A `mailto:` href is what suppresses
  `target="_blank"`; the caption is whatever `text` is set, omitted on the
  icon-only two. All three share one hover style off the `.social-badge`
  class. **The three icons are circular in the artwork, not in CSS.** Each
  is a full-bleed disc whose `viewBox` is cropped to the disc's own bounds, so
  all three paint an identical 26px circle inside the 26px `.social-icon` box
  (verified: box *and* `getBBox()` artwork both measure 26x26 for all three).
  `.social-icon` only sizes them — it deliberately carries no `border-radius`,
  `background`, `border`, `clip-path` or mask, and none should be added back:
  a CSS ring around a square glyph was tried and rejected.
  All three share one treatment — **white disc, pure black mark, no other
  colour** — so keep any future icon to that pattern.
  - **GitHub** — the modern official Invertocat (Simple Icons `github`) in
    black, scaled 0.9 and centred on a white `<circle>` in a 32x32 viewBox.
    An older Entypo cartoon cat-face-in-a-circle was used before and rejected.
  - **LinkedIn** — Entypo Social's `linkedin-with-circle` filled white, over a
    black `<circle>` of the same radius. The "in" is a knockout in that path,
    so the black circle behind is what shows through it. The circle behind is
    explicit rather than relying on the page black, so the starfield can never
    show through the letters. LinkedIn ships no official *circular* asset (its
    real logo is a rounded square), so this composition is the closest true one.
  - **Email** — the official Gmail mark (Iconify `logos:google-gmail`),
    recoloured from its five brand colours to a single black, on a white disc;
    scaled 0.1016 and translated to centre it in a 48x48 viewBox. The mark's
    five shapes don't overlap, so flattening them to one colour keeps the "M"
    readable. `mailto:` target, so the Gmail mark matches the address.

  Paths are hand-embedded (no icon package is installed); don't hand-draw new
  ones, pull the circular variant from a recognized set the same way.
- Intro line — fixed top-centre, "Hi! I am ASHRAF." (`.intro`, built in
  `main.ts`). Scene 1 only: `main.ts` fades and lifts it away over the first
  `INTRO_FADE_END` of the scroll. It uses `--font-code`, the same face as the
  badge; `--font-display` (Space Grotesk) is loaded but still unused anywhere.
  No `text-transform` — the copy is rendered exactly as written.
- Scene 2 row (`.scene2-row`, bottom-centre) — three elements on one line,
  centred on each other, below the model in the levelled Scene 2 view: the word
  **CONTACT**, the portrait, the word **PROJECTS**. Built in `main.ts`, sized
  from four `:root` tokens (`--row-bottom`, `--row-gap`, `--row-mark-h`,
  `--row-word-size`).
  - **There are no containers here and there must not be any.** This replaced
    two flush bordered cards (`.scene2-cards` / `.scene2-card`, with a
    `--card-line` hairline boundary and divider, a hover scale, and the reveal
    window fitted to the right card's inner box). All of that was deleted on
    purpose — no card, border, divider, background, box-shadow or
    `border-radius` may come back for these three.
  - The two words are `.scene2-word` **`<button>`s reset to plain type**
    (`background: none; border: 0`), so Enter/Space and focus come for free.
    `--font-code` at **weight 700** — that weight is requested in `index.html`;
    keep it there. **Hover is brightness only** — `--accent` to pure white, no
    lift, no glow, no box. A `translateY` lift and a `text-shadow` were both
    tried and removed; the words carry no shadow at rest either. Only PROJECTS
    does anything; CONTACT is an inert placeholder (see **Reveal window**).
  - The portrait (`.scene2-mark`) is `public/assets/svg/me.svg`, an ASCII-art
    self-portrait — see **Scene 2 portrait** below. Its box is `--row-mark-h`
    tall with the artwork's own `aspect-ratio` (1036 / 1363) stated in CSS, so
    the row's layout holds before the file has even loaded.
  - The row is `pointer-events: none` and the words opt back in via
    `.scene2-row.is-live .scene2-word`, gated from `main.ts` because an
    opacity-0 element is still a hit target.
  - The row is a **DOM overlay** — nothing about it was added to the Scene 1
    Three.js layers, so Scene 1 and the transition are untouched. `opacity`
    starts at 0 in CSS and `main.ts` fades it in over the last
    `1 - ROW_FADE_START` of the scroll off the same `progress` the scene
    returns, so the row is invisible until Scene 2.
- Reveal window (`.reveal-window`) — opened by the row's words; see **Reveal
  window** below.
- Cursor — the default system cursor everywhere. A custom Saturn cursor and
  then a custom arrow both existed and were reverted; `public/cursor-saturn.svg`
  is gone and no `cursor: url(...)` rule remains. The only cursor rules left
  are `cursor: pointer` on `.social-badge` and `.scene2-word`.

At rest (scroll 0) the world camera does not move; the mouse parallax affects
the wide starfield only. Everything else moves only under scroll.

## Scene 2 portrait (`src/ui/mark.ts`)
`public/assets/svg/me.svg` — an ASCII-art self-portrait, 127 text lines, each
clipped by a `<rect>` that widens from 0 to 1008 to reveal it. It draws itself
in, holds, wipes back out and repeats, forever, but **only while Scene 2 is on
screen**.

- It is **inlined**, not an `<img>`: `mark.ts` fetches the file and injects it,
  because an `<img>`'s internals cannot be reached. It stays in `public/` (a
  295KB string does not belong in the JS bundle), so the row is briefly empty
  on first arrival — the CSS box is sized anyway, so nothing shifts.
- **The artwork's own SMIL animation is stripped and replaced.** Every
  `<animate>`/`<set>` is removed in the same task as the inject, so the
  built-in typing pass never gets a frame — it used to run once at page load
  and freeze long before anyone scrolled down. Each line's full width is read
  off its `<animate to="...">` first. The typing cursor rects are left at
  `opacity: 0`, which is what they are without their `set`.
- The whole picture is **one number**: how many lines are filled, fractionally.
  Drawing top-to-bottom and wiping bottom-to-top are that number going up and
  coming back down, so there is no separate reverse pass. `DRAW_MS` /
  `HOLD_MS` / `WIPE_MS` are the cycle, and the wipe runs straight into the next
  draw with no gap by construction (the cycle is `clock % CYCLE_MS`).
- Only the lines between the last state and the new one are written, so a frame
  touches one or two rects, not 127.
- It runs off the **single RAF loop** like everything else — `main.ts` calls
  `mark.update(time, rowShown > 0)`, where `rowShown` is the row's own fade. Off
  screen it rewinds to blank, so arriving in Scene 2 always starts from the
  first line. Do not give it a loop, an IntersectionObserver or a timer.
- The file's `@media (prefers-color-scheme: light)` block is **cut out of the
  stylesheet on the way in** (`stripLightScheme`). Inline, that stylesheet is a
  document-level one, and on a light-mode system it would flip every grey to
  near-black on a black page. Its greys are otherwise palette-safe; its one
  off-palette cursor colour was recoloured to grey in the file itself.

## Reveal window (opened from the Scene 2 row)
The project preview. The element and everything it does live in
`src/ui/reveal-window.ts`; the 3D layer behind it is
`src/three/reveal.ts`. It is a **real Three.js scene**, not stacked images: a
particle star volume around a fixed camera, with the planet PNGs as billboards
at their own distances. An earlier version composited `projects-background.png`
and six planet `<img>`s with CSS transforms; that was replaced because layer
translation cannot produce a true look-around, and it should not come back.
`public/assets/projects/black|white|one|two|three|four.png` are still used, as
sprite textures. The `projects-background.png` files went unreferenced with
that change and have been deleted.

**The window is a mask, not a viewport of its own.** The canvas inside is
always viewport-sized, so opening grows the mask and uncovers more of the same
rendered frame rather than re-rendering. Never resize or scale the canvas to
open it; that would read as a zoom.

**Open, it is inset, not edge-to-edge.** It stops `--reveal-inset` short of all
four screen edges and carries a 1px `--reveal-frame` hairline there, so the
scene reads as a framed view. One token drives all four sides — that is what
keeps the margin even — and the black gap alone would be invisible on a black
page, which is why the line is there. It replaced a full-bleed takeover; don't
put that back without being asked.

- It is a **`position: fixed` element with no resting box**: while closed it is
  `opacity: 0` and inert, and it has no place on screen of its own. There is
  nothing to see in the Scene 2 row where it used to sit as the right card.
- **Its geometry is written from JS, not CSS.** `bindTrigger(el)` makes a word
  open it: on open the window is put on that word's measured box with
  transitions suppressed and flushed (`void root.offsetWidth`), then grown to
  the inset box (`applyOpenBox()`, which writes `var(--reveal-inset)` and
  `calc(100% - 2 * ...)` straight into the inline style); on close it is given
  the same word's box again and animates back into it. The values in
  `.reveal-window` are only a starting point for before the first open.
  Percentages for the open size, not `vw`/`vh` or measured pixels, so a classic
  scrollbar cannot push it past the visible area.
- The trigger's click **must stop propagating** — it is outside the window now,
  so the click-away listener would otherwise close what it just opened.
- `left/bottom/width/height` animate over 620ms expo-out. It cannot use a
  transform: scaling the mask would scale the canvas with it. `opacity` is
  instant on the way in and **delayed 440ms on the way out**, so the shrink
  back into the word is actually seen; that split lives in the two
  `.reveal-window` transition lists and both must keep the geometry timings.
- The social badges sit at `z-index: 60`, above the window's 40, so the links
  stay visible and clickable over the takeover. Keep them above it.
- Opened by clicking (or Enter/Space on) **PROJECTS**, and only PROJECTS.
  **CONTACT is deliberately inert** — it is built and styled identically but
  nothing is bound to it, and `buildScene2Row()` does not even return it, so
  nothing can be. It briefly shared this window as a placeholder and that was
  undone; it gets its own behaviour later. Closed by the `.reveal-close`
  button, a click outside, or Escape; two permanent document listeners handle
  the last two, and closing returns focus to the word it came out of.
- The close corner's `×` is a **text glyph sized well past its 64px box**
  (`font-size: 118px`): the mark inks at about half its em, so that is what
  puts its edges near the box's. Its line box overflows the button, which is
  harmless — the button doesn't clip. Retune the font-size, not the box.
- It is gated by hand from `updateScene2Row()` in `main.ts` via
  `setInteractive()`, off the same `progress` as the row: below `ROW_ACTIVE_AT`
  the words are not live and an open window is put away, so scrolling back
  toward Scene 1 closes it.
- There is **no closed-state tilt any more**. The canvas used to rotate under
  the mouse while the window sat in the right card; with nothing visible while
  closed there is nothing to tilt, and that code and its CSS were removed.
- The window **mounts itself** into `#app` and only then builds its 3D layer.
  That order is load-bearing: the scene draws exactly one still frame at
  startup and then renders on demand, so its canvas has to be in the page for
  that frame to reach the screen.

### The 3D layer (`src/three/reveal.ts`)
Its own renderer, scene and camera, owned by `src/ui/reveal-window.ts` — no
other module touches it. It shares **nothing** with the Scene 1 starfield in
`scene.ts`/`world.ts` but the technique — don't try to merge them.

- **Still one RAF loop in the app.** The window's own `update()`, called from
  that loop, calls into this scene only while the window is open and
  full-screen; the scene draws nothing otherwise,
  and skips the draw even then when the view has not moved enough to matter.
  Everything is built once at startup and reused, so reopening allocates
  nothing and there is no second loop or second context per open.
- The canvas is sized to the **viewport**, never to the window
  (`renderer.setSize(innerWidth, innerHeight, false)` — the `false` leaves the
  CSS size alone). That is what lets the open animation uncover a frame instead
  of re-rendering at a new size every frame of it.
- The renderer is **opaque** (no `alpha`): when open it covers the screen and
  has to hide the Scene 1 canvas behind it rather than composite over it.
- **Camera position is fixed at the origin, for good.** The mouse only turns
  it — `rotation.order = 'YXZ'` so yaw and pitch stay independent and the
  horizon cannot roll. Turning the camera is the whole point: it reads as
  looking around inside the space, where translating layers reads as sliding
  pictures. Note that rotation alone gives no depth parallax by construction;
  the depth comes from the objects really being at different distances.
- **The two axes are deliberately lopsided.** `MAX_YAW` is 0.3 rad (~17°
  across) but `MAX_PITCH` is only 0.04 (~2° up and down), so left/right is the
  pronounced move and vertical is barely a hint of weight. Keep the pitch a
  small fraction of the yaw; raising it back toward the yaw was reverted.
- The turn is **sprung, not lerped** (`SPRING_STIFFNESS` / `SPRING_DAMPING`,
  just under critical damping): it trails a fast pointer, coasts on after it
  stops and settles over about a second. That weight is most of what makes it
  feel cinematic — don't trade it for something that tracks the cursor tightly.
- Stars are a `Points` volume *surrounding* the camera: uniform directions and
  a cube-rooted radius between `STAR_NEAR` and `STAR_FAR`, so density per unit
  volume is even. The near bound matters — Three sizes points as
  `size * 0.5 * height / distance`, so a star much closer than that draws as a
  blob. Same soft radial sprite, additive blending and grayscale-only colours
  as the site's other field.
- Planets are billboards (`Sprite`), aimed by `yaw`/`pitch` from the camera and
  placed at `dist`, listed in `PLANETS`. On-screen size is
  `size / (2 * dist * tan(fov/2))` — the current values run ~17% of the frame
  height for the nearest down to ~4% for the farthest, and opacity falls with
  distance. Several sit outside the resting frustum on purpose, so turning the
  view actually finds something. Each sprite's aspect is read off its texture
  once it loads, so only the height is authored.
- **`PLANETS` may list the same file more than once** — `white.png` appears
  twice, once near and large on the left and once further off and half the size
  on the right, which reads as one body seen at two depths. The loader groups
  the list **by file**, so a texture is fetched and uploaded once however many
  planets use it. Keep that grouping if more repeats are added.
- `setActive(false)` recentres the camera and leaves **one still frame** on the
  canvas, ready for the next open. Render-on-demand, so nothing keeps drawing
  while the window is shut (and nothing is visible then either).

### Project cards (`src/ui/project-cards.ts` + the CSS3D layer)
Five cards — REJOX, TTU Clinic, Datassert, AGB Media, Naelj — in one straight
horizontal row **inside** the reveal window's space. They are DOM, drawn by a
`CSS3DRenderer` stacked over the WebGL canvas and given the **same camera**, so
they yaw and pitch with the stars and planets instead of sitting on the screen.
Two modules, split by question: `ui/project-cards.ts` owns what a card *is*
(the `PROJECTS` list and the DOM), `three/reveal.ts` owns where it *stands*.

- **Both renderers share one camera and one `render()`.** The CSS3D pass is
  called from the same on-demand `render()` as the WebGL pass in `reveal.ts`;
  split them and the two layers drift apart mid-turn. The cards live in their
  own `Scene` (`cssScene`), since a `CSS3DObject` has no geometry for the WebGL
  renderer to walk.
- **The layer is not the mask.** `.reveal-cards` is viewport-sized and centred
  on the window exactly like `.reveal-canvas`, so the opening window uncovers
  the row rather than re-laying it out. It carries **no `z-index`** — document
  order alone (canvas, cards, close) stacks it. Keep that order in
  `reveal-window.ts`.
- **Two elements per card, and that is load-bearing.** CSS3DRenderer writes its
  own `transform` onto the element it is given, so `.pcard-slot` can never
  carry one of ours; the inner `.pcard` is what scales on hover.
- The card row is authored in **CSS pixels and converted** — `CARD_SCALE` in
  `reveal.ts` turns the `CARD_PX_W`/`CARD_PX_H` box into world units, because
  CSS3DRenderer maps one CSS pixel to one world unit. Change the CSS box and
  that constant together or the cards resize on screen. `CARD_DIST` / `CARD_GAP`
  / `CARD_Y` place the row; at the current values it spans ~15.4 units either
  side of centre and clears the frame on anything wider than about 4:3.
- **Hover grows the card only.** `transform: scale(var(--pcard-hover))` about
  its own centre — each card is its own object out in the row, so no neighbour
  moves or resizes. The hovered card is also **moved to the end of its parent**
  (`ui/project-cards.ts`, on `pointerenter`/`focusin`): the cards are coplanar
  inside a `preserve-3d` container, where paint order and hit testing follow
  document order and `z-index` does not apply. CSS3DRenderer re-appends an
  element only when it is not already a child of its camera element, so it will
  not shuffle them back.
- At rest a card shows **only its name**. The stack line is collapsed
  (`max-height: 0`) rather than removed, and the VIEW button is `opacity: 0`
  *and* `pointer-events: none`, so neither is reachable until the card is
  entered or focused.
- **VIEW is a real `<a target="_blank">`**, bottom-right, black on the white
  face. Its mark says where it lands: GitHub's Invertocat for a repo (REJOX),
  Material's `open_in_new` for the four live sites, both flattened to one white
  per the palette rule. `kind` in the `PROJECTS` entry picks it.
- **The cards are inert while the window is shut.** `CSS3DObject` stamps
  `pointer-events: auto` inline, which would outrank any stylesheet rule and
  leave an opacity-0 card clickable over Scene 2 — `reveal.ts` clears that
  inline value so `.reveal-window.is-open .pcard-slot` is what decides. Don't
  put the inline value back.

## Model spin
The model spins slowly clockwise about its own vertical axis, forever.

- The model is parented to a **pivot `Group`** that sits at the origin. Only
  `pivot.rotation.y` is ever touched; the centring offset lives on the child.
  This is load-bearing: `fitModel()` centres the GLB by writing a translation
  onto the model itself, and Three applies translation *after* rotation, so
  spinning the model directly would swing it around the GLB's own origin —
  an orbit, not a spin. Keep the model inside the pivot.
- `SPIN_SPEED` is **negative** (`-MODEL_SPIN_RATE`, 0.09 rad/s, ~70s per
  revolution). From this bird's-eye camera a positive Y rotation reads
  counter-clockwise, so clockwise needs a negative rate. Flip the sign if the
  direction is ever meant to change.
- `MODEL_SPIN_RATE` is **exported** and the starfield's speed tiers are
  multiples of it, so changing it re-paces the site's stars too. That coupling
  is deliberate — see **Starfield**.
- During the scroll transition the model makes `TRANSITION_TURNS` extra
  revolutions **on top of** the idle spin: `rotation.y = idleAngle -
  TURNS * 2pi * progress`. The idle part is time-accumulated, the transition
  part is a pure function of progress — that split is what lands it on a whole
  number of turns however fast the page is scrolled. A time-integrated speed
  boost was tried first and cannot do this, since the total then depends on how
  long the user took to scroll. The term is negative to match `SPIN_SPEED`, so
  the scroll turn continues in the idle direction rather than fighting it.
- It advances by `delta` seconds, not per frame, so the speed is frame-rate
  independent. `delta` is clamped to 0.1s in `scene.ts`, so a throttled
  background tab animates slower than wall-clock — expected, same as the
  starfield.

## Starfield
The site's stars **orbit the model's centre** on roughly the model's own
orbital plane, so they read as one system with the stars embedded in the model.
There is no toward-camera dolly any more — that was removed deliberately
because it clashed with the model's rotating stars. Do not reintroduce it.

There are **two star layers**, both built by `createStarLayer` and advanced by
`advance()`, sharing one motion style — they differ only in where their stars
sit and how big the dots draw:

1. **the wide cloud** (`PARTICLE_COUNT`) — the ambient full-screen field.
2. **the close-in band** (`BAND_*`) — the orbits that stay on screen for a
   whole revolution. See **Why the wide field only shows arcs** below.

- Each star stores its own `radius` / `angle` / `speed`; per frame only the
  angle advances and x/z are recomputed as `cos/sin * radius`. Height is
  written once at init and never touched, which is what keeps every star on a
  level circle around the model's axis.
- With `x = cos`, `z = sin`, an **increasing** angle reads clockwise from the
  bird's-eye camera — matching the model's spin, which gets there via a
  *negative* `rotation.y`. The two conventions differ; don't "fix" one to match
  the other.
- Speeds come from `SPEED_TIERS`: ~78% slow, ~18% medium, ~4% fast, randomised
  within each tier so the motion is not uniform. **The tier bounds are
  multiples of `MODEL_SPIN_RATE`** (exported from `world.ts`), which is the rate
  the model's own embedded stars travel at. The slow tier starts at 0.8x that
  rate, so no site star ever crawls while the model's stars sweep past it —
  that mismatch is what made the two look like separate layers. Keep the tiers
  as multiples; don't hard-code rad/s back in.
- `POLAR_LIMIT` caps how near the poles a star may sit. A star close to the
  rotation axis has a near-zero orbit radius, so it turns on the spot and reads
  as frozen however fast it spins. Removing those was a big part of making the
  orbiting legible — don't raise this back toward 1.
- The cloud is a **flattened ball** (`CLOUD_RADIUS`, `CLOUD_FLATTEN`), not a
  thin disc. The camera pitches ~63° down, so its frustum passes through a thin
  disc and out the underside within ~25 units, leaving the frame empty. This
  was tried and rejected — keep the ball flattened, not flat.
- `PARTICLE_COUNT` is high (~20k) because only a narrow cone of the cloud is
  ever on screen, and it scales with `CLOUD_RADIUS`^3 — widening the cloud
  thins the visible field out fast. Count and `size` are tuned together against
  the original on-screen star density (~93 stars/megapixel, median dot area
  3px, median peak brightness 60); re-measure if either changes.
- The mouse tilt is applied to the **wide cloud only**. Tilting the band would
  break its full-loop visibility (5° is enough to push its near side off frame).
- Per-layer appearance goes through `createStarLayer`'s `look` argument
  (brightness range, opacity, boost), not hard-coded values. The band is
  deliberately brighter and whiter than the ambient field — `BAND_BRIGHT_*` /
  `BAND_OPACITY` vs `STAR_BRIGHT_*` / `STAR_OPACITY`, about 1.3x the ambient.
- A random `BAND_BOOST_CHANCE` (~30%) of band stars are lifted brighter still,
  rolled per star at build time so the pattern differs every load. **Their
  vertex colour deliberately exceeds 1.** The band's base is already near-pure
  white at full opacity, so there is no headroom inside 0..1; with additive
  blending and the soft radial sprite, an over-1 colour drives more of the dot's
  falloff to full white, which is what reads as brighter. `Color.setRGB` does
  not clamp when the colour space matches the working space, so the value
  survives into the buffer — don't "fix" it by clamping to 1.
- All star colours stay pure grayscale (r = g = b), so the white/black/silver
  palette holds regardless of brightness.
- Three sizes points as `size * 0.5 * drawingBufferHeight / distance` — **fov
  plays no part**. Any change to the cloud's scale needs `size` rescaled by the
  same factor or the dots change apparent size.
- **`Float32BufferAttribute` copies the array you hand it** (`super(new
  Float32Array(array), ...)`). Each layer's `positions` is therefore read back
  off the attribute (`posAttr.array`) and never kept from the array that filled
  it. Holding the pre-fill array writes to an orphan copy while flagging the
  real one, and every layer freezes — obviously for the band, silently for the
  cloud, whose mouse tilt is a rotation on the `Points` object and keeps moving
  either way. This has been shipped broken once; don't reintroduce it.

### Why the wide field only shows arcs (this is not a bug)
Stars in the wide cloud sweep a partial arc on screen, not a visible full loop.
**The orbit maths is already a true endless 360° circle** — `angle` is unbounded
and only increases, with no clamp, wrap or easing. Do not go looking for one.

The arc is camera geometry: the camera sits *inside* the cloud, 10.4 units from
the model's centre, while orbit radii run to 62. Most of any orbit therefore
passes beside or behind the camera. Measured against the frustum: the median
ever-visible star is on screen for **11.7% of its orbit** (~42°), and **no** star
in the wide cloud keeps a full orbit on screen.

For a full loop to be visible the orbit must fit the view cone, which caps it at
radius **~2.85** at the model's plane — barely wider than the model. That is
what the close-in band is, and why it is a separate layer rather than a tweak to
the cloud. Its window is genuinely tight and was solved against the frustum:

- **inner bound 2.47** — the model's slab is *square*, so its corners reach
  `MODEL_SPAN * √2/2`. Inside that the model draws over the band (the world
  layer renders after a depth clear) and the loop visibly breaks.
- **outer bound ~2.85** at y=0, ~3.00 at y=+1.
- **height** — the window closes entirely below y=−0.5 and above y=+1.5.

Known limitation: the band clips on **portrait** windows (aspect below ~0.85).
It cannot be fixed by shrinking the band, because anything under 2.47 disappears
behind the model's slab — it would need a different camera.

## Scroll transition (Scene 1 → Scene 2)
Scrolling drives four things **simultaneously off one value**. `state.scroll` is
raw page scroll 0..1; `scene.ts` smooths it into `progress` (`SCROLL_LERP`) once
per frame and every part reads that same number. Keep it that way — anything
driven off raw scroll, or off its own timer, will drift out of sync.

The scroll range comes from `body { min-height: 300vh }` in style.css. Everything
on screen is `position: fixed`, so the page has no content of its own to scroll;
that rule is the only reason a scroll range exists. Scene 2 does not exist yet —
progress 1 is simply the end state.

| what | where | at progress 1 |
| --- | --- | --- |
| band scatters outward | `BAND_SCATTER_*` in `scene.ts` | orbit radius 2.7 → ~11–29 |
| ambient stars fly past camera | `FLY_DISTANCE_*` in `scene.ts` | all past the camera, gone |
| camera dollies in and levels off | `SCENE2_CAMERA_*` in `world.ts` | dist 10.2 → 4.3, +63° → 0° |
| model turns one extra revolution | `TRANSITION_TURNS` in `world.ts` | exactly 360°, idle direction |

- Displacements are computed **from** `progress`, never accumulated frame to
  frame, so scrubbing back up rewinds exactly. It is also why the fly-past needs
  no wrap: a star that passes the camera keeps going and nothing returns it.
- Each layer has its own `ease` exponent (`FLY_EASE`, `BAND_SCATTER_EASE`) —
  same driver, different response curve. **These are load-bearing.** The first
  attempt used linear travel of 95–190 units and emptied the frame by scroll
  0.25, leaving nothing to watch for the remaining 75%. The travel is sized just
  under the 72.2 units that separates the far edge of the cloud from the camera,
  so deeper stars keep sweeping into view as the scroll runs. Re-check on-screen
  star counts across progress before retuning any of these.
- Star layers set `frustumCulled = false`. Three computes a geometry's bounding
  sphere once, and the transition moves stars far outside their initial bounds —
  with culling on, whole layers pop out of view mid-scroll.
- The fly direction is converted into each layer's local space before use,
  because the mouse tilt rotates the wide cloud's buffer.
- `SCENE2_CAMERA_POS.y` and `SCENE2_CAMERA_TARGET.y` are **equal**, which is what
  makes the end view exactly level. Keep them equal, and keep them above `y = 0`:
  the model's slab sits at 0 with all its detail on top, so a camera below that
  plane looks at the underside and hides the rings, planets and figure.

## Render passes
`renderer.autoClear` is **false**. Every frame, `scene.ts` does:
`clear()` → render starfield → `clearDepth()` → render world layer. **Both
passes use the world layer's bird's-eye camera** (`world.camera`) — sharing one
vantage is what makes the star orbits line up with the model's own plane, and
the starfield's old origin camera was removed for that reason. The two layers
still have separate scenes so the depth clear can guarantee the model always
draws in front of the stars, whatever their real depth. Keep this ordering.

## Animation loop
One single `requestAnimationFrame` loop lives in `src/main.ts`:
`scene.update(time, state)` runs every frame, reading `state` (mouse position
and scroll) and rendering both passes. It **returns the smoothed scroll
progress**, which `main.ts` uses to drive the DOM side of the transition (the
intro line out, the Scene 2 row in) off exactly the same value as the 3D
side — do not read `state.scroll` directly for animation, or it will drift out
of sync.

Do not create a second animation loop — any new per-frame logic (camera motion,
model animation, etc.) should hook into this same loop, ideally inside
`scene.ts`'s `update()` before the render calls. UI features do the same the
other way round: `src/ui/reveal-window.ts` and `src/ui/mark.ts` each expose an
`update()` that this loop calls once a frame. The window's 3D scene has its own
renderer but no loop of its own — the window calls into it only while it is
open — and the portrait's animation is a plain function of that loop's `time`,
not SMIL, a CSS animation or a timer.

## Removed (do not assume these exist)
The following existed in an earlier version of this project and were
deliberately deleted; do not reference them or recreate them without being
asked: `src/lib/depth.ts` (depth-item/camera-Z navigation engine),
`src/lib/projects.ts` (project data), `src/sections/` (hero/transition/work
sections), Lenis smooth-scroll, GSAP, the HUD (fps/coord/scroll-hint
overlay), and the red+wine accent palette / Polaroid-style project cards.

Also gone, more recently: the **two flush Scene 2 cards** (`.scene2-cards` /
`.scene2-card`, their `--card-*` tokens, the 1px boundary and collapsed
divider, and the hover scale that grew card and window together), and the
reveal window's **closed-state canvas tilt**. The Scene 2 row is bare type and
one image now — see **Scene 2 row** above before adding any box back.
