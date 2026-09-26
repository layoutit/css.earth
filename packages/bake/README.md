# @cssearth/bake

The repository's build-time preparation code. The preparation tools (`src/preparation`, `tools/nebula`,
`tools/objects`, `tools/assets`) and the nebula lab import it to turn source
records into prepared delivery. The application never imports it: the runtime reads only what the bake wrote.

Each topic is one subpath entry. A topic imports another only when it sits on a lower layer (the raster lane uses the
photometric models), never sideways. The first topic was the volume bake, which was the nebula lab's `volume-core` and
`volume-bake` packages until 2026-09. The photometric models (`tools/photometry/`) and the raster lane
(`src/preparation/raster/`, the renderer's lighting bank and `src/platform/prepare-missing-coverage.mts`) followed, then the
renderer's scene and presentation compilers with `src/platform/projective-surface-raster.mts`,
`src/platform/prepare-solid-body-surface.mts` and the `tools/prepared` node-tree libraries, and then the star, shell, sky,
density-volume, image-layer and environment bakes of `src/preparation/` with the renderer's remaining compilers.

| entry | what it holds | host |
|---|---|---|
| `@cssearth/bake/volume` | contracts: volume recipes, slices, frames, emission, compiler controls and bake results, render-element budgets, observation photos and mappings, sampled recipes, shape scenes, simulation priors, prepared catalogue stars | host-neutral: no Node built-ins, DOM or native codecs, so the lab's browser viewer imports it too |
| | coordinates: catalogue positions, the compiler frame, density placement, observer tangents, overlay alignment, placement, registration and WCS | |
| | fields: finite emission and its windows, sampled density, diffuse atoms, cloud density, density projection, photometric MGE and emission, observation priors, simulation envelopes, authored shapes | |
| | materials: cloud appearance and detail, component and slab materials, sampled colour, display colour, star photometry | |
| | sampling: registered RGB/scalar rasters and layer optimization | |
| `@cssearth/bake/volume/node` | compact inputs: replay of compact compiler, sampled, symmetry, finite-emission and simulation-prior inputs, density grids and windows, pinned file I/O | Node only (`node:*`, `sharp`) |
| | slices: offline XYZ density, emission, material and painted-field slices and their raster encoding | |
| | compiler: the target-neutral compiler bake, component layouts and retained materials | |
| `@cssearth/bake/photometry` | disk and phase functions, the Hapke model and roughness, normalization to a reference geometry, model records, limb laws from published models, PSG limb profiles for halos | Node only (`node:fs`, `sharp`) |
| `@cssearth/bake/raster` | raster recipes and their validation, surface maps, pages and poles, lighting banks and limb overlays, atmospheres and halos, interiors, missing-coverage painting, the lossy WebP lane | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/scene` | geometry profiles, projected surface leaves and their raster presentation, seam outsets, polar caps, ring wedges, cutaways, atmospheric materials, solid-body surfaces | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/presentation` | the retained node tree, projective layouts and leaf boxes, offline CSSOM reads, activation groups, the row-bank cutaway, composite and emissive presentations | Node only (`node:*`, Playwright) |
| `@cssearth/bake/volume-leaves` | the CSS volume compilers: slice stacks and detail planes as retained PolyCSS leaves, leaf bounds, depth order, volume impostors | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/stars` | point-field recipes, catalogue sources, palette, magnitude hierarchy and precision, point atlas and photometry, diffuse sky, the encoded point bank | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/shell` | surface-shell recipes, meshes and atlas, and the CSS shell compiler | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/sky` | cubic sky recipes, the EXR source and its acquisition, baked faces with near-star sprites, the CSS sky compiler | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/density` | density-volume acquisition and KTX2 encoding, column-depth spreading, fixed discs, slice atlases and their retirement, the density-volume preparation, lens-bank promotion | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/image-layers` | image-layer recipes, the diffuse Lanczos3 resampler, retained image layers as PolyCSS volume leaves | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/environment` | the replay of an environment object's missing runtime images through the bakes above | Node only (`node:*`) |

Every entry validates what it reads and fails with a `TypeError` or `RangeError` naming the rule, such as
`Invalid retained render-element profile.` A replay that would change an accepted bake fails instead of writing it,
for example `Compact sampled replay changed accepted <lens> volume`.

```text
packages/bake/
├── src/volume/    contracts/, coordinates/, fields/, materials/, sampling/ and their tests: `@cssearth/bake/volume`
│   └── node/      compact-inputs/, compiler/, slices/ and their tests: `@cssearth/bake/volume/node`
├── src/photometry/ published photometric models and limb laws: `@cssearth/bake/photometry`
├── src/raster/    the raster lane and its tests: `@cssearth/bake/raster`
├── src/scene/     the geometry scene compilers: `@cssearth/bake/scene`
├── src/presentation/ the CSS presentation compilers: `@cssearth/bake/presentation`
├── src/volume-leaves/, src/stars/, src/shell/, src/sky/, src/density/, src/image-layers/, src/environment/
│                  the volume compilers and the object bakes: one entry each
├── AGENTS.md      Package rules
└── CLAUDE.md      Symlink to AGENTS.md
```

The nebula boundary checks (`pnpm check:nebula-boundaries`, from `tools/nebula/package-boundaries.mts` and
`inbound-boundaries.mts`) keep the old packages' guarantees on this entry: the runtime closure imports nothing from
`@cssearth/bake`, the lab's reconstruction and viewer packages may import `@cssearth/bake/volume` but not its node
entry, the main volume entry imports no platform dependency, and no volume source names an object, an object path or
another topic.

`pnpm --filter @cssearth/bake build` writes `dist/`; `pnpm --filter @cssearth/bake test` runs the package's tests
(Vitest) from the repository checkout, since two of them replay tracked compact inputs under `src/objects/`. The raster
lane's surface test also reads the observation lens sampler from `tools/objects/observation/`. The photometry tests stay
in `tools/photometry/` (`node --test`), because they read body records and the ISIS oracle fixture; they import the entry.
The node-tree, CSSOM, leaf-box, layout and activation tests likewise stay in `tools/prepared/`. The scene suite
(`src/scene/scene.test.ts`, node:test) and the presentation suites (`src/presentation/*.test.ts`, Vitest) prepare real bodies
from their published prepared data, so `vitest.config.ts` leaves them out of the package run. `pnpm test:preparation` runs them once that data is
restored, after its node:test stage passes. The same holds for the node:test suites of the volume compilers and the star,
shell, sky, density-volume and image-layer bakes, which read restored sources.
The build bundles the renderer modules a topic imports and writes `dist/metafile-esm.json`, which
`tools/ci/check-stale-builds.mts` reads to know when a renderer change makes the bake stale.

## Evidence

The volume entries replaced the lab's `volume-core` and `volume-bake` packages at `5b05729dd9`, moving their sources
unchanged apart from import paths. The outputs were compared byte for byte with those of the packages at `c83b4e4f18`:

- The lab's density bake of `labs/nebula/models/{lmc,smc}/full-density` wrote the same 292 files.
- `pnpm prepare:volume` for the Milky Way (192 prepared files) and `prepare-stars` for the stellar neighbourhood
  (4 files) wrote identical files.
- `tools/nebula/prepare.mts` for the eleven deliveries that bake wrote identical files, except each `delivery.json`
  receipt's `implementationSha256`. That identity hashes the owners by package-relative name, and the name changed from
  `@cssearth/volume-core`/`@cssearth/volume-bake` to `@cssearth/bake`. With main's identity substituted, every
  `delivery.json` matches main's bytes. LMC and SMC record no such identity and matched entirely. M1 fails on both
  commits with the same error (`Compact sampled replay changed accepted hubble-optical volume`).
- The 52 moved tests pass under Vitest, and `node labs/nebula/run.mts test` keeps the same six failures as on
  `c83b4e4f18`. `pnpm test:lab` stops at the same density-bake assertion on both commits.
