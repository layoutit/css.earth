# @cssearth/bake

The repository's build-time preparation code. The preparation tools (`tools/nebula`, `tools/objects`,
`tools/prepare`, `tools/assets`) and the nebula lab import it to turn source
records into prepared delivery. The application never imports it: the runtime reads only what the bake wrote.

Each topic is one subpath entry. A topic imports another only when it sits on a lower layer (the raster lane uses the
photometric models), never sideways. The first topic was the volume bake, which was the nebula lab's `volume-core` and
`volume-bake` packages until 2026-09. The photometric models (`tools/photometry/`) and the raster lane
(`src/preparation/raster/`, the renderer's lighting bank and `src/platform/prepare-missing-coverage.mts`) followed, then the
renderer's scene and presentation compilers with `src/platform/projective-surface-raster.mts`,
`src/platform/prepare-solid-body-surface.mts` and the `tools/prepared` node-tree libraries, and then the star, shell, sky,
density-volume, image-layer and environment bakes of `src/preparation/` with the renderer's remaining compilers. The shared
object libraries of `tools/objects/` (colour transfers, shape geometry, cameras, the world frame and authored rotation, and the
science and observation rasters) followed as `@cssearth/bake/objects/<topic>`, and then the galaxy and cluster catalogues and the
world context, which emptied `src/preparation/`, and the nebula delivery bake of `tools/nebula/application/`.

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
| `@cssearth/bake/raster` | raster recipes and their validation, surface maps, pages and poles, lighting banks and limb overlays, atmospheres and halos, the prepared atmosphere frame and composite, interiors, missing-coverage painting, the lossy WebP lane | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/scene` | geometry profiles, projected surface leaves and their raster presentation, seam outsets, polar caps, ring wedges, cutaways, atmospheric materials, solid-body surfaces, the solid scene's perspective camera | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/presentation` | the retained node tree, projective layouts and leaf boxes, offline CSSOM reads, activation groups, the row-bank cutaway, composite and emissive presentations, the prepared-presentation contract and schemas, the cubic-sky and directional-Sun contracts and preparers, material-track source planning | Node only (`node:*`, Playwright) |
| `@cssearth/bake/volume-leaves` | the CSS volume compilers: slice stacks and detail planes as retained PolyCSS leaves, leaf bounds, depth order, volume impostors | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/stars` | point-field recipes, catalogue sources, palette, magnitude hierarchy and precision, point atlas and photometry, diffuse sky, the encoded point bank | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/shell` | surface-shell recipes, meshes and atlas, and the CSS shell compiler | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/sky` | cubic sky recipes, the EXR source and its acquisition, baked faces with near-star sprites, the CSS sky compiler | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/density` | density-volume acquisition and KTX2 encoding, column-depth spreading, fixed discs, slice atlases and their retirement, the density-volume preparation, lens-bank promotion | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/image-layers` | image-layer recipes, the diffuse Lanczos3 resampler, retained image layers as PolyCSS volume leaves | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/galaxy-catalog` | galaxy catalogue recipes, CSV and archive sources, bibliography, galaxy positions and memberships, the display sample | Node only (`node:*`, `yaml`) |
| `@cssearth/bake/cluster-catalog` | the galaxy-cluster catalogue, placed with the galaxy positions | Node only |
| `@cssearth/bake/world-context` | the spatial world context: sources, bodies, orbit banks, system and group views, hyperbolic paths | Node only |
| `@cssearth/bake/nebula` | nebula delivery recipes and identities, compact density, finite-emission and compiler deliveries, catalogue fields and star sprites, sky frames, render-element budgets, replay references | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/environment` | the replay of an environment object's missing runtime images through the bakes above | Node only (`node:*`) |
| `@cssearth/bake/runtime-source` | the runtime-source reader: a runtime module parsed into ESTree with its original ranges, imports resolved to source files through package exports and tsup entries, names, keys and static object properties | Node only (`node:*`, the ESLint parser, Vite) |
| `@cssearth/bake/prepared-presentation` | passes that rewrite a compiled prepared presentation: depth partitions in a proven visibility order, the cascade check that keeps each moved leaf's computed style, the interior fill of a cut-open body | Node only (`node:*`, `sharp`, Playwright) |
| `@cssearth/bake/delivery` | the atomic prepared-set and text writers, prepared page metadata, the WebP encodings prepared images are optimised with, pinned source bytes an acquisition publishes, the verify-after-publish gate, the scan for `/scenes/` references an asset-origin build left | Node only (`node:*`, `sharp`, `cwebp-bin`) |
| `@cssearth/bake/sources` | an object's authored descriptor, the independent records of the source catalogue, the authored physical world frame checked against a prepared scene and runtime, images embedded in a published PDF figure, factsheet source checks, object-information source records, pinned-fact citations | Node only (`node:*`) |
| `@cssearth/bake/contract` | the checked object runtime definition and its prepared resource catalogue, validated against the prepared-presentation contract and the renderer's object controls | Node only |
| `@cssearth/bake/objects/color` | the sRGB transfer, band-colour and asinh displays, palettes and tints, star catalogue colours, whole-disc photometric colour | Node only |
| `@cssearth/bake/objects/geometry` | shape models (including ASCII VTK POLYDATA) and their records, facet fields, radial meshes and simplification, controlled shape cameras and band alignment, ellipsoids, the Lambert attenuation atlas, the radial-layer contract | Node only (`node:*`, meshoptimizer) |
| `@cssearth/bake/objects/cameras` | observer-computed cameras from an ephemeris and a spin state or IAU pole model, the SPICE kernel banks bound to the source-manifest reader | Node only |
| `@cssearth/bake/objects/scene` | the physical world frame navigation is solved in, authored synchronous and hosted rotations, and the ecliptic presentation frame, default camera, Sun reference view direction and astrometric sky registration derived from the solar geometry the host passes in; an object's sky orientation, directional Sun, physical solar-system scene and focused camera; the authored presentation basis and drawn node chain world navigation solves, the physical projection of rotating material tracks, and a recipe's camera source | Node only |
| `@cssearth/bake/objects/raster` | scientific surfaces (PDS, ISIS, FITS, GeoTIFF, VTK, NumPy, HEALPix, Tecplot), categorical geology and symbols, eclipse and phase-curve maps, observed colour rasters and their photometric composition, their source records, the WISE atlas mosaic grid, FITS binary tables, TESS transit limb darkening | Node only (`node:*`, `sharp`, `geotiff`) |
| `@cssearth/bake/objects/sources` | authored source references read through the source manifest, pinned source files with their bindings, byte ranges and atomic publication, JSON source values, the shared reference banks (CIE 1931), the recorded-generator matcher, the idle-timeout download relay | Node only |
| `@cssearth/bake/objects/charts` | chart renderers and readers (measured spectra, retrieved profiles, reflectance, temperature-pressure, phase and light curves, FITS gallery pictures) and their shared SVG style | Node only |
| `@cssearth/bake/objects/content` | the object-content contract, lens vocabulary, lens steps and prepared legends, lens billboard colours | Node only |
| `@cssearth/bake/objects/surface-features` | surface-feature banks (IAU nomenclature, Natural Earth, landing sites, shape-model landmarks, ellipsoid projection), feature notes, image-control fits for encounter and orthophoto landmarks, the projected-control check | Node only |
| `@cssearth/bake/objects/stellar` | a star's colour lens from its measured, Gaia XP or Planck spectrum, limb darkening, starspots from a published figure or occultation, Roche-von Zeipel gravity darkening | Node only |
| `@cssearth/bake/objects/layers/<kind>` | the libraries each layer pipeline shares: terrestrial (mission decoders and cameras, registration, native photographs, solid and radial sources, atlases, ring sources, radial terrain and materials, solid rasters, the surface-observation pipeline), giant (ring and disc geometry, photometric contracts), paged-ellipsoid (texture levels, surface banks, Earth rasters, the globe's profile, attitude, atmosphere, asset contract, recipe context and scene, refresh sources, mantle tomography), material-composition (recipes, rasters, radial motion, spectral variants), observation (science rasters and elevation, FITS maps, controlled and synoptic mosaics, band colours, plates and point sources, OIFITS observables and image fits, body maps with their meaning, spectral-cube band depths and resolution evidence), shape-model (source records, GLB surfaces, shape lighting, ring leaves, surface rasters), cutaway and observed-surfaces contracts | Node only |

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
├── src/volume-leaves/, src/stars/, src/shell/, src/sky/, src/density/, src/image-layers/, src/environment/,
│   src/galaxy-catalog/, src/cluster-catalog/, src/world-context/, src/nebula/
│                  the volume compilers and the object and catalogue bakes: one entry each
├── src/runtime-source/, src/prepared-presentation/, src/delivery/, src/sources/, src/contract/
│                  the runtime-source reader, presentation passes, prepared delivery, source records and the object
│                  runtime contract: one entry each
├── cli/           command entries (`node packages/bake/cli/<command>.mts`); nothing imports them
├── src/objects/   color/, geometry/, cameras/, scene/, raster/, sources/, charts/, content/, surface-features/, stellar/,
│                  layers/<kind>/: the shared object libraries, one entry each
├── AGENTS.md      Package rules
└── CLAUDE.md      Symlink to AGENTS.md
```

The nebula boundary checks (the `nebula-boundaries` rule of `pnpm check:architecture`, in
`.github/scripts/architecture/nebula-packages.mts` and `nebula-inbound.mts`) keep the old packages' guarantees on this entry: the runtime closure imports nothing from
`@cssearth/bake`, the lab's reconstruction and viewer packages may import `@cssearth/bake/volume` but not its node
entry, the main volume entry imports no platform dependency, and no volume source names an object, an object path or
another topic.

`pnpm --filter @cssearth/bake build` writes `dist/`; `pnpm --filter @cssearth/bake test` runs the package's tests
(Vitest) from the repository checkout, since two of them replay tracked compact inputs under `src/objects/`. The raster
lane's surface test also reads the observation lens sampler from `src/objects/layers/observation/`. The photometry tests live
in `tests/photometry/` (`node --test`), because they read body records and the ISIS oracle fixture; they import the entry.
The node-tree, CSSOM, leaf-box, layout and activation tests likewise stay in `tools/prepared/`. The prepared-presentation, delivery and
sources tests are `node --test` suites in `tests/prepared-presentation/`, `tests/delivery/` and `tests/sources/`. The scene suite
(`src/scene/scene.test.ts`, node:test) and the presentation suites (`src/presentation/*.test.ts`, Vitest) prepare real bodies
from their published prepared data, so `vitest.config.ts` leaves them out of the package run. `pnpm test:preparation` runs them once that data is
restored, after its node:test stage passes. The same holds for the node:test suites of the volume compilers and the star,
shell, sky, density-volume, image-layer, catalogue and world-context bakes, which read restored sources.
The object libraries' tests stay outside the package, beside the pipelines in `tools/objects/` or under `tests/objects/<topic>/` (`node --test`), since they read body sources, kernel
banks and oracle fixtures through the repository's test helpers; they import the entries. `pnpm test:bake-objects` runs every test that imports an object entry.
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
