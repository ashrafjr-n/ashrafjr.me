# ashraf

My personal portfolio. It opens on a ring of clouds in a blue sky; scrolling
dives through the ring into a tunnel of three statements and out onto my
projects. There is a dark mode, and each visit opens on a short 0–99 count.

## Built with

- **[Three.js](https://threejs.org)**: the sky, the ring of clouds, the
  scroll-driven camera and the dark mode's stars
- **[troika-three-text](https://github.com/protectwise/troika/tree/main/packages/troika-three-text)**:
  the tunnel's 3D type
- **TypeScript**: vanilla and `strict`, with no UI framework
- **[Vite](https://vite.dev)**: dev server and build
- **Plain CSS**: design tokens, layout and every transition, with no CSS
  framework
- **Space Grotesk** and **JetBrains Mono**, from Google Fonts, and
  **DM Serif Display** (OFL), self-hosted
- **Lucide** and **Simple Icons**: the icon paths are embedded inline, so there
  is no icon package

No animation library either: one `requestAnimationFrame` loop and CSS
transitions.

## Running it

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck, then a production build
```

## Projects

The projects list reads a single array, `PROJECTS` in `src/ui/projects.ts`,
which holds each project's name, link, screenshot, short note and stack. The
screenshots live in `public/assets/projects/`.

`prefers-reduced-motion` is honoured: the ring holds still and the journey
follows the scroll exactly, with no easing after it.
