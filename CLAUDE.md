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
- Design tokens live in the `:root` block of `src/style.css`.
- **The page background is pure `#000000` (`--bg`) and must stay that way.**
  The `space_boi` model's own material is pure black, so at `#000000` the model
  reads as one continuous surface with the page — its base slab is invisible
  and only the white orbit rings, planets and figure show. The body background
  is deliberately flat (no gradient) to preserve that. Do not add a gradient,
  lighten the background, or put a ground/backdrop mesh behind the model.
- Fonts loaded: **Space Grotesk** (`--font-display`, not yet applied to any
  element) and **JetBrains Mono** (`--font-code`, applied to body text and
  the GitHub badge).

## Current state
Scene 1 is the static opening composition: the `space_boi` diorama seen from a
bird's-eye camera, over the drifting starfield, on pure black. Most of the
original scroll/section system was intentionally stripped out and has not come
back. What exists today:

- `src/main.ts` — mounts the full-screen `#scene` canvas, initializes the
  Three.js scene (`src/three/scene.ts`), starts mouse-pointer tracking
  (`src/lib/state.ts`), builds and appends the GitHub badge, and runs the
  single RAF loop.
- `src/three/scene.ts` — owns the renderer and the orbiting particle starfield
  (white/silver dots only; see **Starfield** below). The particle field also
  tilts in response to mouse position. It owns the two-pass composite (see
  **Render passes**). There is no scroll input wired up anywhere in the app
  right now — `state.mouseX`/`state.mouseY` are the only live input values.
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
- `src/lib/state.ts` — shared `InputState` (`mouseX`, `mouseY` only) written
  by a `mousemove` listener, read every frame by the scene.
- GitHub badge — fixed top-left, links to `github.com/ashrafjr-n`.

The world camera does not move. Nothing in Scene 1 responds to input yet — the
mouse parallax affects the starfield only.

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
- Three sizes points as `size * 0.5 * drawingBufferHeight / distance` — **fov
  plays no part**. Any change to the cloud's scale needs `size` rescaled by the
  same factor or the dots change apparent size.

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
`scene.update(time, state)` runs every frame, reading `state` (mouse
position) and rendering both passes. Do not create a second animation loop —
any new per-frame logic (camera motion, model animation, etc.) should hook into
this same loop, ideally inside `scene.ts`'s `update()` before the render calls.

## Removed (do not assume these exist)
The following existed in an earlier version of this project and were
deliberately deleted; do not reference them or recreate them without being
asked: `src/lib/depth.ts` (depth-item/camera-Z navigation engine),
`src/lib/projects.ts` (project data), `src/sections/` (hero/transition/work
sections), Lenis smooth-scroll, GSAP, the HUD (fps/coord/scroll-hint
overlay), and the red+wine accent palette / Polaroid-style project cards.
