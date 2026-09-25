# ashraf

My personal portfolio, in 3D. It opens on a sky of clouds; scrolling drops
through a window into my work, education and projects. There is a dark mode.

It is built on [mohitvirli.github.io](https://github.com/mohitvirli/mohitvirli.github.io)
by Mohit Virli, with his permission.

## Built with

- **Next.js** (static export) and **React**
- **React Three Fiber** and **drei**
- **GSAP**
- **Zustand**
- **Tailwind CSS**

## Running it

```sh
npm install
npm run dev      # dev server on http://localhost:3000
npm run build    # static export to out/
```

Pushing to `master` deploys to GitHub Pages (`.github/workflows/nextjs.yml`).
For a custom domain, set the `GH_PAGES_CUSTOM_DOMAIN` secret and the build
writes `public/CNAME`. Set `NEXT_PUBLIC_GA_ID` to turn on Google Analytics.

## Content

- Projects: `app/constants/projects.ts`
- Work and education: `app/constants/work.ts`
- Footer links: `app/constants/footer.ts`

## Credits

3D models from Sketchfab:

- [Residential Window](https://sketchfab.com/3d-models/residential-window-ae11104237314463a61251fd46ded4b4)
  by AleixoAlonso, [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)
- [Dali, The Persistence of Memory](https://sketchfab.com/3d-models/dalithe-persistence-of-memory-ab3e99facbdb4d9d8661d3f07815638e)
  by arloopa, [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)
- [Wanderer above the sea of fog](https://sketchfab.com/3d-models/wanderer-above-the-sea-of-fog-518e605e9b734c86aab5bc22f9797f77)
  by betocarrillo, [CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/)
