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
  bird's-eye `PerspectiveCamera` (fov 35, at `(0, 8, 6.5)` looking at
  `(0, 0.25, 0)`, ~47° above the horizon), white key/fill/ambient lights, the
  GLB load, and the spin (`update(delta)`). **There is no platform/pedestal
  mesh** — one existed briefly and was deliberately removed; the model's own
  black base is the ground.
- `public/models/space_boi.glb` — loaded via `GLTFLoader` (imported from
  `three/examples/jsm/loaders/GLTFLoader.js` inside the installed `three`
  package — no extra dependency, no Draco). It is a wide, shallow diorama with
  its own black base slab, so `fitModel()` scales it by its **horizontal
  footprint** (`MODEL_SPAN`), not its height — fitting by height overflows the
  viewport. It is then centered on x/z and dropped so it rests on `y = 0`.
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
- `SPIN_SPEED` is **negative** (`-0.09` rad/s, ~70s per revolution). From this
  bird's-eye camera a positive Y rotation reads counter-clockwise, so clockwise
  needs a negative rate. Flip the sign if the direction is ever meant to change.
- It advances by `delta` seconds, not per frame, so the speed is frame-rate
  independent. `delta` is clamped to 0.1s in `scene.ts`, so a throttled
  background tab animates slower than wall-clock — expected, same as the
  starfield.

## Starfield
The site's stars **orbit the model's centre** on roughly the model's own
orbital plane, so they read as one system with the stars embedded in the model.
There is no toward-camera dolly any more — that was removed deliberately
because it clashed with the model's rotating stars. Do not reintroduce it.

- Each star stores its own `radius` / `angle` / `speed`; per frame only the
  angle advances and x/z are recomputed as `cos/sin * radius`. Height is
  written once at init and never touched, which is what keeps every star on a
  level circle around the model's axis.
- With `x = cos`, `z = sin`, an **increasing** angle reads clockwise from the
  bird's-eye camera — matching the model's spin, which gets there via a
  *negative* `rotation.y`. The two conventions differ; don't "fix" one to match
  the other.
- Speeds come from `SPEED_TIERS`: ~78% slow, ~18% medium, ~4% fast, randomised
  within each tier so the motion is not uniform.
- The cloud is a **flattened ball** (`CLOUD_RADIUS`, `CLOUD_FLATTEN`), not a
  thin disc. The camera pitches ~50° down, so its frustum passes through a thin
  disc and out the underside within ~25 units, leaving the frame empty. This
  was tried and rejected — keep the ball flattened, not flat.
- `PARTICLE_COUNT` is high (~5.8k) because only a narrow cone of the cloud is
  ever on screen. Count and `size` are tuned together against the pre-change
  on-screen star density (~93 stars/megapixel); re-measure if either changes.
- Three sizes points as `size * 0.5 * drawingBufferHeight / distance` — **fov
  plays no part**. Any change to the cloud's scale needs `size` rescaled by the
  same factor or the dots change apparent size.

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
