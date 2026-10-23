# SOLARIS — Planets, Up Close

A cinematic planet-to-planet experience. Every planet page is a full-bleed "photograph" with a huge title, a stats table and a squircle **portal card** showing the next world from orbit. Step into the card: it opens to full screen, the camera falls through the planet's clouds, and you land on the next surface.

Nothing is downloaded: every landscape, planet texture and star is painted live on your GPU.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## What you get

| | |
| --- | --- |
| **Portal card** | A rounded-box SDF drawn in the compositor. Hover shows an "Enter" cursor ring; click and the card morphs to full screen, then a radial-blur dive through a procedurally noised cloud deck hands over to the arrival surface. |
| **Eight surfaces** | Mercury (airless crater field, black sky, huge low sun), Venus (sulfur haze, basalt plates, lava-lit cracks, shield volcanoes), Earth (savanna sunset with an acacia), Mars (dust-hazed buttes and boulder fields), Jupiter (cloud sea with the Great Red Spot, Io and Europa), Saturn (the real ring-plane geometry arching overhead), Uranus (pale methane haze), Neptune (ultramarine storm decks, cirrus streaks, Triton). |
| **Depth parallax** | Each photograph is baked with a depth channel; the pointer shifts the image by depth, so it feels 3D without any 3D at run time. |
| **Orbit views** | The card shows the next planet as a live 3D globe: baked surface, bump-mapped lighting, clouds, scattering atmosphere and rings. The same view is the **Explore** globe (drag, scroll, ← →) with Overview / Data / Atmosphere / Facts. |
| **Pages** | Planets (index of live-rendered portraits), Explore, About and a full-screen Menu with sound, motion, quality and title-typeface settings. |
| **Typography** | A heavy, very condensed title face (Anton, squeezed to the reference's proportions). The typeface selector in the Menu offers six more, including the original Syncopate as an opt-in. |
| **Responsive** | Desktop layout from the reference; on phones the nav collapses to the Menu, the planet list becomes numbered chips and the stats table is trimmed. |
| **Robust** | Keyboard (← → Enter), focus rings, reduced-motion mode, adaptive canvas resolution, and a plain-CSS fallback when WebGL2 is unavailable. |

## How the "photographs" are made

`src/cine/surface/` — a scene is three pieces of GLSL (constants and camera, a height function, and sky/shading/grade). Baking is two GPU passes:

1. **Height** — the scene's `terrainH()` is evaluated once per texel of a log-polar height map around the camera (angle × log-distance, so texels match screen pixels at every range). Noise here is interpolated exactly (`texelFetch`), because hardware filtering has only ~8 bits of weight precision, which steep terrain amplifies into terraces.
2. **Colour** — rays are marched against that cached map (one fetch per step), shaded with soft shadows and ambient occlusion, fogged, tone-mapped and dithered. RGB is the image, A is parallax depth. Normals come from a bicubic (B-spline) height lookup.

Strips are scissored and paced with GPU fences, so even the heaviest planet never freezes the page. The first planet bakes during the loader; the rest bake quietly in the background (one small strip per frame) and are promoted to full speed the moment you ask for them.

## Structure

```
src/
  cine/
    stage.ts        renderer, loop, compositor uniforms, asset scheduling
    composite.ts    the single screen shader: parallax backdrop, squircle card, dive, grain
    orbit.ts        live planet view (portal card, Explore globe, thumbnails)
    director.ts     choreography (intro, card→dive→arrival, explore) with GSAP
    gpu.ts          strip renderer + fence waits (never blocks the main thread)
    surface/        glsl.ts (engine), baker.ts, scenes/*.ts (one file per planet)
  three/            planet texture recipes (GPU baked) + atmosphere/ring/cloud shaders
  data/             planets.ts (order, stats), bodies.ts (NASA fact sheet data), fonts.ts
  ui/               Loader, Chrome (nav, list, portal, title, stats, cursor), Overlays, Explore
  state/            zustand store
```

Dev aids (dev server only): `/?lab=mars&w=1600` bakes one scene full-window (`&dbg=1…6` shows shadow/AO/normal/albedo/distance/contours, `&view=depth|height`, `&cx=&cy=&z=` to zoom); `/?start=earth` boots straight onto another planet; `window.__solaris` exposes the stage, director and store.

## Adding or changing a planet

Edit its file in `src/cine/surface/scenes/`. A scene provides `camPos/camTarget/camFocal/sunDir`, `terrainH`, `skyColor`, `fogColor`, `shadeTerrain`, `overlay` and `grade`; `scenes/shared.ts` has cloud decks, cirrus, moons and cellular noise. Stats and copy live in `src/data/planets.ts`.

## Honesty notes

- Distances, years and temperatures come from the NASA Planetary Fact Sheet. The landscapes are artistic impressions, not survey data.
- Jupiter, Saturn, Uranus and Neptune have no ground; their pages are views from above the cloud tops.

This design replaced the original scroll-driven SOLARIS journey.
