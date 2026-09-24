# Volume lenses on a cold page, openings that fit them, and limb plates that fit their disc: evidence

Tested revisions: `main` at `6d640af301` and the change at `6f572e5df7` (fix/volume-lens-framing).

## In the app (`capture.mjs`, `openings.txt`, `main/facts.json`, `change/facts.json`)

Headless Chromium against the local dev server, with main's five runtime files swapped in for the main run: `system-framing`, `prepared-world-navigation`, `scene-activation`, `scene-router` and `scene-datasets`. Each page is a cold load. The last row is an in-app link from Earth. For each page the capture records the readout's distance, any dataset notice, whether the page became ready, and a screenshot.

- **Main, every volume lens fails on a cold load.** Beta Pictoris, the HD 181327 and PDS 70 ring links, the Sun's corona link, and Betelgeuse's own default all show "Dataset cloud … is unavailable. Showing the default dataset." The Beta Pictoris dataset link never becomes ready.
- **The change, no notices.** Every page becomes ready, and every opening fits the volume its lens shows whenever the volume overflows the view: Beta Pictoris at 758.53 au, HD 181327 at 1,685.63 au, PDS 70 at 842.81 au, the Sun's corona link at 17,015,196 km, and Betelgeuse at 156.82 au.
- **Unchanged:** Earth and plain HD 181327, whose default lens is not a volume, are 0 changed pixels at thresholds 0.1 and 0.
- **The volumes themselves look as on main:** loading the Sun plainly and then picking COR1 in the page, after the world has loaded, ends at the same distance with 0 changed pixels on main and the change (`cor1.mjs`, `sun-cor1-picked-in-page-main.png`). Only the openings change.

Every framed view keeps the page's direction, from Earth, so each disc is seen as the telescopes saw it: Beta Pictoris edge-on.

## Pictures

- `beta-pictoris-opening.png` (change) and `beta-pictoris-opening-main.png`.
- `sun-cor1-link-opening.png`: the Sun's corona link on the change, at DPR 2.
- `hd-181327-ring-opening.png` and `pds-70-ring-opening.png`.

## The rule

An opening fits the volume when the fit lies farther out than the view. An intermediate version framed only volumes reaching beyond ten times the opening distance. That left the Sun's corona overflowing the screen, so it was removed.

## Limb plates (`fit.mjs`, `edge.mjs`, `layers.mjs`, `limb-capture.mjs`)

An emissive body draws a limb plate over its sphere and an off-limb plate behind it. The silhouette-fit binding scales both to the drawn sphere through their `transform`. On the Sun and on 37 planets and companions with `geometryScale` 1.25, the stylesheet also multiplied the plate sizes by 1.25, so the fit enlarged them twice.

- **The dark band is the limb plate.** On the Sun with COR1 picked, hiding the limb plate lifted the band just outside the limb (1.05, 1.15 and 1.25 R☉) from `107,74,42`, `102,72,39` and `95,66,37` to `131,90,51`, `146,103,56` and `148,103,58`. Hiding the off-limb plate changed nothing. This is the same on main and the change before the fix.
- **Drawn sizes, main.** Background size times the transform's scale of 0.929, against a 448 px sphere:
  - the Sun's limb plate is 620 × 0.929 = 576 px, 1.285 times the sphere;
  - the stars' plates (Beta Pictoris, Aldebaran), which lost the factor in `68067e091b`, are 496 × 0.929 = 461 px.
- **The drawn photosphere,** measured in pixels with both plates hidden, has a radius of 228 px on the Sun, 229 px on AB Pic b and 228 px on KELT-9b. A native 496 px plate lands at 230.4 px radius, and a 1.25 plate at 288 px.
- **After the fix,** every limb plate is 461 px. On the Sun under COR1, the colours just outside the limb are the same with and without the limb plate (`sun-cor1-limb-after.png`). Inside the disc, the plate darkens toward the edge as it should.
- **Main against the change** (`limb-sun-and-sgr-a-star-main-vs-change.png`), changed pixels at threshold 0.1:
  - KELT-9b and AB Pic b: 0, because their plates are transparent;
  - Aldebaran (control): 0;
  - the Sun: 48,575, the limb darkening now on the disc;
  - Sagittarius A*: 342,975. Its black limb plate no longer covers the inside of its ring image at 1.25 times the shadow; the shadow and the ring image are drawn at the sizes its recipe gives.
- **Residual, not changed:** the plate still reaches about 2 px past the drawn photosphere, 230.4 px against 228 px. The stars have the same difference.

## Checks

- **Typechecks:** `pnpm typecheck` (whole repository) and `typecheck:shell` pass.
- **Renderer and generator tests:** the renderer suite passes 672 of 673; `volume/loader.test.ts` fails locally, as on main. The new-object and package-consistency tests pass 28 of 28.
- **New test:** `site/test/scene-datasets.test.mts` passes. On main's `scene-datasets.mts` it fails with the same "Dataset cloud “beta-pictoris-disc” is unavailable." error.
- **Site suite:** 327 passed, 14 failed. The 14 are the same names as on main; they need prepared assets or a build this worktree does not have.
