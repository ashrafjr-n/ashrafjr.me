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
  social badges and the intro line). **Weight 400 only** for both — the
  Google Fonts request in `index.html` was trimmed to what is actually
  rendered, so anything set bolder than 400 will synthesize until the weight is
  added back to that URL.

## Current state
Scene 1 is the static opening composition: the `space_boi` diorama seen from a
bird's-eye camera, over the drifting starfield, on pure black. Most of the
original scroll/section system was intentionally stripped out and has not come
back. What exists today:

- `src/main.ts` — wiring only: mounts the full-screen `#scene` canvas, the
  intro line and the Scene 2 card row, initializes the Three.js scene
  (`src/three/scene.ts`), starts input tracking (`src/lib/state.ts`), mounts
  the social row and the reveal window, and runs the single RAF loop with the
  DOM side of the scroll transition. Feature markup and behaviour live in
  `src/ui/`, not here.
- `src/ui/social.ts` — the social icon row: the three inline SVGs, the
  `SOCIAL_LINKS` data and the one factory that builds them.
- `src/ui/reveal-window.ts` — the reveal window as one unit: its DOM, its
  open/close and hover behaviour, its closed-state tilt, and the 3D layer
  behind it (see **Reveal window** below). `main.ts` only fades it and calls
  its `update()`.
- `src/three/scene.ts` — owns the renderer and the orbiting particle starfield
  (white/silver dots only; see **Starfield** below). The particle field also
  tilts in response to mouse position. It owns the two-pass composite (see
  **Render passes**). It also owns the smoothed `progress` that drives the
  Scene 1 → Scene 2 transition (see **Scroll transition**).
- `src/three/reveal.ts` — the reveal window's own 3D scene: its own renderer,
  scene and fixed camera, shared with nothing (see **Reveal window** below).
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
- Scene 2 card row (`.scene2-cards`, bottom-centre) — two flush `.scene2-card`
  divs built in `main.ts` from `SCENE2_CARD_COUNT`, sitting below the model in
  the levelled Scene 2 view. **Both are empty** — shape only, no content yet.
  They read as one wide rectangle split by a single line: **each card carries
  its own full 1px border** and the second is pulled onto the first with
  `margin-left: -1px`, so the two adjacent borders collapse into one divider
  and the outer boundary is unchanged. The row itself has no border — a card
  needs a complete rectangle of its own to be able to grow on hover. Sharp
  corners on purpose — no `border-radius`. **The line is one token,
  `--card-line`** (white at 0.16), plus a near-invisible `--card-line-glow`
  bloom; a solid `#fff` line was tried and read too harsh against the black.
  Keep both cards on that same token so the boundary and the divider never
  diverge.
- Card hover — the hovered card scales by `--card-hover-scale` (1.09) and lifts
  to `z-index: 2` over its neighbour, its border deepening to
  `--card-line-hover`. It is a transform, so the other card never moves or
  resizes; flex items honour `z-index` without being positioned, which is what
  lets the growing one overlap rather than be clipped. The closed window sits at
  `z-index: 15`, under the row, so a card growing across the divider draws its
  border over the 3D view.
  - **The right card and the reveal window scale together**, by the same factor
    about the same centre — the window is that card's box inset 1px all round,
    so one scale keeps them concentric and the view goes on filling the card. `--card-hover-duration` is shared by both for the same reason. This
    is the *only* time the window itself is transformed; opening still must not
    scale it.
  - Pointer routing is the fiddly part. The row is `pointer-events: none` and
    the cards opt back in via `.scene2-cards.is-live .scene2-card`, gated from
    `main.ts` because an opacity-0 element is still a hit target. The card the
    window covers is excluded (`:not(:last-child)`): the row paints above the
    closed window, so an interactive card there would swallow the window's
    clicks and tilt. Its hover is mirrored from the window's own
    `mouseenter`/`mouseleave` instead, through `setCardHover()` in
    `src/ui/reveal-window.ts`, which sets `.is-hovered` on both elements and is
    cleared on open. The window is handed that card at construction.
  - The row is a **DOM overlay** — nothing about it was added to the Scene 1
    Three.js layers, so Scene 1 and the transition are untouched. `opacity`
    starts at 0 in CSS and `main.ts` fades it in over the last
    `1 - CARDS_FADE_START` of the scroll off the same `progress` the scene
    returns, so the row is invisible until Scene 2. The right card carries the
    reveal window (below, which *is* 3D); the left one is still empty.
- Reveal window (`.reveal-window`) — see **Reveal window** below.
- Cursor — the default system cursor everywhere. A custom Saturn cursor and
  then a custom arrow both existed and were reverted; `public/cursor-saturn.svg`
  is gone and no `cursor: url(...)` rule remains. The only cursor rule left is
  `cursor: pointer` on `.social-badge`.

At rest (scroll 0) the world camera does not move; the mouse parallax affects
the wide starfield only. Everything else moves only under scroll.

## Reveal window (right Scene 2 card)
The project preview, shown through the right card. The element and everything
it does live in `src/ui/reveal-window.ts`; the 3D layer behind it is
`src/three/reveal.ts`. It is a **real Three.js scene**, not stacked images: a
particle star volume around a fixed camera, with the planet PNGs as billboards
at their own distances. An earlier version composited `projects-background.png`
and six planet `<img>`s with CSS transforms; that was replaced because layer
translation cannot produce a true look-around, and it should not come back.
`public/assets/projects/black|white|one|two|three|four.png` are still used, as
sprite textures. The `projects-background.png` files went unreferenced with
that change and have been deleted.

**The card is a mask, not a viewport of its own.** The canvas inside is always
viewport-sized, so opening grows the mask to fill the screen and what was
already on screen stays put at the same size, uncovering more of the same
rendered frame — the closed card is literally a small slice of the view the
open one fills the screen with. Never resize or scale the canvas to open it;
that would read as a zoom. (The one scale that does exist is the closed card's
hover lift, which grows window and card together — see the card hover notes
above.)

- It is a **separate `position: fixed` element**, not the card itself: the card
  is a flex item in the row and could not fly out to the corner. Its closed
  geometry is therefore *derived* from the row's tokens (`--card-row-w/h/bottom`
  on `:root`, shared with `.scene2-cards`) rather than measured, so it lands
  exactly on the right card's inner box — `left: calc(50% + 0.5px)` works
  whatever the row's width because the divider is always centred, and the 1px
  border collapse leaves that inner box exactly where a row border did. Change
  the row's size only through those tokens or the two will drift apart.
- Open/close animates `left/bottom/width/height` (620ms expo-out) to a
  **full-screen** `0/0/100%/100%`. It cannot use a transform: scaling the mask
  would scale the canvas with it. Percentages, not `vw`/`vh`, so a classic
  scrollbar cannot push it past the visible area. There is no frame at that
  size — the edges are the screen's.
- The social badges sit at `z-index: 60`, above the window's 40, so the links
  stay visible and clickable over the takeover. Keep them above it.
- Closed only, the canvas tilts with the mouse: `rotateY` up to `TILT_MAX`
  degrees, damped by `TILT_LERP`, driven from the single RAF loop. It is a CSS
  rotation of the whole canvas about its own centre, nothing to do with the 3D
  camera.
- Opened by click/Enter/Space, closed by the `.reveal-close` button, a click
  outside, or Escape. Two permanent document listeners handle the last two; the
  opening click's target is inside the window, so it cannot self-close.
- It is faded and gated by hand from `updateScene2Cards()` in `main.ts` (same
  `progress` as the row, since it is not a child of it) via `setOpacity()` and
  `setInteractive()`, and only accepts input above `REVEAL_ACTIVE_AT`;
  scrolling back toward Scene 1 closes it.
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
- `setActive(false)` recentres the camera and leaves **one still frame** on the
  canvas. That frame is what the closed card shows; render-on-demand, so
  nothing keeps drawing while the window is shut.

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
intro line out, the Scene 2 card row in) off exactly the same value as the 3D
side — do not read `state.scroll` directly for animation, or it will drift out
of sync.

Do not create a second animation loop — any new per-frame logic (camera motion,
model animation, etc.) should hook into this same loop, ideally inside
`scene.ts`'s `update()` before the render calls. UI features do the same the
other way round: `src/ui/reveal-window.ts` exposes an `update()` that this loop
calls once a frame, and its 3D scene has its own renderer but no loop of its
own — the window calls into it only while it is open.

## Removed (do not assume these exist)
The following existed in an earlier version of this project and were
deliberately deleted; do not reference them or recreate them without being
asked: `src/lib/depth.ts` (depth-item/camera-Z navigation engine),
`src/lib/projects.ts` (project data), `src/sections/` (hero/transition/work
sections), Lenis smooth-scroll, GSAP, the HUD (fps/coord/scroll-hint
overlay), and the red+wine accent palette / Polaroid-style project cards.
