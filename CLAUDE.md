At the start of every session, and after every /clear, read vibe.md first before doing anything else.

# Personal Portfolio — Project Guide

## Stack
- **Vite** — build tool / dev server
- **TypeScript** — vanilla, no framework
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

- `src/main.ts` — mounts the full-screen `#scene` canvas, initializes the
  Three.js scene (`src/three/scene.ts`), starts mouse-pointer tracking
  (`src/lib/state.ts`), builds and appends the social icon row and the Scene 2
  card row, and runs the single RAF loop.
- `src/three/scene.ts` — owns the renderer and the orbiting particle starfield
  (white/silver dots only; see **Starfield** below). The particle field also
  tilts in response to mouse position. It owns the two-pass composite (see
  **Render passes**). It also owns the smoothed `progress` that drives the
  Scene 1 → Scene 2 transition (see **Scroll transition**).
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
- Social icon row (`.social-badges`, top-left) — three `.social-badge`-class
  links built in `main.ts`: GitHub (icon + "ashrafjr-n" label, links to
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
  border over the star crop.
  - **The right card and the reveal window scale together**, by the same factor
    about the same centre — the window is that card's box inset 1px all round,
    so one scale keeps them concentric and the star crop goes on filling the
    card. `--card-hover-duration` is shared by both for the same reason. This
    is the *only* time the window itself is transformed; opening still must not
    scale it.
  - Pointer routing is the fiddly part. The row is `pointer-events: none` and
    the cards opt back in via `.scene2-cards.is-live .scene2-card`, gated from
    `main.ts` because an opacity-0 element is still a hit target. The card the
    window covers is excluded (`:not(:last-child)`): the row paints above the
    closed window, so an interactive card there would swallow the window's
    clicks and tilt. Its hover is mirrored from the window's own
    `mouseenter`/`mouseleave` instead, through `setRevealCardHover()`, which
    sets `.is-hovered` on both elements and is cleared on open. **DOM overlay, not
  3D** — nothing was added to the Three.js layers, so Scene 1 and the
  transition are untouched. `opacity` starts at 0 in CSS and `main.ts` fades it
  in over the last `1 - CARDS_FADE_START` of the scroll off the same
  `progress` the scene returns, so the row is invisible until Scene 2. The
  right card carries the reveal window (below); the left one is still empty.
- Reveal window (`.reveal-window`) — see **Reveal window** below.
- Cursor — the default system cursor everywhere. A custom Saturn cursor and
  then a custom arrow both existed and were reverted; `public/cursor-saturn.svg`
  is gone and no `cursor: url(...)` rule remains. The only cursor rule left is
  `cursor: pointer` on `.social-badge`.

At rest (scroll 0) the world camera does not move; the mouse parallax affects
the wide starfield only. Everything else moves only under scroll.

## Reveal window (right Scene 2 card)
The project preview, shown through the right card. Assets live in
`public/assets/projects/`: `projects-background.png` (2664x1250) is the
backdrop — a **uniform starfield with no planets in it** — and `black.png`,
`white.png`, `one/two/three/four.png` are the planets, transparent-background
sprites layered over it. (`public/assets/projects-background.png`, one level
up, is the older combined art and is no longer referenced by anything.)

**The card is a mask, not an image container.** The backdrop is many times the
size of the closed window and never scales *as part of opening* — opening grows
the mask to fill the whole viewport, so what was already on screen stays put at
the same size and the new area uncovers more of the same image. Never scale or
pan the image to open it; that would read as a zoom. (The one scale that does
exist is the closed card's hover lift, which grows window and card together —
see the card hover notes above.)

- It is a **separate `position: fixed` element**, not the card itself: the card
  is a flex item in the row and could not fly out to the corner. Its closed
  geometry is therefore *derived* from the row's tokens (`--card-row-w/h/bottom`
  on `:root`, shared with `.scene2-cards`) rather than measured, so it lands
  exactly on the right card's inner box — `left: calc(50% + 0.5px)` works
  whatever the row's width because the divider is always centred, and the 1px
  border collapse leaves that inner box exactly where a row border did. Change
  the row's size only through those tokens or the two will drift apart.
- **One anchor point holds the backdrop**: its own centre, pinned to the centre
  of the mask in every state (`left: calc(50% - var(--anchor-x))`). Centring is
  both free — the field is uniform, there is no subject to compose on — and the
  cheapest option, since it makes the image smallest for full-screen coverage.
  Anchoring to the mask's top-left corner instead was what the smaller pop-out
  version did; at full screen that forces the crop into the image's corner and
  needs a far bigger image, so don't go back to it.
- `--img-w: max(180vw, 384vh)` — the backdrop is held at ~180% of the frame in
  both axes (`max()` picks whichever binds on the current aspect; half the
  image has to cover 50vw and 50vh at 100%). That is far more than the parallax
  shift needs, and the surplus is the point: an edge of the image must never be
  able to enter the frame, or the illusion of looking into a space collapses.
  The cost is that the 2664px PNG upscales on large monitors (~2x at 2560
  wide) — acceptable on a soft starfield. `--img-h` hard-codes the PNG's
  2664/1250 aspect — **replacing the backdrop means updating that ratio**.
- Open/close animates `left/bottom/width/height` (620ms expo-out) to a
  **full-screen** `0/0/100%/100%`. It cannot use a transform: scaling the mask
  would scale the image with it. Percentages, not `vw`/`vh`, so a classic
  scrollbar cannot push it past the visible area. There is no frame at that
  size — the edges are the screen's.
- The social badges sit at `z-index: 60`, above the window's 40, so the links
  stay visible and clickable over the takeover. Keep them above it.
- Closed only, the image tilts with the mouse: `rotateY` up to
  `REVEAL_TILT_MAX` degrees, damped by `REVEAL_TILT_LERP` in the single RAF
  loop, about a **fixed** `transform-origin` at the anchor point
  (`perspective()` lives in the transform, so that point is the vanishing point
  too). It is a rotation, never a pan — the crop must not slide.
- **Parallax planet field, open state only.** Six planets (`REVEAL_PLANETS` in
  `main.ts`) are scattered over the backdrop — centre as a % of the window,
  width in vw, positions deliberately uneven and clear of the badges and the
  close button. Every layer counter-moves against the mouse: the camera is
  fixed and only its facing turns, so turning right slides the world left.
  Vertical travel is `REVEAL_PARALLAX_Y` of the horizontal. The whole thing is
  aiming at looking *through* a window into a real space, not at six images
  sliding about, which is what the next two points are for.
  - The planets share **three depth planes** (`REVEAL_TIER`: far/mid/near),
    differing by a couple of px inside a plane and by ~20px between them. Six
    individually-tuned rates were tried first and read as separate stickers.
    `REVEAL_BACKDROP_DEPTH` sits well under all of them, so the backdrop is
    plainly the farthest thing in the frame.
  - Motion is a **spring, not a lerp** (`REVEAL_SPRING_STIFFNESS` /
    `REVEAL_SPRING_DAMPING`): each layer carries a velocity, so it trails a
    fast pointer, coasts on after it stops and settles over about a second,
    just under critical damping. That lag is most of what makes it feel
    cinematic — don't trade it back for something that tracks the cursor
    tightly.
  - It goes live only `REVEAL_OPEN_MS` after opening — **keep that in step with
    `--reveal-duration`** — so the field never moves while the window is still
    growing, and dies the instant it closes. While it is off the mouse is read
    as 0, so a closed window cannot move.
  - Layers damp back to exactly 0 and then have their inline `transform`
    dropped, so nothing is left applied to a closed window. Planet centring
    therefore uses the standalone `translate` property, not a
    `translate(-50%,-50%)` inside `transform` that clearing would wipe.
  - The backdrop is the one layer carrying both motions, so its transform is
    composed (parallax shift + the closed-state tilt) rather than just set.
- Opened by click/Enter/Space, closed by the `.reveal-close` button, a click
  outside, or Escape. Two permanent document listeners handle the last two; the
  opening click's target is inside the window, so it cannot self-close.
- It is faded and gated by hand in `updateScene2Cards()` (same `progress` as the
  row, since it is not a child of it) and only accepts input above
  `REVEAL_ACTIVE_AT`; scrolling back toward Scene 1 closes it.

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
`scene.ts`'s `update()` before the render calls.

## Removed (do not assume these exist)
The following existed in an earlier version of this project and were
deliberately deleted; do not reference them or recreate them without being
asked: `src/lib/depth.ts` (depth-item/camera-Z navigation engine),
`src/lib/projects.ts` (project data), `src/sections/` (hero/transition/work
sections), Lenis smooth-scroll, GSAP, the HUD (fps/coord/scroll-hint
overlay), and the red+wine accent palette / Polaroid-style project cards.
