# @cssearth/bake

The repository's build-time preparation code. The preparation code (`packages/bake/authoring/`,
`packages/telescope-cli/`, `site/build/`) and the nebula lab import it to turn source
records into prepared delivery. The application never imports it: the runtime reads only what the bake wrote.

Each topic is one subpath entry, with its source in `src/<topic>/`. A topic imports another only when it sits on a lower
layer (the raster lane uses the photometric models), never sideways. Command entries live in `cli/` and run as
`node packages/bake/cli/<command>.mts`; nothing imports them.

| entry | what it holds | host |
|---|---|---|
| `@cssearth/bake/volume` | emission interfaces, coordinates, fields, materials and sampling | host-neutral: no Node built-ins, DOM or native codecs; prepared recipes, slice formats, compiler controls, star inputs, observation mappings, simulation depth-prior and cancellation interfaces, and pure validators live in `@cssearth/objects` |
| `@cssearth/bake/volume/node` | compact-input replay, offline XYZ slices, the target-neutral compiler bake | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/photometry` | disk and phase functions, the Hapke model, limb laws from published models, PSG limb profiles | Node only (`node:fs`, `sharp`) |
| `@cssearth/bake/raster` | raster recipes, surface maps, pages and poles, lighting banks, atmospheres and halos, missing-coverage painting, the lossy WebP lane | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/scene` | geometry profiles, projected surface leaves, polar caps, ring wedges, cutaways, solid-body surfaces | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/presentation` | the retained node tree, leaf boxes, offline CSSOM reads, activation groups, the prepared-presentation contract, the cubic-sky and directional-Sun contracts | Node only (`node:*`, Playwright) |
| `@cssearth/bake/volume-leaves` | slice stacks as retained PolyCSS leaves, depth order, volume impostors | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/stars` | point-field recipes, catalogue sources, point atlas and photometry, the encoded point bank | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/shell` | surface-shell recipes, meshes and atlas, the CSS shell compiler | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/sky` | cubic sky recipes, the EXR source, baked faces, the CSS sky compiler | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/density` | density-volume acquisition, KTX2 encoding, slice atlases, dataset-bank promotion | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/image-layers` | image-layer recipes, the Lanczos3 resampler, image layers as PolyCSS leaves | Node only (`node:*`, PolyCSS) |
| `@cssearth/bake/galaxy-catalog` | galaxy catalogue recipes, sources, bibliography, positions and the object preparation | Node only (`node:*`, `yaml`) |
| `@cssearth/bake/cluster-catalog` | the galaxy-cluster catalogue | Node only |
| `@cssearth/bake/world-context` | the spatial world context: sources, bodies, orbit banks, system views, hyperbolic paths | Node only |
| `@cssearth/bake/nebula` | nebula delivery recipes, compact density and compiler deliveries, star sprites, sky frames | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/environment` | replay of an environment object's missing runtime images | Node only (`node:*`) |
| `@cssearth/bake/runtime-source` | the runtime-source reader: a runtime module parsed into ESTree with its imports resolved | Node only (`node:*`, the ESLint parser, Vite) |
| `@cssearth/bake/prepared-presentation` | passes over a compiled presentation: depth partitions, the cascade check, interior fill, authored-motion bindings | Node only (`node:*`, `sharp`, Playwright) |
| `@cssearth/bake/delivery` | atomic prepared-set writers, page metadata, WebP encodings, the verify-after-publish gate, runtime-asset locations | Node only (`node:*`, `sharp`, `cwebp-bin`) |
| `@cssearth/bake/sources` | an object's descriptor, source catalogue records, factsheet source checks, pinned-fact citations, investigation ledgers | Node only (`node:*`) |
| `@cssearth/bake/contract` | the checked object runtime definition and the audits of a prepared presentation | Node only |
| `@cssearth/bake/asset-publication` | staging, publishing and checking runtime assets on the asset host | Node only (`node:*`, `undici`) |
| `@cssearth/bake/astronomy` | access to the built astronomy package | Node only (`node:*`) |
| `@cssearth/bake/navigation` | prepared focus objects, scene distances, navigation marker recipes and sprites | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/facility-renders` | facility model poses and their three.js renderer | Node only (`three`) |
| `@cssearth/bake/site-assets` | dataset sprites, search thumbnails, the planets' phase charts | Node only (`node:*`, `sharp`, `vite`) |
| `@cssearth/bake/surface-previews` | the records a surface minimap or preview raster is drawn from | Node only (`node:*`) |
| `@cssearth/bake/preparation` | the stale-build check and the renderer bundling plugin | Node only (`node:*`) |
| `@cssearth/bake/thread-pool` | sizes libuv's thread pool to the cores; imported for its side effect before other entries | Node only (`node:os`) |
| `@cssearth/bake/objects/color` | the sRGB transfer, band-colour and asinh displays, palettes, whole-disc colour | Node only |
| `@cssearth/bake/objects/geometry` | shape models, radial meshes, shape cameras, ellipsoids, the radial-layer contract | Node only (`node:*`, meshoptimizer) |
| `@cssearth/bake/objects/cameras` | observer-computed cameras, SPICE kernel banks | Node only |
| `@cssearth/bake/objects/scene` | the physical world frame, authored rotations, default camera, directional Sun, generated sphere seams | Node only |
| `@cssearth/bake/objects/raster` | scientific surfaces (PDS, ISIS, FITS, GeoTIFF, VTK, NumPy, HEALPix, Tecplot), categorical geology, eclipse and phase-curve maps, observed colour rasters | Node only (`node:*`, `sharp`, `geotiff`) |
| `@cssearth/bake/objects/sources` | source references read through the manifest, pinned source files, reference banks, the download relay | Node only |
| `@cssearth/bake/objects/charts` | chart renderers and readers and their shared SVG style | Node only |
| `@cssearth/bake/objects/content` | the object-content contract, dataset vocabulary, prepared legends | Node only |
| `@cssearth/bake/objects/surface-features` | surface-feature banks, feature notes, image-control fits | Node only |
| `@cssearth/bake/objects/stellar` | a star's colour dataset, limb darkening, starspots, gravity darkening | Node only |
| `@cssearth/bake/objects/lineage` | which manifest sources each prepared product of a layered body reads, built in memory | Node only |
| `@cssearth/bake/objects/candidates` | read-only public-archive searches and imagery and resolved-star candidates | Node only (network) |
| `@cssearth/bake/objects/default-view` | what the default camera looks at and the turn toward a partial dataset's data | Node only (`node:*`, `sharp`) |
| `@cssearth/bake/objects/interpretation` | the observation interpreter the raster lane packs surfaces through | Node only (`node:*`, `sharp`, `h5wasm`) |
| `@cssearth/bake/objects/host-adapters` | the scene and presentation compilers' host adapters | Node only |
| `@cssearth/bake/objects/celestial` | an object's sky orientation and directional Sun from its celestial profile | Node only (`node:*`) |
| `@cssearth/bake/objects/acquisition` | converters that restore a derived source, and the Python converters body manifests name | Node only (`node:*`, `sharp`, `geotiff`, Python for DSK) |
| `@cssearth/bake/objects/sphere-survey` | the VLT/SPHERE asteroid survey release as photograph datasets | Node only (network) |
| `@cssearth/bake/objects/layers/<kind>` | the libraries each layer pipeline shares: terrestrial, giant, paged-ellipsoid, material-composition, observation, shape-model, cutaway and observed-surfaces | Node only |

Every entry validates what it reads and fails with a `TypeError` or `RangeError` naming the rule, such as
`Invalid retained render-element profile.` A replay that would change an accepted bake fails instead of writing it,
for example `Compact sampled replay changed accepted <dataset> volume`.

The nebula boundary checks (the `nebula-boundaries` rule of `pnpm check:architecture`, in
`.github/scripts/architecture/nebula-packages.mts` and `nebula-inbound.mts`) enforce that the runtime closure imports nothing from
`@cssearth/bake`, the lab's reconstruction package may import `@cssearth/bake/volume` but not its node
entry; volume-viewer consumes `@cssearth/objects`, the main volume entry imports no platform dependency, and no volume source names an object, an object path or
another topic.

`pnpm --filter @cssearth/bake build` writes `dist/`; `pnpm test:packages` runs the package's tests
from the repository checkout, since two of them replay tracked compact inputs under `src/objects/`. The raster
lane's surface test also reads the observation dataset sampler from `src/objects/layers/observation/`. The photometry tests live
in `src/photometry/` (`node --test`), because they read body records and the ISIS oracle fixture; they import the entry.
The node-tree, CSSOM, leaf-box, layout and activation tests are `node --test` suites in `src/presentation/`. The prepared-presentation, delivery,
sources, navigation and preparation tests (with the solar-geometry generator's) are `node --test` suites in `src/prepared-presentation/`, `src/delivery/`,
`src/sources/`, `src/navigation/`, `src/preparation/`, `src/prepare-object/` and `src/prepare-objects/` (the solar-geometry generator remains in `src/platform/`); the shared lighting-bank check is `src/raster/`. Suites that
prepare real bodies read published prepared data and restored sources; `pnpm test:packages` runs them with the rest of the
package after `pnpm setup:prepared`.
The build bundles the renderer modules a topic imports and writes `dist/metafile-esm.json`, which
`packages/bake/cli/check-stale-builds.mts` reads to know when a renderer change makes the bake stale.
`pnpm test:packages` runs this package's tests from the repository checkout, since some replay tracked compact
inputs under `src/objects/`.

## Fixed surface paint order

The prepared-presentation pass resolves whole-surface visibility priorities before packing depth groups, using the measured CSS facing of every source face. Groups with a fixed order keep it as the camera rotates; an inseparable visibility cycle stays together in native 3D, even past the 64-leaf packing target. Source-edge plane splitting is reserved for inputs without a proven facing contract, so no runtime `z-index` changes are needed.

## Prepared texture consumers

Every textured presentation resolves its image consumers from the actual scene CSS during preparation. Its tree carries `textureBindings`, including an explicit empty array when a texture cannot be published directly to leaves. Before reusing an installed runtime as compiler input, restore and verify it against its inventory with `node packages/bake/cli/setup-assets.mts --object=<id>`; a local cache may hold an older dataset. After changing presentation compilation, regenerate the affected runtime assets and publish their inventories.

The runtime uses those bindings to keep the mesh connected, publish images directly to their leaves, and introduce each atlas on one face before activating later batches. A missing binding bank falls back to inherited texture publication and connected-node batching. The registry activation check rejects that omission for textured deliveries.

## Prepared ring backings

Ring wedges and full ring planes carry the same projective leaf metadata as body surfaces. Their compiler scales each leaf box and texture address together with the inverse transform, preserving the prepared world geometry. The shared silhouette groups choose backing sizes before connection and keep them during coasting. A ring must not bypass this contract by emitting only a fixed CSS box.

## Catalogue point banks

A galaxy's dots are catalogue point banks (`cssearth-catalogue-points@1`). `prepare-catalogue-points.mts` places one
published catalogue; `merge-catalogue-points.mts` thins several into one bank; `stack-catalogue-points.mts` joins merged
levels. A recipe marks the bank the app fetches with `published: true`: it is written to `prepared/<id>.bin` (the
bank's fields with its points and cells as typed columns, `@cssearth/renderer` prepared-data/catalogue-bank-binary.ts,
packed by `@cssearth/objects` prepared-binary.ts), inventoried and published to R2, and holds at most `MAX_CATALOGUE_POINTS` (40,000, `@cssearth/objects`), the bound the
renderer enforces. Every other bank is a bake input written to the ignored `output/catalogue-points/<object>/`: never
inventoried, never published, and never imported as a module (`packages/bake/src/volume/node/catalogue-banks.ts`). Vite
serves an imported JSON file as an array literal, which Safari cannot compile past about a hundred thousand elements, and
the site's build reads only `datasets` and `presentation` from a context object's `prepared/`, plus its source manifest
(`site/prepared-context-json.mts`).
