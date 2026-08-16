At the start of every session, and after every /clear, read vibe.md first before doing anything else.

# Personal Portfolio — Project Guide

## Stack
- **Vite** — build tool / dev server
- **TypeScript** — vanilla, no framework
- **Three.js** — 3D scene work (`src/three/`)
- **Plain CSS** — no Tailwind, no CSS framework (`src/style.css`)

## Theme
- Dark, cinematic.
- Palette is **white / black / silver-gray only** — no other colors anywhere
  (CSS, 3D materials, gradients, shadows). Enforce this on every visual change.
- Design tokens live in the `:root` block of `src/style.css`.
- Fonts loaded: **Space Grotesk** (`--font-display`, not yet applied to any
  element) and **JetBrains Mono** (`--font-code`, applied to body text and
  the GitHub badge).

## Current state
This is currently a minimal starting point, not the full depth-navigation
portfolio the project name implies — most of the original scroll/section
system was intentionally stripped out. What exists today:

- `src/main.ts` — mounts the full-screen `#scene` canvas, initializes the
  Three.js starfield (`src/three/scene.ts`), starts mouse-pointer tracking
  (`src/lib/state.ts`), builds and appends the GitHub badge, and runs the
  single RAF loop.
- `src/three/scene.ts` — a drifting particle starfield (white/silver dots
  only). The camera is fixed at the origin; only the particle field tilts
  in response to mouse position. There is no scroll input wired up anywhere
  in the app right now — `state.mouseX`/`state.mouseY` are the only live
  input values.
- `src/lib/state.ts` — shared `InputState` (`mouseX`, `mouseY` only) written
  by a `mousemove` listener, read every frame by the scene.
- GitHub badge — fixed top-left, links to `github.com/ashrafjr-n`.
- `public/models/space_boi.glb` — a 3D model asset present in the repo but
  **not yet loaded or used anywhere in code**. No `GLTFLoader` is set up yet
  (it ships inside the installed `three` package at
  `three/examples/jsm/loaders/GLTFLoader.js` and can be imported directly
  when needed — no new dependency required for this file, since it has no
  Draco compression).

## Animation loop
One single `requestAnimationFrame` loop lives in `src/main.ts`:
`scene.update(time, state)` runs every frame, reading `state` (mouse
position) and rendering. Do not create a second animation loop — any new
per-frame logic (camera motion, model animation, etc.) should hook into this
same loop, ideally inside `scene.ts`'s `update()` alongside the existing
render call.

## Removed (do not assume these exist)
The following existed in an earlier version of this project and were
deliberately deleted; do not reference them or recreate them without being
asked: `src/lib/depth.ts` (depth-item/camera-Z navigation engine),
`src/lib/projects.ts` (project data), `src/sections/` (hero/transition/work
sections), Lenis smooth-scroll, GSAP, the HUD (fps/coord/scroll-hint
overlay), and the red+wine accent palette / Polaroid-style project cards.
