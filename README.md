# SOLARIS — Planets, Up Close

A cinematic planet-to-planet experience. Every planet page is a full-bleed "photograph" with a huge title, a stats table and a squircle **portal card** showing the next world from orbit. Step into the card: it opens to full screen, the camera falls through the planet's clouds, and you land on the next surface.

**Live: https://rahul9994.github.io/solaris/**

Everything the site needs ships from this repository: the planet pictures (`public/baked/`, ~8 MB, painted once by the GPU recipes below), the fonts (`src/assets/fonts/`), and the code. There are no third-party requests and nothing to paint at load time, so it opens in a second or two. Stars and the cloud dive are still generated live (they are cheap).

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
| **Liquid glass** | One material (`src/styles/glass.css`) for the whole interface: a faint tint, a colour-boosting blur, a lit rim that is bright toward the upper left, an inner highlight and a pointer-following sheen. The nav highlight is a droplet that stretches across the gap it travels; the planet index has a glass bead that does the same; the cursor is a drop of glass that leans into its own motion. The portal card itself is glass in the shader: a bezel that bends and splits the view into colour fringes, a specular rim that catches a drifting light, and an outline that ripples and swells toward the pointer. |
| **Eight surfaces** | Mercury (airless crater field, black sky, huge low sun), Venus (sulfur haze, basalt plates, lava-lit cracks, shield volcanoes), Earth (savanna sunset with an acacia), Mars (dust-hazed buttes and boulder fields), Jupiter (cloud sea with the Great Red Spot, Io and Europa), Saturn (the real ring-plane geometry arching overhead), Uranus (pale methane haze), Neptune (ultramarine storm decks, cirrus streaks, Triton). |
| **Depth parallax** | Each photograph is baked with a depth channel; the pointer shifts the image by depth, so it feels 3D without any 3D at run time. |
| **Orbit views** | The card shows the next planet as a live 3D globe: baked surface, bump-mapped lighting, clouds, scattering atmosphere and rings. The same view is the **Explore** globe (drag, scroll, ← →) with Overview / Data / Atmosphere / Facts. |
| **Pages** | Planets (index of live-rendered portraits), Explore, About and a full-screen Menu with sound, motion, quality and title-typeface settings. |
| **Typography** | A heavy, very condensed title face (Anton, squeezed to the reference's proportions). The typeface selector in the Menu offers six more, including the original Syncopate as an opt-in. |
| **Responsive** | Desktop layout from the reference; on phones the nav collapses to the Menu, the planet list becomes numbered chips and the stats table is trimmed. |
| **Robust** | Keyboard (← → Enter), focus rings, reduced-motion mode, adaptive canvas resolution, and a plain-CSS fallback when WebGL2 is unavailable. |

## 60 fps

Measured on an Intel UHD iGPU at 1920×1080 / DPR 1.25 (the slowest machine this has been tried on), GPU + CPU time per frame, each frame forced to finish:

| state | before | now |
| --- | --- | --- |
| resting page (card + photograph) | 15–19 ms | 8–9 ms |
| Explore globe | 18 ms | 10–11 ms |
| the dive through the clouds | 21 ms | ~10 ms (at 1080p×1.25) |

What changed:

- **Dust is sprites, not a per-pixel loop.** ~170 point sprites (`src/cine/motes.ts`) replace three layers of grid hashing in the compositor: 4 ms saved at 1080p.
- **The orbit view is only as big as it is seen.** At rest the card shows a small crop, so its render target is sized to the card (~1.3 texels per pixel); it grows to screen size when the card opens, and shrinks a little during the dive, where it is blurred anyway. Stars are drawn after the planet with the depth test on, so their shader never runs behind the globe.
- **The cloud deck renders at half resolution** into its own target (`CLOUD_FRAG`); the compositor just reads it.
- **The compositor skips what can't be seen:** the card SDF (and its pow/exp) is only evaluated within reach of the card's shadow, the parallax uses one depth tap, and the radial blurs use 6–7 taps.
- **A frame-rate governor** (`Stage.adapt`) times frames; a whole second slower than ~49 fps sheds ~10% of the canvas pixels (floor 0.6), and calm spells probe one step back up (backing off exponentially after a failed probe). High-refresh screens are never held back.
- **Idle behind overlays:** while a full-screen overlay hides the scene, the loop drops to ~15 fps.
- **Glass is cheap by construction:** only a handful of small elements blur over the live canvas; big surfaces (menu, Explore panel) only blur while open; everything animates with `transform` / `opacity`.

Add `?fps` to the address to see a live readout (frame rate, canvas size and resolution scale, orbit target size).

## How the "photographs" are made (and why they are shipped, not painted at load)

`src/cine/surface/` — a scene is three pieces of GLSL (constants and camera, a height function, and sky/shading/grade). Baking is two GPU passes:

1. **Height** — the scene's `terrainH()` is evaluated once per texel of a log-polar height map around the camera (angle × log-distance, so texels match screen pixels at every range). Noise here is interpolated exactly (`texelFetch`), because hardware filtering has only ~8 bits of weight precision, which steep terrain amplifies into terraces.
2. **Colour** — rays are marched against that cached map (one fetch per step), shaded with soft shadows and ambient occlusion, fogged, tone-mapped and dithered. RGB is the image, A is parallax depth. Normals come from a bicubic (B-spline) height lookup.

Strips are scissored and paced with GPU fences, so even the heaviest planet never freezes the page.

**Baked once, offline.** Painting all eight planets takes a GPU 5–10 s each, which used to be the loading screen. Now the results live in the repo: `public/baked/` holds, per planet, a surface photograph (colour + parallax depth, 2560×1440) and an orbit texture (colour + height, 2048×1024), plus Earth's cloud/lights mask and the ring strips. `src/data/baked.json` lists them (with a content hash in every file name, so browsers never mix old and new). At run time a picture is fetched, decoded by the browser and merged on the GPU (`src/cine/bakedLoad.ts`): about 2 MB for the first screen, the rest streams in quietly. Colour is lossy WebP; depth is lossy gray WebP; height maps and packed data channels are lossless WebP (lossy noise would show up as grain in the bump shading).

If a picture is missing or fails to load, that planet is painted on the GPU instead, exactly as before (`?bake=gpu` forces this for testing).

**Re-baking** (after editing a scene or recipe): run `npm run dev`, open `http://localhost:5173/bake.html?auto=1`, wait for "done" (about 2 minutes), then commit `public/baked/` and `src/data/baked.json`. Options: `?only=mars,earth`, `sw=2560` (surface width), `pw=2048` (texture width), `q=0.92` (lossy quality). Files are written by a dev-only, localhost-only endpoint (`tools/bakeSink.ts`) that is not part of the production build.

## Structure

```
src/
  cine/
    stage.ts        renderer, loop, compositor uniforms, asset scheduling
    bakedLoad.ts    fetches the shipped pictures and merges them into render targets on the GPU
    composite.ts    the screen shader (parallax backdrop, glass card, dive, grain) + the half-res cloud-deck shader
    motes.ts        dust sprites
    orbit.ts        live planet view (portal card, Explore globe, thumbnails)
    director.ts     choreography (intro, card→dive→arrival, explore) with GSAP
    gpu.ts          strip renderer + fence waits (never blocks the main thread)
    surface/        glsl.ts (engine), baker.ts, scenes/*.ts (one file per planet)
  three/            planet texture recipes (used by the bake tool / fallback) + atmosphere/ring/cloud shaders
  tools/bake.ts     the offline bake (bake.html): paints, encodes and saves everything
  assets/fonts/     self-hosted woff2 fonts (licences in LICENSES.md)
  styles/           app.css, glass.css (the liquid-glass material), fonts.css
  data/             planets.ts (order, stats), bodies.ts (NASA fact sheet data), fonts.ts
  ui/               Loader, Chrome (nav, list, portal, title, stats, cursor), Overlays, Explore
  state/            zustand store
public/baked/       the shipped planet pictures (written by the bake tool)
tools/bakeSink.ts   dev-only file receiver for the bake tool
```

Dev aids (dev server only): `/?lab=mars&w=1600` bakes one scene full-window (`&dbg=1…6` shows shadow/AO/normal/albedo/distance/contours, `&view=depth|height`, `&cx=&cy=&z=` to zoom); `/?start=earth` boots straight onto another planet; `window.__solaris` exposes the stage, director and store.

## Adding or changing a planet

Edit its file in `src/cine/surface/scenes/`, then re-bake (see above). A scene provides `camPos/camTarget/camFocal/sunDir`, `terrainH`, `skyColor`, `fogColor`, `shadeTerrain`, `overlay` and `grade`; `scenes/shared.ts` has cloud decks, cirrus, moons and cellular noise. Stats and copy live in `src/data/planets.ts`.

## Honesty notes

- Distances, years and temperatures come from the NASA Planetary Fact Sheet. The landscapes are artistic impressions, not survey data.
- Jupiter, Saturn, Uranus and Neptune have no ground; their pages are views from above the cloud tops.

This design replaced the original scroll-driven SOLARIS journey.
