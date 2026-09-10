# Nebula Lab

Local development tooling, separate from the production website. Current objects: LMC and SMC. Keep cleanup and UI work within this lab unless a task explicitly requires a shared dependency or another location.

## Usage

From the repository root: `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm build:packages`, then `pnpm lab:nebula`. Startup recreates missing neutral density textures and inspection/reference images from pinned sources, downloading missing originals without running extraction or reconstruction. `pnpm lab:nebula:bake` rebuilds the three accepted LMC lenses from their saved recipe; `pnpm lab:nebula:verify` validates the completed native, reconstruction and delivery artifacts without processing; see [docs/baking.md](docs/baking.md). The default server is `http://127.0.0.1:4331`.

- `/alignment`: inspect the complete density field, choose an image, adjust placement/tone, compare Original / Without stars / Residual, and run optional Quick preview or full Remove stars.
- `/reconstruction`: choose the saved starless source and press Preview. Completed variants load without processing when selected. Show progress and Cancel; refresh reconnects to the same job.
- Preserve existing local storage, source originals and completed processing caches during development. Keep the user's running lab alive; never restart it merely to clear state.
- For the full current workflow, read [docs/workflows.md](docs/workflows.md). For source and depth interpretation, read [METHOD.md](METHOD.md).

## Organization

```text
src/
  components/       React panels and reusable controls
  alignment/        source registration, placement and saved fits
  star-removal/     NOX processing, residuals and saved removal state
  pipeline/         source acquisition, stage replay and completion receipts
  reconstruction/   structure/depth model, bake worker and saved variants
  density/          unchanged prior and integrated-signal inspection
  stars/            particle/catalogue preparation and stellar overlays
  viewer/           retained plain-TypeScript PolyCSS scene
  utils/            shared stores, local jobs and path resolution
  cli/              offline preparation commands
  browser/          real browser checks
models/
  lmc/              LMC inputs, recipes and prepared models
  smc/              SMC inputs, recipes and prepared models
```

- React owns UI markup, control state and interaction. The PolyCSS renderer remains a plain TypeScript library mounted through a stable element/ref. UI rerenders must not recreate the cloud scene.
- Reuse css.earth's existing visual language and input policy. Keep the lab a compact tool: visible controls, brief status, longer interpretation in tooltips/popovers or docs.
- Keep image/object choices in data. Shared algorithms must not gain per-image branches. Tests live beside the module; browser checks live in `browser/`.
- Source originals and large native/intermediate outputs stay in the ignored local cache. Keep credits, source hashes, registration evidence and reproducible recipes with the model. No copies of large assets just to rearrange folders.
- Keep only the selected VISTA, Horálek and WISE image candidates. Do not recommit retired cloud render banks or auto-discover old cache images. Preserve shared density/stars, coordinate-only calibration and research notes; new candidates require explicit scope.
- Keep `models/lmc/bake.json` synchronized with deliberately accepted placements and material settings. Do not infer them from the newest cache or browser defaults. All derived images (including original-image previews, reference panels, separation previews and density/app slices) are ignored; compact grids, star inputs, recipes and registration metadata remain tracked. The full bake restores the configured app textures against immutable delivery hashes; `prepare:nebulae` verifies or rebuilds them before app startup/build.
- Historical receipts retain their original bytes and hashes. Resolve relocated historical paths at explicit loading boundaries; do not fabricate replacement provenance.

## Processing boundaries

- Browsing/importing/alignment does not authorize expensive processing. A user's instruction for named candidates, or their explicit Quick preview / Remove stars / Preview click, authorizes that operation. Do not ask again for work already authorized.
- Source registration and the user's image-to-density fit are different. Preserve both. The visual fit is not measured distance, size, or correspondence between simulated and observed stars.
- Remove stars on the full native pixel grid. Use the completed NOX native diffuse result for reconstruction, not an older separation preview or the small browser texture. RGB8 working copies must be separate from higher-depth originals.
- Never remove stars again while reconstructing. Images supply color to the existing volume; they must not create support, thickness or an extruded photographic background.
- Keep original source footprint/no-data and the unchanged full density prior. Do not crop either to force a match or invent color beyond observed coverage.
- Reconstruction uses the exact density object shown in Alignment as its fixed shape/depth reference. Pin that density descriptor and repaint its existing prepared quads while preserving every alpha byte. Never substitute an older photo-derived benchmark or rebuild a different density volume for each image.
- The catalogue belongs to the density cloud. Keep measured astrometry and photometry; one configured sky-to-model reference plus the actual density supplies deterministic modeled depths. All image variants share those same positions. Candidate coverage/color must not select or reposition stars. Keep the star toggle and use the same encoded density projection for cutoff.
- Prepare stellar size and opacity together from catalogue magnitudes, preserving relative display light across colors and image variants. Avoid a faint-star opacity floor; keep exposure global.
- Bake XYZ image banks offline. Runtime only loads prepared geometry/textures; keep scene rendering within the existing PolyCSS rules.
- Preserve the full saved Alignment placement: scale, pivot, offsets and every rotation. Earth view must use one shared observer and framing across both tabs. Compare actual image landmarks across Alignment and Reconstruction; internal consistency within only one tab cannot prove registration.
- Candidate color, local contrast, brightness and gamma change RGB material only. Save these controls per image and include them in job/cache identities; moving a slider never starts a bake. Image brightness must not redefine density. Missing coverage/black color retains neutral density color with explicit coverage accounting. Validate bank handoffs at the same camera; report failed visual gates honestly.
- Processing is server-owned and atomically publishes complete results. Refresh/navigation detach an observer, not the job. Explicit Cancel stops it. A server restart must report an interrupted job honestly.

## Validation

Use targeted lab typechecking/tests and the affected browser flow. Verify actual output hashes, source identity, full extent, geometry/handedness, all three slice axes, and source-switch/refresh behavior. Keep numerical convergence thresholds fixed; increase sampling at its owning layer when needed. Inspect front and oblique views before claiming visual quality.

Do not infer completion from process launch or exit code alone. Do not run unrelated production suites during lab iteration. No review council or external-agent review is required for routine lab changes.
