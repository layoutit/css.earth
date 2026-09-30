# @cssearth/bake

The repository's build-time preparation code. The preparation code (`packages/bake/authoring/`,
`packages/telescope-cli/`, `site/build/`) and the nebula lab import it to turn source
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
| `@cssearth/bake/volume-leaves` | the CSS volume compilers: slice stacks as retained PolyCSS leaves, leaf bounds, depth order, volume impostors | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/stars` | point-field recipes, catalogue sources, palette, magnitude hierarchy and precision, point atlas and photometry, diffuse sky, the encoded point bank | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/shell` | surface-shell recipes, meshes and atlas, and the CSS shell compiler | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/sky` | cubic sky recipes, the EXR source and its acquisition, baked faces, the CSS sky compiler | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/density` | density-volume acquisition and KTX2 encoding, column-depth spreading, fixed discs, slice atlases and their retirement, the density-volume preparation, lens-bank promotion | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/image-layers` | image-layer recipes, the diffuse Lanczos3 resampler, retained image layers as PolyCSS volume leaves | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/galaxy-catalog` | galaxy catalogue recipes, CSV and archive sources, bibliography, galaxy positions and memberships, the display sample, the object preparation | Node only (`node:*`, `yaml`) |
| `@cssearth/bake/cluster-catalog` | the galaxy-cluster catalogue, placed with the galaxy positions | Node only |
| `@cssearth/bake/world-context` | the spatial world context: sources, bodies, orbit banks, system and group views, hyperbolic paths | Node only |
| `@cssearth/bake/nebula` | nebula delivery recipes and identities, compact density, finite-emission and compiler deliveries, catalogue fields and star sprites, sky frames, render-element budgets, replay references | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/environment` | the replay of an environment object's missing runtime images through the bakes above | Node only (`node:*`) |
| `@cssearth/bake/runtime-source` | the runtime-source reader: a runtime module parsed into ESTree with its original ranges, imports resolved to source files through package exports and tsup entries, names, keys and static object properties | Node only (`node:*`, the ESLint parser, Vite) |
| `@cssearth/bake/prepared-presentation` | passes that rewrite a compiled prepared presentation: depth partitions in a proven visibility order, the cascade check that keeps each moved leaf's computed style, the interior fill of a cut-open body, the authored-motion bindings resolved against the object's page styles (passed in by the application) | Node only (`node:*`, `sharp`, Playwright) |
| `@cssearth/bake/delivery` | the atomic prepared-set and text writers, prepared page metadata, the WebP encodings prepared images are optimised with, pinned source bytes an acquisition publishes, the verify-after-publish gate, the scan for `/scenes/` references an asset-origin build left, the inventoried runtime-asset locations, an object's public runtime manifest and the publication of a staged preparation | Node only (`node:*`, `sharp`, `cwebp-bin`) |
| `@cssearth/bake/sources` | an object's authored descriptor, the independent records of the source catalogue, the authored physical world frame checked against a prepared scene and runtime, images embedded in a published PDF figure, factsheet source checks, object-information source records, pinned-fact citations, a context manifest's source records, the source catalogue's factsheet citations and inventory, the prepared galaxy and cluster catalogues' bibliography citations, the context packages' lineage and the facility artwork refresh (at the routes the application passes in), investigation ledgers, surveys and their report | Node only (`node:*`) |
| `@cssearth/bake/contract` | the checked object runtime definition and its prepared resource catalogue, validated against the prepared-presentation contract and the renderer's object controls, and the audits of a prepared presentation and its authored runtime sources | Node only |
| `@cssearth/bake/asset-publication` | staging, publishing and checking the runtime assets on the asset host: the staging validator, the publisher, the published-asset gate, the deploy check and the dry-run prune report | Node only (`node:*`, `undici`) |
| `@cssearth/bake/astronomy` | preparation's access to the built astronomy package, with a build hint when it is missing | Node only (`node:*`) |
| `@cssearth/bake/navigation` | prepared focus objects and scene distances for the catalogue and search destinations, navigation marker recipes and their sprites, the neutral disc marker of an unresolved surface, and the navigation preparation that writes the marker atlases and presentation | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/facility-renders` | the facility models' illustrative poses and the three.js renderer the facility thumbnails are drawn with | Node only (`three`) |
| `@cssearth/bake/site-assets` | the application's prepared assets that are not an object's own: dataset sprites, search thumbnails, the planets' phase charts | Node only (`node:*`, `sharp`, `vite`) |
| `@cssearth/bake/surface-previews` | the prepared records a surface minimap or preview raster is drawn from | Node only (`node:*`) |
| `@cssearth/bake/preparation` | the stale-build check and the renderer bundling plugin | Node only (`node:*`) |
| `@cssearth/bake/thread-pool` | sizes libuv's thread pool to the cores; imported for its side effect before other entries | Node only (`node:os`) |
| `@cssearth/bake/objects/color` | the sRGB transfer, band-colour and asinh displays, palettes and tints, star catalogue colours, whole-disc photometric colour | Node only |
| `@cssearth/bake/objects/geometry` | shape models (including ASCII VTK POLYDATA) and their records, facet fields, radial meshes and simplification, controlled shape cameras and band alignment, ellipsoids, the Lambert attenuation atlas, the radial-layer contract | Node only (`node:*`, meshoptimizer) |
| `@cssearth/bake/objects/cameras` | observer-computed cameras from an ephemeris and a spin state or IAU pole model, the SPICE kernel banks bound to the source-manifest reader | Node only |
| `@cssearth/bake/objects/scene` | the physical world frame navigation is solved in, authored synchronous and hosted rotations, and the ecliptic presentation frame, default camera, Sun reference view direction and astrometric sky registration derived from the solar geometry the host passes in; an object's sky orientation, directional Sun, physical solar-system scene and focused camera; the authored presentation basis and drawn node chain world navigation solves, the physical projection of rotating material tracks, a recipe's camera source, and the seams and projection block of a generated sphere | Node only |
| `@cssearth/bake/objects/raster` | scientific surfaces (PDS, ISIS, FITS, GeoTIFF, VTK, NumPy, HEALPix, Tecplot), categorical geology and symbols, eclipse and phase-curve maps, observed colour rasters and their photometric composition, their source records, the WISE atlas mosaic grid, FITS binary tables, TESS transit limb darkening | Node only (`node:*`, `sharp`, `geotiff`) |
| `@cssearth/bake/objects/sources` | authored source references read through the source manifest, pinned source files with their bindings, byte ranges and atomic publication, JSON source values, the shared reference banks (CIE 1931), the recorded-generator matcher, the idle-timeout download relay | Node only |
| `@cssearth/bake/objects/charts` | chart renderers and readers (measured spectra, retrieved profiles, reflectance, temperature-pressure, phase and light curves, FITS gallery pictures) and their shared SVG style | Node only |
| `@cssearth/bake/objects/content` | the object-content contract, lens vocabulary, lens steps and prepared legends, lens billboard colours, palette legend labels derived from the reported stretch | Node only |
| `@cssearth/bake/objects/surface-features` | surface-feature banks (IAU nomenclature, Natural Earth, landing sites, shape-model landmarks, ellipsoid projection), feature notes, image-control fits for encounter and orthophoto landmarks, the projected-control check, attaching the banks to a prepared globe | Node only |
| `@cssearth/bake/objects/stellar` | a star's colour lens from its measured, Gaia XP or Planck spectrum, limb darkening, starspots from a published figure or occultation, Roche-von Zeipel gravity darkening | Node only |
| `@cssearth/bake/objects/lineage` | which manifest sources each prepared product of a layered body reads, built in memory from its source records by the recipe bindings of each preparation family | Node only |
| `@cssearth/bake/objects/candidates` | read-only public-archive searches (ALMA, ESO, MAST, DataCite, JMMC diameters), imagery candidates from OPUS, resolved-star candidates from SIMBAD, OiDB and VizieR | Node only (network) |
| `@cssearth/bake/objects/default-view` | what a prepared object's default camera looks at, the check that a photograph lens's default camera faces it, the default lens's data coverage the default camera turns toward, and the turn toward a partial lens's data | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/objects/interpretation` | the observation interpreter the raster lane packs surfaces through: each surface's decoder (solar synoptic, terrestrial, shape-model, stellar, static observations, the Akatsuki UVI Level 3b grid), with the solar geometry the host passes in | Node only (`node:*`, `sharp`, `h5wasm`) |
| `@cssearth/bake/objects/host-adapters` | the scene and presentation compilers' host adapters (physical scene, directional Sun, material tracks, lens navigation), bound to the solar geometry the host passes in | Node only |
| `@cssearth/bake/objects/celestial` | an object's sky orientation and directional Sun from its celestial profile and the solar geometry the host passes in | Node only (`node:*`) |
| `@cssearth/bake/objects/acquisition` | the converters an acquisition plan runs to restore a derived source: SPICE DSK to a welded mesh archive (through the Python converter beside it), GeoTIFF numeric grids and images read by byte range, mapped-composition fits, the JPL satellite catalogue; the Python converters body manifests name as reproduction routes | Node only (`node:*`, `sharp`, `geotiff`, Python for DSK) |
| `@cssearth/bake/objects/sphere-survey` | the VLT/SPHERE asteroid survey release (LAM listings and downloads), apparitions and series of frames, the apparitions a lens can join, the survey figure's printed labels | Node only (network) |
| `@cssearth/bake/objects/layers/<kind>` | the libraries each layer pipeline shares: terrestrial (the pipeline entry and solid scene, with the solar geometry passed in; mission decoders and cameras, registration with its Horizons tables and README report, native photographs, solid and radial sources and the solid replay scene, atlases, ring sources, radial terrain and materials, solid rasters, the surface-observation pipeline), giant (ring and disc geometry, photometric contracts, the normalized-disc presentation, polar continuation and dome, the material atlas, ellipsoid materials, layered presentation, observed polar surfaces and the layered giant object), paged-ellipsoid (the assets and the paged object, with the solar geometry and asset worker passed in; the MUR image and legend, texture levels, surface banks, Earth rasters, the globe's profile, attitude, atmosphere, asset contract, recipe context and scene, refresh sources, mantle tomography, the presentation, geographic pages, places and locations), material-composition (recipes, rasters, radial motion, spectral variants, the layered-oblate preparation and presentation, cutaway materials), observation (science rasters and elevation, FITS maps, controlled and synoptic mosaics, band colours, plates and point sources, OIFITS observables and image fits, body maps with their meaning, spectral-cube band depths and resolution evidence), shape-model (the pipeline entry, with the solar geometry passed in; source records, GLB surfaces, shape lighting, ring leaves, surface rasters), cutaway and observed-surfaces contracts | Node only |

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
├── src/runtime-source/, src/prepared-presentation/, src/delivery/, src/sources/, src/contract/, src/astronomy/,
│   src/asset-publication/, src/facility-renders/, src/navigation/, src/site-assets/, src/surface-previews/, src/preparation/, src/thread-pool/
│                  the runtime-source reader, presentation passes, prepared delivery, source records, the object
│                  runtime contract, the astronomy package loader, navigation destinations and markers, surface-preview records, the preparation
│                  cache and trace format, and the thread-pool sizing: one entry each
├── cli/           command entries (`node packages/bake/cli/<command>.mts`); nothing imports them
├── src/objects/   color/, geometry/, cameras/, scene/, raster/, sources/, charts/, content/, surface-features/, stellar/, candidates/, lineage/,
│                  acquisition/, sphere-survey/, default-view/, celestial/, interpretation/, host-adapters/,
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
in `src/photometry/` (`node --test`), because they read body records and the ISIS oracle fixture; they import the entry.
The node-tree, CSSOM, leaf-box, layout and activation tests are `node --test` suites in `src/presentation/`. The prepared-presentation, delivery,
sources, navigation and preparation tests (with the solar-geometry generator's) are `node --test` suites in `src/prepared-presentation/`, `src/delivery/`,
`src/sources/`, `src/navigation/`, `src/preparation/`, `src/prepare-object/` and `src/prepare-objects/` (the solar-geometry generator remains in `tests/preparation/`); the shared lighting-bank check is `src/raster/`. The scene suite
(`src/scene/scene.test.ts`, node:test) and the presentation suites (`src/presentation/*.test.ts`, Vitest) prepare real bodies
from their published prepared data, so `vitest.config.ts` leaves them out of the package run. `pnpm test:preparation` runs them once that data is
restored, after its node:test stage passes. The same holds for the node:test suites of the volume compilers and the star,
shell, sky, density-volume, image-layer, catalogue and world-context bakes, which read restored sources.
The object libraries' tests stay outside the package, beside the pipelines in `packages/bake/authoring/<body>/` or under `tests/objects/<topic>/` (`node --test`), since they read body sources, kernel
banks and oracle fixtures through the repository's test helpers; they import the entries. `pnpm test:bake-objects` runs every test that imports an object entry.
The build bundles the renderer modules a topic imports and writes `dist/metafile-esm.json`, which
`packages/bake/cli/check-stale-builds.mts` reads to know when a renderer change makes the bake stale.

## Fixed surface paint order

The prepared-presentation pass resolves whole-surface visibility priorities before packing depth groups. It uses the measured CSS facing of every source face. Groups with a fixed order keep that order as the camera rotates; an inseparable visibility cycle stays together in native 3D, even when it exceeds the 64-leaf packing target. Source-edge plane splitting is reserved for inputs without a proven facing contract. This avoids introducing runtime `z-index` changes merely because a surface admits a geometric split.

## Prepared texture consumers

Every textured presentation resolves its image consumers from the actual scene CSS during preparation. Its tree carries `textureBindings`, including an explicit empty array when a texture cannot be published directly to leaves. Restoring an older runtime only reconstructs its transport; it does not run this compiler. Before reusing an installed runtime as compiler input, restore and verify it against its inventory with `node packages/bake/cli/setup-assets.mts --object=<id>`. A populated local cache may contain an older dataset. After changing presentation compilation, regenerate the affected runtime assets and publish their inventories.

The runtime uses those bindings to keep the mesh connected, publish images directly to their leaves, and introduce each atlas on one face before activating subsequent batches. A missing binding bank falls back to inherited texture publication and connected-node batching, combining the first atlas upload with the first 64 faces. The registry activation check rejects that omission for textured deliveries.

## Prepared ring backings

Ring wedges and full ring planes carry the same projective leaf metadata as body surfaces. Their compiler scales each leaf box and texture address together with the inverse transform, preserving the prepared world geometry. The shared silhouette groups choose backing sizes before connection and retain them during coasting. A ring must not bypass this contract by emitting only a fixed CSS box.

The Neptune and Uranus deliveries retain all 16 wedges and the same image bytes. [iPad evidence](evidence/ring-leaf-backings.json) records the resulting layer-memory reduction and the remaining timing limits.

## Catalogue point banks

A galaxy's dots are catalogue point banks (`cssearth-catalogue-points@1`). `prepare-catalogue-points.mts` places one
published catalogue; `merge-catalogue-points.mts` thins several into one bank; `stack-catalogue-points.mts` joins merged
levels. A recipe says where its bank belongs with `published: true`: the app fetches that bank by URL, so it is written
to `prepared/<id>.json`, inventoried and published to R2, and it holds at most `MAX_CATALOGUE_POINTS` (40,000,
`@cssearth/objects`), the same bound the renderer enforces. Every other bank is a bake input for a later merge or
stack and is written to the ignored `output/catalogue-points/<object>/`: never inventoried, never published, and
never imported as a module (`packages/bake/src/volume/node/catalogue-banks.ts`). Vite serves an imported JSON file as an
array literal, which Safari cannot compile past about a hundred thousand elements, and the site's build reads only
`datasets`, `lenses` and `presentation` from a context object's `prepared/`, plus its source manifest (`site/prepared-context-json.mts`).

## Evidence

The volume entries replaced the lab's `volume-core` and `volume-bake` packages, moving their sources
unchanged apart from import paths. The outputs were compared byte for byte with those of the packages:

- The lab's density bake of `labs/nebula/models/{lmc,smc}/full-density` wrote the same 292 files.
- `pnpm prepare:volume` for the Milky Way (192 prepared files) and `prepare-stars` for the stellar neighbourhood
  (4 files) wrote identical files.
- `tools/nebula/prepare.mts` for the eleven deliveries that bake wrote identical files, except each `delivery.json`
  receipt's implementation identity. That identity named the owners by package, and the name changed from
  `@cssearth/volume-core`/`@cssearth/volume-bake` to `@cssearth/bake`. With main's identity substituted, every
  `delivery.json` matched main's bytes. LMC and SMC record no such identity and matched entirely. M1 fails on both
  commits with the same error (`Compact sampled replay changed accepted hubble-optical volume`).
- The 52 moved tests pass under Vitest, and `node labs/nebula/run.mts test` keeps the same six failures as before
  the move. `pnpm test:lab` stops at the same density-bake assertion both times.
