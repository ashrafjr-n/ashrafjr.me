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
the star field is not cleared away and replaced, it is dispersed. A wave runs
once around the ring's circumference letting stars go, so the ring unravels
from a point and keeps its shape everywhere the wave has not reached. Each star
that lets go travels in one of only two directions — inward through the centre
and out the far side, or outward — winding on a spiral that is tighter the
shorter its travel, the way an orbiting body turns as its radius changes. The
orbit runs out, and a slice of the ambient cloud drifts to evenly spread places
across the frame.

The camera never moves, nothing is turned to face it, and no star's depth
changes. Where Scene 3's white panel covers the field, the stars are drawn
heavier so they survive being inverted; scrolling back up takes that away
again.

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
