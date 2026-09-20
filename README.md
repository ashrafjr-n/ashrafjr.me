# ashraf

Personal portfolio. A single scrolled page built as three scenes on one WebGL
starfield, with no framework and no animation library — the scroll position is
the only clock, and everything on screen is a pure function of it.

## Stack

- [Vite](https://vite.dev) — dev server and build
- TypeScript, vanilla, `strict`
- [Three.js](https://threejs.org) — the starfield and the model layer
- Plain CSS, with the design tokens in the `:root` block of `src/style.css`

No UI framework, no CSS framework, no state library, no icon package.

## Running it

```sh
npm install
npm run dev      # dev server
npm run check    # the scene-timing self-checks (see below)
npm run build    # typecheck, then a production build
```

## How the page is put together

Everything on screen is `position: fixed`, so the page has no content of its
own to scroll. The scroll range comes from a `min-height` on `body`, and
`src/lib/phases.ts` splits it into three scenes:

| | scene | |
| --- | --- | --- |
| **01** | a ring of stars orbiting an empty centre, over a drifting field | 300vh |
| **02** | three statements, sliding in and filling from outline to solid | 320vh |
| **03** | a white half rising from the bottom, inverting everything it covers | 340vh |

The bridge between the first two is **the scatter** (`src/lib/scatter.ts`):
the star field is not cleared away and replaced, it is dispersed. The ring
winds up, then breaks apart in two directions only — the stars on its inner
edge travel inward and through the centre, the ones on its outer edge travel
out — while the wind-up still turning underneath them bends both into spirals.
The orbit runs out, and a slice of the ambient cloud drifts to evenly spread
places across the frame. What is left is a still, even field of points, which
is Scene 2's backdrop and which Scene 3's panel inverts to black-on-white
without a second copy of anything.

The camera never moves, and nothing is ever turned to face it.

## Layout

```
src/
  main.ts          mounting and the single requestAnimationFrame loop
  lib/             the scroll maths, shared state, small helpers
  three/           the starfield, the world layer, the reveal window's scene
  ui/              each feature's DOM and behaviour, one file each
  style.css        tokens, layout, and every animation that is not JS-driven
public/            the model, the artwork
```

There is exactly one animation loop, in `src/main.ts`. Features expose an
`update()` that it calls; nothing runs on a timer of its own.

## The self-checks

`npm run check` runs `src/lib/phases.check.ts` and `src/lib/scatter.check.ts`
under node, with no test framework. They guard the two properties that fail
silently on screen rather than loudly in a console: that the scenes hand over
without a jump in speed, and that scrolling down through a sequence and back
up returns it to exactly where it started.

## Browser support

Modern evergreen browsers. `prefers-reduced-motion` is honoured: the scroll
smoothing and the idle orbit are both switched off, so nothing on the page
moves unless the reader moves it.
