# Bake package instructions

Own the build-time preparation code: what the preparation tools and the nebula lab run to turn source records into
prepared delivery. Nothing here runs in the application. The runtime (`@cssearth/renderer` and
`site/**`) must never import `@cssearth/bake`; a type the renderer needs belongs in the renderer's own contracts.

Each topic is one subpath entry. Topics must not import each other sideways. A topic may import a lower topic, and only
through that topic's `index.ts`, when `LOWER_TOPICS` in `src/entries.test.ts` declares it; the declared order has no
cycle. Share anything else through `@cssearth/core` or another package. Build-time code may import `@cssearth/renderer`
(the raster lane reads the prepared-asset constants the renderer owns, and the scene and presentation compilers write what
its validators accept); the renderer never imports the bake.

- `src/photometry/` is published as `@cssearth/bake/photometry` (Node only): published photometric models, their
  records and normalization, and the limb laws and PSG limb profiles preparation draws from them. It imports no topic.
- `src/raster/` is published as `@cssearth/bake/raster` (Node only): raster recipes and their validation, surface maps,
  pages and poles, the lighting, limb and atmosphere banks, the prepared atmosphere frame and composite, interiors, missing-coverage painting and the lossy WebP lane.
  It imports `photometry`.
- `src/scene/` is published as `@cssearth/bake/scene` (Node only): geometry profiles, projected surface leaves and their
  raster presentation, seam outsets, polar caps, ring wedges, cutaways, atmospheric materials, solid-body surfaces and
  the perspective camera of a solid scene.
  It imports `raster`. The host passes the physical scene and Sun directions in (`ScenePreparationAdapters`).
- `src/presentation/` is published as `@cssearth/bake/presentation` (Node only): the retained node tree with its
  projective layouts and leaf boxes, offline CSSOM reads (Playwright's Chromium), activation groups, and the row-bank
  cutaway, composite and emissive presentations; and the prepared-presentation contract with its schemas, and the cubic-sky
  and directional-Sun contracts and preparers it validates, and the material-track source planning (frame lookups and banks)
  the layer presentations build on. It imports `scene` and `raster`. The host passes material
  tracks and lens navigation in (`PresentationHostAdapters`); nothing here loads tools or platform modules itself. Its
  tests are `node --test` suites in `tests/presentation/` (the activation groups) and, until they move, `tools/prepared/`.
- `src/volume-leaves/` is published as `@cssearth/bake/volume-leaves` (Node only): the CSS volume compilers that turn
  slice stacks and detail planes into retained PolyCSS leaves, their bounds and depth order, and the volume impostors.
  It imports `scene` and `volume`.
- `src/stars/` is published as `@cssearth/bake/stars` (Node only): the point-field star bake (recipes, catalogue
  sources, palette, hierarchy, point atlas and photometry, diffuse sky, encoded bank). It imports `raster` and `volume`.
- `src/shell/` is published as `@cssearth/bake/shell` (Node only): the surface-shell bake and its CSS compiler. It
  imports `scene` and `volume`.
- `src/sky/` is published as `@cssearth/bake/sky` (Node only): the cubic sky bake (recipes, EXR source, baked faces,
  near-star sprites) and its CSS compiler. It imports `volume-leaves` and `volume`.
- `src/density/` is published as `@cssearth/bake/density` (Node only): the density-volume object bake (acquisition,
  column depth, fixed discs, slice atlases and retirement, lens-bank promotion). It imports `sky`, `volume-leaves` and
  `volume`.
- `src/image-layers/` is published as `@cssearth/bake/image-layers` (Node only): the extruded image-layer bake and its
  resampler. It imports `volume-leaves`.
- `src/environment/` is published as `@cssearth/bake/environment` (Node only): the environment-image replay. It
  imports `image-layers`, `shell`, `stars`, `density` and `volume`.
- `src/galaxy-catalog/` is published as `@cssearth/bake/galaxy-catalog` (Node only): the galaxy catalogue bake (recipes,
  CSV and archive sources, bibliography, positions, memberships, the display sample, and the object preparation that
  writes them with the object's inventory and descriptor). It imports `volume` (its node entry).
  `packages/bake/cli/prepare-galaxy-catalog.mts <object-directory>` is its command.
- `src/galaxy-field/` is published as `@cssearth/bake/galaxy-field` (Node only): the nearby-universe galaxy point field
  (the pinned catalogue acquisition through the source mirror, the scientific catalogue, the field recipe and the fitted
  clouds). It imports `objects/sources`. `packages/bake/cli/acquire-galaxy-field.mts` and `prepare-galaxy-field-points.mts`
  are `pnpm prepare:galaxy-field:data`. Its tests are `node --test` suites in `tests/galaxy-field/`.
- `src/cluster-catalog/` is published as `@cssearth/bake/cluster-catalog` (Node only): the galaxy-cluster catalogue,
  placed with the galaxy positions. It imports `galaxy-catalog`.
- `src/world-context/` is published as `@cssearth/bake/world-context` (Node only): the spatial world context (sources,
  bodies, orbit banks, system and group views, hyperbolic paths). It imports no topic.
- `src/runtime-source/` is published as `@cssearth/bake/runtime-source` (Node only): the runtime-source reader that
  preparation and the runtime ownership checks share. It parses a runtime module into ESTree with its original ranges,
  resolves its imports to source files through each package's exports and tsup entries, and reads names, keys and static
  object properties. It imports no topic.
- `src/prepared-presentation/` is published as `@cssearth/bake/prepared-presentation` (Node only): the passes that rewrite
  a compiled prepared presentation: depth partitions of a body's projected surface in a proven visibility order, the
  cascade check (Playwright's Chromium) that keeps each moved leaf's computed style, the interior fill of a cut-open
  body, and the authored-motion bindings that resolve a presentation's motion, activation groups, leaf boxes, depth
  partitions and interior fill against the object's page styles, which the application passes in (`pageStyles`, its
  `objectPageStyles`). It imports `presentation` and `raster`. Its tests are `node --test` suites in `tests/prepared-presentation/`.
- `src/delivery/` is published as `@cssearth/bake/delivery` (Node only): writing and publishing prepared output. The
  atomic prepared-set and text writers, the page metadata written beside a restored runtime, the WebP encodings prepared
  images are optimised with, the pinned source bytes an acquisition publishes, the verify-after-publish gate for the asset
  host, and the scan for `/scenes/` references an asset-origin build left behind (`packages/bake/cli/check-asset-origin-scenes.mts`).
  `packages/bake/cli/publish-source-cache.mts` mirrors an object's downloads into the source cache with it. It also holds
  the inventoried runtime-asset locations (the R2 key, URL and restore path of each inventoried file, for a checkout root
  the caller passes in), the public scene images an object ships (its runtime manifest) and the publication of a staged
  preparation into the object package. It imports `objects/sources`. Its tests are `node --test` suites in
  `tests/delivery/`; the runtime-manifest and publication tests are in `tests/objects/`, where `pnpm test:preparation` finds them.
- `src/sources/` is published as `@cssearth/bake/sources` (Node only): source records preparation reads beside an
  object: its authored descriptor, the independent records of the source catalogue (`src/sources/`), the authored
  physical world frame checked against a prepared scene and runtime, and the images embedded in a published PDF figure;
  the checks of a factsheet's cited source evidence, the object-information source records, and the citations of
  factsheet values from the records a body pins (`packages/bake/cli/cite-pinned-facts.mts` is their command); the source
  records a context manifest lists, the factsheet citations and source inventory the prepared source catalogue compiles, the
  bibliography citations of the prepared galaxy and cluster catalogues, and the digest that says whether a recorded
  preparation still applies to a provenance record; the context packages' provenance, compiled from their manifests or read
  as installed, and the facility artwork refresh; and the investigation ledgers beside each object and facility with the
  shared surveys they quote (`data/investigations/`) and the report over them (`packages/bake/cli/report-investigations.mts`
  is its command). The application passes in the route its context objects show at
  (`CONTEXT_ROUTE`) and its dataset routes. It imports `runtime-source`, `objects/content` and `delivery`. `packages/bake/cli/acquire-moon-catalogues.mts` refreshes the pinned
  JPL moon catalogue (`site/source/moon-catalogues.json`). Its tests are `node --test` suites in `tests/sources/`.
- `src/contract/` is published as `@cssearth/bake/contract` (Node only): the checked object runtime definition preparation
  writes and tests read back, with its prepared resource catalogue, validated against the prepared-presentation contract
  and the renderer's object controls. It imports `presentation`.
- `src/astronomy/` is published as `@cssearth/bake/astronomy` (Node only): preparation's access to the built astronomy
  package (`loadAstronomyPackage`), which finds the build through this package's own name so the path holds from `dist/`.
  It imports no topic. `packages/bake/cli/prepare-solar-geometry.mts` generates `src/platform/solar-geometry.mts` from it;
  its test is `tests/preparation/solar-geometry.test.mts`.
- `src/navigation/` is published as `@cssearth/bake/navigation` (Node only): the prepared focus objects and scene distances
  the catalogue and search destinations are built from, and the marker recipes whose source bytes are checked and drawn
  into navigation marker sprites. It imports `raster`, and `objects/raster` (loaded only when a marker is drawn from a
  science raster). Its tests are `node --test` suites in `tests/navigation/`.
- `src/surface-previews/` is published as `@cssearth/bake/surface-previews` (Node only): the prepared records a surface
  minimap or preview raster is drawn from, read and checked. It imports no topic.
- `src/preparation/` is published as `@cssearth/bake/preparation` (Node only): the preparation cache and the record format
  of the preparation trace. `packages/bake/cli/preparation-trace.mts` is the trace itself, which
  `tools/prepare/prepare-objects.mts` loads into each body's preparation with `NODE_OPTIONS=--import`; it loads this entry
  before it starts recording, so the entry imports no project module but `@cssearth/core`. It imports no topic. Its tests
  are `node --test` suites in `tests/preparation/`.
- `src/thread-pool/` is published as `@cssearth/bake/thread-pool` (Node only) and imported for its side effect: it sizes
  libuv's thread pool, where sharp encodes, to the cores. A command imports it before any other bake entry. It is the one
  entry `package.json` lists under `sideEffects`.
- `src/objects/` holds the shared object libraries the per-body preparation pipelines in `tools/objects/` import. Each of
  its folders is a topic of its own, published as `@cssearth/bake/objects/<topic>` (Node only), importing another topic only as `LOWER_TOPICS` declares:
  - `objects/color`: the sRGB transfer, band-colour and asinh displays, palettes and tints, a placed star's catalogue colour,
    and the uniform colour of whole-disc photometry. The host passes the CIE 1931 colour-matching table in.
  - `objects/geometry`: shape models (OBJ, STL, PDS plate, vertex-facet and radius tables, FITS facet fields) and the records
    that describe them, radial meshes and their simplification, controlled shape cameras and band alignment, ellipsoids, the
    Lambert attenuation atlas and the radial-layer contract.
  - `objects/cameras`: observer-computed cameras from an ephemeris and a spin state or IAU pole model, and the shared SPICE
    kernel banks bound to the source-manifest reader (`packages/bake/cli/kernel-bank.mts` is their command line).
  - `objects/scene`: the physical world frame navigation is solved in, authored synchronous and hosted rotations, and the frames
    derived from the prepared solar geometry: the ecliptic presentation frame, the default camera, the Sun's reference view
    direction and the astrometric sky registration, and from them an object's physical solar-system scene and focused
    camera; also the authored presentation basis and drawn node chain the world-navigation stage solves, the physical
    projection it adds to rotating material tracks, a recipe's camera source, and the seams and projection block every generated
    sphere is written with. The solar geometry is generated into the checkout (`src/platform/solar-geometry.mts`) after the packages build,
    so the host passes it in (`SolarGeometry`). The prepared sky and Sun contracts and their preparers belong to
    `presentation` (`src/presentation/{cubic-sky,directional-sun}-contract.ts`), which the scene imports as a lower topic.
  - `objects/raster`: scientific surfaces from PDS, ISIS, FITS, GeoTIFF, VTK, NumPy, HEALPix and Tecplot products,
    categorical geology and symbols, exoplanet eclipse and published phase-curve maps, observed colour rasters and their
    photometric composition, a planet's whole-disc colour record and the band-ratio tie to it, the source records they read, the WISE atlas mosaic grid, FITS binary tables (OIFITS and archive
    tables) and a star's limb darkening fitted to TESS transits. It imports `objects/scene`,
    `objects/geometry`, `objects/color`, `objects/cameras`, `raster` and `photometry`.
  - `objects/sources`: an object's authored source references read through its source manifest, and the pinned source
    files (bindings, byte ranges, contained paths, atomic publication) preparation reads and writes; JSON source values
    left unchecked for their consumer; the shared reference banks under `src/references/` (the CIE 1931 table), whose
    directory is found on first use; the matcher that binds a manifest's recorded generator name to today's code; and the
    idle-timeout stream relay pinned downloads go through.
  - `objects/charts`: the chart renderers and readers a content recipe names (measured spectra, retrieved profiles,
    reflectance, temperature-pressure, phase and light curves, FITS gallery pictures) and their shared SVG style. It imports
    no topic. The recipe dispatcher, spectrum reader and compact spectrum stay in
    `tools/objects/charts/`: `site/prepare-body-overview.mts` uses them, and the runtime may not import the bake.
  - `objects/content`: the object-content contract (facts, labels, lens, legend and gallery recipes, the prepared shell
    payload), the shared lens vocabulary, lens steps and prepared legends, each lens control's billboard colour, and the legend
    labels a palette lens derives from the stretch its report states. It
    imports no topic. The content preparer that reads factsheets and writes the payload stays in `tools/objects/content/`.
  - `objects/surface-features`: named surface features and their prepared banks (IAU nomenclature archives, Natural Earth
    vectors, landing sites, shape-model landmarks, ellipsoid projection), source-backed feature notes, and the image-control
    fits behind encounter and orthophoto landmarks and the projected-control check (`packages/bake/cli/` holds those three
    commands). It imports `objects/geometry`, `objects/raster` and `objects/layers/terrestrial`; attaching the banks to a
    globe stays in `tools/objects/surface-features/`.
  - `objects/stellar`: a star's colour lens from its measured, Gaia XP or Planck spectrum and its limb darkening, starspots
    from a published figure or occultation, and Roche-von Zeipel gravity darkening. It imports `objects/color`,
    `objects/raster` and `objects/sources`. It is not part of `objects/layers/observation`, whose code the nebula lab's
    compiler identity reaches, so that identity does not pin the source-manifest readers.
  - `objects/candidates`: what public archives hold for a body or a star before it is reworked: read-only searches of
    ALMA, the ESO archive, MAST, DataCite and the JMMC diameters (a query and a pure summary of its rows each), the imagery
    candidates (OPUS frames finer than a body ships, archive leads for a named body) and the resolved-star candidates. It
    imports no topic. `packages/bake/cli/imagery-candidates.mts` and `star-candidates.mts` print them.
  - `objects/provenance`: the record readers and recipe bindings of a layered body's provenance (the product inputs, recipe
    and outputs each preparation family records); `tools/objects/provenance.mts` compiles the record from them. It imports
    `objects/layers/terrestrial`.
  - `objects/layers/<kind>` (`terrestrial`, `giant`, `paged-ellipsoid`, `material-composition`, `cutaway`, `observed-surfaces`,
    `observation`, `shape-model`):
    the libraries each layer pipeline shares, one entry per kind. A layer imports the object topics and bake topics above and,
    as `LOWER_TOPICS` declares, another layer (`material-composition` → `giant` → `observed-surfaces`, and `material-composition` → `cutaway`). The cutaway
    material bake lives in `material-composition` (`cutaway-materials.ts`): it reads that topic's recipe checks, and only the
    layered-oblate preparation uses it, so `cutaway` stays the contract below both. `layered-oblate.ts` and
    `cutaway-materials.ts` moved over the 600-line limit and are exempt in `eslint.config.mts` until they are split. The giant
    material bake, layered presentation, object preparation and observed polar surfaces stay in `tools/objects/`: they use
    `material-composition`'s atlas tile writer and path check, and `material-composition` reads `giant`'s radial fields, so
    in `giant` they would close a topic cycle. Code that reads
    the generated solar geometry takes it as a parameter (`SolarGeometry`), as the scene topic does: the terrestrial pipeline
    entry (`terrestrial-layers.ts`) and solid scene (`solid-scene.ts`, which also reads each body's retained position source,
    `SolidSceneSolarGeometry`) and the shape-model entry (`shape-model.ts`) take it from `tools/objects/prepare-authored.ts`,
    which loads the generated module. They reach the astronomy package through `astronomy`, the object runtime contract through
    `contract`, the depth-source restore through `prepared-presentation` and the content preparer's types through
    `objects/content`, as lower topics. The pipelines' other entry scripts and modules that still read platform files stay in
    `tools/objects/`; the terrestrial commands that derive
    observer cameras, write Horizons tables, re-measure registration and write its README block are in `packages/bake/cli/`,
    with the band-alignment, camera-reference and L'LORRI overlap commands and the archived-camera Python that runs the
    camera reference beside it. A source manifest's `generator` records
    what made an intermediate when it was made, so manifests keep naming the radial snapshot and PDS constraint map by their
    old `tools/objects/terrestrial-layers/` paths; `objects/sources` (`preparation-generator.ts`) binds those names to this code.
    Terrestrial keeps its radial terrain and materials in `radial/`, its solid rasters in `solid/`, and the
    surface-observation pipeline (formats, cameras, pixel geometry, photometry, footprints, surface transfer, registration) in
    `surface-observations/`; the paged-ellipsoid globe (`globe/`) holds its recipe context and its scene, split into the
    shared scene context, the sphere leaves, the cutaway interior and the atmosphere material bank.
  Their tests stay outside the package, beside the pipelines in `tools/objects/` or under `tests/objects/<topic>/` once the
  pipeline's library has moved (`node --test`), because they read body sources, kernel banks and oracle fixtures through the
  repository's test helpers; they import the entries. The terrestrial tests, the source-surface fixture and its independent
  Python verifier are in `tests/objects/terrestrial/`. A node test that needs none of those helpers sits beside its module
  (`objects/layers/paged-ellipsoid/*.test.ts`, `objects/layers/terrestrial/triangle-alpha-atlas.test.ts`,
  `objects/raster/observed/observed-geotiff.test.ts`); Vitest skips `src/objects/**/*.test.ts`. `pnpm test:bake-objects`
  (`.github/scripts/checks/test-bake-objects.mts`) runs every test that imports an object entry, in the contract lint job.
- `src/nebula/` is published as `@cssearth/bake/nebula` (Node only): the nebula delivery bake (delivery recipes and
  identities, compact density, finite-emission and compiler deliveries, catalogue fields, star sprites, frames,
  render-element budgets). It imports `volume`, `volume-leaves`, `density` and `stars`. `packages/bake/cli/prepare-nebulae.mts` is its
  entry and records the prepared closure with the platform's inventory.
- The star, shell and density-volume bakes write into an object's own `prepared/` directory only with the host's
  inventory passed in (`inventory`, the platform's `inventoryPreparedAssets`); a scratch bake needs none. Their commands
  (`packages/bake/cli/prepare-stars.mts`, `prepare-shell.mts`, `prepare-volume.mts`, the last also `pnpm prepare:volume`
  and the telescope's F16 volume operation) pass `@cssearth/objects/node`'s.

- `src/volume/` is published as `@cssearth/bake/volume`: the volume contracts, coordinates, fields, materials and
  sampling. It stays host-neutral, because the nebula lab's browser viewer imports it: no Node built-ins, `Buffer`,
  DOM, React, Vite, `sharp`, PolyCSS, renderer imports or file paths, and it never imports `node/`.
- `src/volume/node/` is published as `@cssearth/bake/volume/node`: the compact-input replay, the XYZ slices and the
  compiler bake. It may import `node:*`, `sharp` and the main volume entry. The main entry never imports it; the Node-only
  topics above may, as a lower layer.

## Behaviour is part of the contract

Prepared volumes, nebula deliveries and the lab's accepted density bakes depend on exactly what this code returns.
Preserve arithmetic order, finite support, frames, units, spectral semantics, missing-data handling and historical
compatibility. A relocation must not change accepted pixels or relax a validator. Material colour does not define
density: keep component-bound 3D material distinct from historical image-ray samplers, and never add an XY fallback to
the finite-emission compiler. Change an output only on purpose, together with every test and accepted bake that pins it.

The `nebulaImplementation` inventory in `package.json` lists the sources that nebula delivery identities hash. Keep it
covering every topic directory whose code a delivery runs (`tools/nebula/application/package-identity.test.ts` checks it
against the delivery's import closure); `src/nebula/objects.ts` names only owners outside the package.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs. The host supplies object
  paths, recipes and backends through validated contracts.
- Keep object JSON, source inputs/manifests, licences, required notices, provenance, and prepared payloads outside
  packages.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.
- `tsup` bundles the JavaScript; declarations come from one `tsc` pass (`tsconfig.build.json`, per file under
  `dist/types/`), and each exported `dist/<entry>.d.ts` re-exports its topic's index. A new topic needs only its entry in
  `tsup.config.ts` and `package.json`; don't raise Node's heap for the build.
