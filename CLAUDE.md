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
- **Scene 1 silver is `#a9aeb3`, declared twice and must stay in sync:**
  `--silver` in `src/style.css` and `SILVER` in `src/three/world.ts`. The page
  background and the platform mesh must render the *exact* same pixel value —
  the body background is deliberately flat (no gradient) and the platform uses
  an unlit `MeshBasicMaterial` with `toneMapped: false` for that reason. Do not
  add a gradient to the body or a lit material to the platform.
- Fonts loaded: **Space Grotesk** (`--font-display`, not yet applied to any
  element) and **JetBrains Mono** (`--font-code`, applied to body text and
  the GitHub badge).

## Current state
Scene 1 is the static opening composition: the `space_boi` diorama on a silver
platform, seen from a bird's-eye camera, over the drifting starfield. Most of
the original scroll/section system was intentionally stripped out and has not
come back. What exists today:

- `src/main.ts` — mounts the full-screen `#scene` canvas, initializes the
  Three.js scene (`src/three/scene.ts`), starts mouse-pointer tracking
  (`src/lib/state.ts`), builds and appends the GitHub badge, and runs the
  single RAF loop.
- `src/three/scene.ts` — owns the renderer and the drifting particle starfield
  (white/silver dots only). The starfield camera is fixed at the origin; only
  the particle field tilts in response to mouse position. It also owns the
  two-pass composite (see **Render passes** below). There is no scroll input
  wired up anywhere in the app right now — `state.mouseX`/`state.mouseY` are
  the only live input values.
- `src/three/world.ts` — the Scene 1 world layer: its own `Scene` +
  bird's-eye `PerspectiveCamera` (fov 35, at `(0, 8, 6.5)` looking at
  `(0, 0.25, 0)`, ~47° above the horizon), white key/fill/ambient lights, the
  flat silver square platform, and the GLB load. Exports `SILVER`.
- `public/models/space_boi.glb` — loaded via `GLTFLoader` (imported from
  `three/examples/jsm/loaders/GLTFLoader.js` inside the installed `three`
  package — no extra dependency, no Draco). It is a wide, shallow diorama with
  its own black base slab, so `fitToPlatform()` scales it by its **horizontal
  footprint** (`MODEL_SPAN`), not its height — fitting by height overflows the
  viewport. It is then centered on x/z and dropped onto the platform.
- `src/lib/state.ts` — shared `InputState` (`mouseX`, `mouseY` only) written
  by a `mousemove` listener, read every frame by the scene.
- GitHub badge — fixed top-left, links to `github.com/ashrafjr-n`.

The model has no animation, and the world camera does not move. Nothing in
Scene 1 responds to input yet — the mouse parallax affects the starfield only.

## Render passes
`renderer.autoClear` is **false**. Every frame, `scene.ts` does:
`clear()` → render starfield (origin camera) → `clearDepth()` → render world
layer (bird's-eye camera). The two layers have separate scenes and cameras so
the world camera can be repositioned freely without disturbing the starfield's
fixed-at-origin drift/wrap logic. Keep this ordering.

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
