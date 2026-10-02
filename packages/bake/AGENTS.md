# Bake package instructions

Own the build-time preparation code: what the preparation tools and the nebula lab run to turn source records into
prepared delivery. Nothing here runs in the application. The runtime (`@cssearth/renderer` and
`site/**`, apart from its build-time `site/build/`) must never import `@cssearth/bake`; shared prepared-format types belong in `@cssearth/objects`.

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
  cutaway, composite and emissive presentations; and authored presentation-envelope checks using shared sky/Sun validators from `@cssearth/objects`,
  and the cubic-sky and directional-Sun authored standards and preparers, and the material-track source planning (frame lookups and banks)
  the layer presentations build on. It imports `scene` and `raster`. The host passes material
  tracks and dataset navigation in (`PresentationHostAdapters`); nothing here loads tools or platform modules itself. Its
  tests are `node --test` suites in `src/presentation/` (the activation groups, node tree, CSSOM, leaf boxes and layouts).
- `src/volume-leaves/` is published as `@cssearth/bake/volume-leaves` (Node only): the CSS volume compilers that turn
  slice stacks into retained PolyCSS leaves, their bounds and depth order, and the volume impostors.
  It imports `scene` and `volume`.
- `src/stars/` is published as `@cssearth/bake/stars` (Node only): the point-field star bake (recipes, catalogue
  sources, palette, hierarchy, point atlas and photometry, diffuse sky, encoded bank). It imports `raster` and `volume`.
- `src/shell/` is published as `@cssearth/bake/shell` (Node only): the surface-shell bake and its CSS compiler. It
  imports `scene` and `volume`.
- `src/sky/` is published as `@cssearth/bake/sky` (Node only): the cubic sky bake (recipes, EXR source, baked faces)
  and its CSS compiler. It imports `volume-leaves` and `volume`.
- `src/density/` is published as `@cssearth/bake/density` (Node only): the density-volume object bake (acquisition,
  column depth, fixed discs, slice atlases and retirement, dataset-bank promotion). It imports `sky`, `volume-leaves` and
  `volume`.
- `src/image-layers/` is published as `@cssearth/bake/image-layers` (Node only): the extruded image-layer bake and its
  resampler. It imports `volume-leaves`.
- `src/environment/` is published as `@cssearth/bake/environment` (Node only): the environment-image replay. It
  imports `image-layers`, `shell`, `stars`, `density` and `volume`.
- `src/galaxy-catalog/` is published as `@cssearth/bake/galaxy-catalog` (Node only): the galaxy catalogue bake (recipes,
  CSV and archive sources, bibliography, positions, memberships, the display sample, and the object preparation that
  writes them with the object's inventory and descriptor). It imports `volume` (its node entry).
  `packages/bake/cli/prepare-galaxy-catalog.mts <object-directory>` is its command.
- `src/cluster-catalog/` is published as `@cssearth/bake/cluster-catalog` (Node only): the galaxy-cluster catalogue,
  placed with the galaxy positions at each cluster's Cosmicflows-4 group distance, and the object preparation that writes
  it with its inventory. It imports `galaxy-catalog`. `packages/bake/cli/prepare-cluster-catalog.mts <object-directory>`
  is its command.
- `src/world-context/` is published as `@cssearth/bake/world-context` (Node only): the spatial world context (sources,
  bodies, system and group views, hyperbolic paths). Orbit-bank codecs and prepared world contracts live in
  `@cssearth/objects`; spatial computation and authored-source validation stay here. It imports no topic.
- `src/runtime-source/` is published as `@cssearth/bake/runtime-source` (Node only): the runtime-source reader that
  preparation and the runtime ownership checks share. It parses a runtime module into ESTree with its original ranges,
  resolves its imports to source files through each package's exports and tsup entries, and reads names, keys and static
  object properties. It imports no topic.
- `src/prepared-presentation/` is published as `@cssearth/bake/prepared-presentation` (Node only): the passes that rewrite
  a compiled prepared presentation: depth partitions of a body's projected surface in a proven visibility order, the
  cascade check (Playwright's Chromium) that keeps each moved leaf's computed style, the interior fill of a cut-open
  body, and the authored-motion bindings that resolve a presentation's motion, activation groups, leaf boxes, depth
  partitions and interior fill against the object's page styles, which the application passes in (`pageStyles`, its
  `objectPageStyles`). It imports `presentation` and `raster`. Its tests are `node --test` suites in `src/prepared-presentation/`.
- `src/delivery/` is published as `@cssearth/bake/delivery` (Node only): writing and publishing prepared output. The
  atomic prepared-set and text writers, the page metadata written beside a restored runtime, the WebP encodings prepared
  images are optimised with, the pinned source bytes an acquisition publishes, the verify-after-publish gate for the asset
  host, and the scan for `/scenes/` references an asset-origin build left behind (`packages/bake/cli/check-asset-origin-scenes.mts`).
  `packages/bake/cli/publish-source-cache.mts` mirrors an object's downloads into the source cache with it. It also holds
  the inventoried runtime-asset locations (the R2 key, URL and restore path of each inventoried file, for a checkout root
  the caller passes in), the public scene images an object ships (its runtime manifest) and the publication of a staged
  preparation into the object package. It imports `objects/sources`. Its tests are `node --test` suites in
  `src/delivery/`; the runtime-manifest and publication tests are in `src/delivery/`.
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
  JPL moon catalogue (`site/source/moon-catalogues.json`). Its tests are `node --test` suites in `src/sources/`.
- `src/contract/` is published as `@cssearth/bake/contract` (Node only): the checked object runtime definition preparation
  writes and tests read back, with its prepared resource catalogue, validated against the prepared-presentation contract
  and the shared object controls, and the audits that read a prepared presentation and its authored runtime sources back
  against the descriptor (`check-prepared-presentation.ts`; the prepared format constant comes
  from `@cssearth/objects`). The audit reads the registry on first use, not at import. It imports
  `presentation`, `runtime-source` and `sources`. `packages/bake/cli/check-prepared-presentation.mts` is the audit's command,
  run for each object by the `audit` step of `prepare-object`. `prepared-object-pin.ts` pins a prepared object to its
  transport (the descriptor's `prepared` pin and page reference, and the inventory; the transports themselves are built from
  the runtime when read); the world-navigation
  and spatial-context finalization before it stays in `site/build/prepare/prepare-object-json.mts`, site-owned preparation.
  Its tests are in `src/contract/`.
- `src/asset-publication/` is published as `@cssearth/bake/asset-publication` (Node only): the commands around the runtime
  asset host. Staging a pull request's baked bytes against its frozen inventories, publishing the inventoried files, the
  published-asset gate, the deploy check (which reads the renderer's prepared world-context parsers) and the dry-run prune
  report. It is its own topic so that `delivery`'s many importers do not load `undici` or those parsers. It imports `delivery`
  and `objects/sources`. Its commands are `packages/bake/cli/{stage-published-assets,publish-runtime-assets,
  check-assets-published,check-deploy-assets,prune-runtime-assets}.mts` (publish-assets.yml runs the first three from the
  trusted checkout); its tests are in `src/asset-publication/`.
- `src/astronomy/` is published as `@cssearth/bake/astronomy` (Node only): preparation's access to the built astronomy
  package (`loadAstronomyPackage`), which finds the build through this package's own name so the path holds from `dist/`.
  It imports no topic. `packages/bake/cli/prepare-solar-geometry.mts` generates `src/platform/solar-geometry.mts` from it;
  its test is `src/platform/solar-geometry.test.mts`.
- `src/navigation/` is published as `@cssearth/bake/navigation` (Node only): the navigation distances
  the catalogue and search destinations are built with, and the marker recipes whose source bytes are checked and drawn
  into navigation marker sprites, and the navigation preparation (`prepare-navigation.ts`, with the Sun, black-hole,
  supernova and action marker sources in `marker-descriptors.ts`) that writes the marker atlases, action markers and
  `site/prepared-navigation-markers.mjs`, and the flat neutral disc (`neutral-disc-marker.ts`) that marks an unresolved,
  self-luminous surface in generated and authored packages. It reads the registry on first use, not at import, and validates marker
  presentation with the renderer's rules (`@cssearth/renderer/navigation/marker-presentation.ts`, which the shell uses to
  draw them). It imports `raster`, `delivery`, `sources`, `astronomy`, and `objects/raster` (loaded only when a marker is
  drawn from a science raster). `packages/bake/cli/prepare-navigation.mts` is its command. Its tests are `node --test`
  suites in `src/navigation/`, with the navigation preparation's in `site/test/`.
- `src/facility-renders/` is published as `@cssearth/bake/facility-renders` (Node only): the illustrative poses of the rendered
  facility models, and the types of the three.js renderer (`render.ts`) that `packages/bake/cli/prepare-facility-renders.mts`
  bundles from its source into a browser page. The command imports the canonical dataset routes from
  `@cssearth/objects/provenance` and passes them to the artwork refresh. It imports no topic; it depends on `three` and `esbuild`. Its test is `src/facility-renders/`.
- `src/site-assets/` is published as `@cssearth/bake/site-assets` (Node only): the application's prepared assets that are
  not an object's own: dataset sprites and search thumbnails (committed; `prepare-navigation` remakes them) cut from prepared page and navigation images, the object-row
  thumbnail framing (`object-thumbnail.ts`: an object's light cut to its measured extent and faded out before the image frame), the planets'
  photometric phase charts. It imports `raster`, `runtime-source`, `objects/raster` and `objects/charts`. Its commands are
  `packages/bake/cli/prepare-{dataset-sprites,search-thumbnails,scientific-charts}.mts`; its tests are in `src/site-assets/` and `site/test/`.
- `src/surface-previews/` is published as `@cssearth/bake/surface-previews` (Node only): the prepared records a surface
  minimap or preview raster is drawn from, read and checked; the sidebar minimaps and preview rasters themselves, with the
  coverage direction of each dataset's map, which the world-navigation stage turns a partial dataset toward. It imports the topics
  `LOWER_TOPICS` declares for it (`raster`, `scene`, `objects/scene`, `objects/default-view`, `objects/interpretation` and
  three layers).
- `src/preparation/` is published as `@cssearth/bake/preparation` (Node only): the esbuild plugin (`bundle-renderer.ts`)
  that bundles `@cssearth/renderer`'s TypeScript source subpaths into a Node bundle that keeps other packages external (the
  preparation test runner and bundle-building tests use it). It imports no topic. It also holds the stale-build check (`stale-builds.ts`) that `pnpm dev:prepare` and `packages/bake/cli/prepare-object.mts` run through
  `packages/bake/cli/check-stale-builds.mts`: that command imports the module from source, the one bake command that does,
  because it must run, and `--run` must rebuild, while this package is unbuilt, so the module imports only Node built-ins.
  Its tests are `node --test` suites in `src/preparation/`.
- `src/run-implemented-objects/` is published as `@cssearth/bake/run-implemented-objects` (Node only): runs a registered
  scene object's acquire, prepare, test, browser or assemble command, and the concurrency-limited, memory-budgeted
  scheduler `prepare-objects` calls to prepare several objects at once. It imports `sources`. `packages/bake/cli/run-implemented-objects.mts` is its command.
- `src/prepare-objects/` is published as `@cssearth/bake/prepare-objects` (Node only): the catalogue-wide preparation run,
  each object through `run-implemented-objects`'s scheduler, then navigation and the inventories. It imports
  `run-implemented-objects`. `packages/bake/cli/prepare-objects.mts` is its command.
- `src/prepare-object/` is published as `@cssearth/bake/prepare-object` (Node only): the ordered preparation chain for one
  or more authored objects end to end (builds, catalogue, geometry, the authored preparation, page data, text, markers,
  billboard, world context, provenance), naming the step that failed and how to resume. It imports no topic; its steps
  shell out to the other bake and site-owned preparation commands by path. `packages/bake/cli/prepare-object.mts` is its
  command; its tests are in `src/prepare-object/`.
- `src/thread-pool/` is published as `@cssearth/bake/thread-pool` (Node only) and imported for its side effect: it sizes
  libuv's thread pool, where sharp encodes, to the cores. A command imports it before any other bake entry. It is the one
  entry `package.json` lists under `sideEffects`.
- `src/objects/` holds the shared object libraries the per-body preparation pipelines in `packages/bake/authoring/<body>/` (and `packages/telescope-cli/authoring/<body>/`) import. Each of
  its folders is a topic of its own, published as `@cssearth/bake/objects/<topic>` (Node only), importing another topic only as `LOWER_TOPICS` declares:
  - `objects/color`: the sRGB transfer, band-color and asinh displays, palettes and tints, a placed star's catalogue color,
    and the uniform color of whole-disc photometry. The host passes the CIE 1931 color-matching table in.
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
    so the host passes it in (`SolarGeometry`). The prepared sky and Sun contracts belong to `@cssearth/objects`; their authored standards and preparers
    belong to `presentation`, which the scene imports as a lower topic.
  - `objects/raster`: scientific surfaces from PDS, ISIS, FITS, GeoTIFF, VTK, NumPy, HEALPix and Tecplot products,
    categorical geology and symbols, exoplanet eclipse and published phase-curve maps, observed color rasters and their
    photometric composition, a planet's whole-disc color record and the band-ratio tie to it, the source records they read, the WISE atlas mosaic grid, FITS binary tables (OIFITS and archive
    tables) and a star's limb darkening fitted to TESS transits. It imports `objects/scene`,
    `objects/geometry`, `objects/color`, `objects/cameras`, `raster` and `photometry`.
  - `objects/sources`: an object's authored source references read through its source manifest, and the pinned source
    files (bindings, byte ranges, contained paths, atomic publication) preparation reads and writes; JSON source values
    left unchecked for their consumer; the shared reference banks under `src/references/` (the CIE 1931 table), whose
    directory is found on first use; and the
    idle-timeout stream relay pinned downloads go through.
  - `objects/charts`: the chart renderers and readers a content recipe names (measured spectra, retrieved profiles,
    reflectance, temperature-pressure, phase and light curves, FITS gallery pictures) and their shared SVG style. It imports
    no topic. The recipe dispatcher is site-owned preparation in
    `site/build/charts/`; the spectrum reader and compact spectrum are in `site/overview/`, because
    `site/prepare-body-overview.mts` uses them and the runtime may not import the bake.
  - `objects/content`: the object-content contract (facts, labels, dataset, legend and gallery recipes, the prepared shell
    payload), the shared dataset vocabulary, dataset steps and prepared legends, each dataset control's billboard color, and the legend
    labels a palette dataset derives from the stretch its report states. It
    imports no topic. The content preparer that reads factsheets and writes the payload is site-owned preparation in `site/build/content/`
    (it reads the prepared shell titles).
  - `objects/surface-features`: named surface features and their prepared banks (IAU nomenclature archives, Natural Earth
    vectors, landing sites, shape-model landmarks, ellipsoid projection), source-backed feature notes, and the image-control
    fits behind encounter and orthophoto landmarks and the projected-control check (`packages/bake/cli/` holds those three
    commands), and attaching the banks to a prepared globe (`attach.ts`). It imports `objects/geometry`, `objects/raster`,
    `objects/scene`, `objects/layers/paged-ellipsoid` and `objects/layers/terrestrial`.
  - `objects/stellar`: a star's color dataset from its measured, Gaia XP or Planck spectrum and its limb darkening, starspots
    from a published figure or occultation, and Roche-von Zeipel gravity darkening, with the GaiaXPy script that samples a
    continuous Gaia XP spectrum (`xp-continuous-sample.py`) the body READMEs name. It imports `objects/color`,
    `objects/raster` and `objects/sources`. It is not part of `objects/layers/observation`, whose code the nebula lab's
    compiler identity reaches, so that identity does not pin the source-manifest readers.
  - `objects/candidates`: what public archives hold for a body or a star before it is reworked: read-only searches of
    ALMA, the ESO archive, MAST, DataCite and the JMMC diameters (a query and a pure summary of its rows each), the imagery
    candidates (OPUS frames finer than a body ships, archive leads for a named body) and the resolved-star candidates. It
    imports no topic. `packages/bake/cli/imagery-candidates.mts` and `star-candidates.mts` print them.
  - `objects/lineage`: which manifest sources each prepared product of a layered body reads, built in memory from its
    source records (`body-lineage.ts`) by each preparation family's recipe bindings (`lineage-recipes.ts`). The facilities
    and sources catalogues read it; nothing writes it. It imports `objects/layers/terrestrial`.
  - `objects/default-view`: what a prepared object's default camera looks at, from the runtime's own camera math and the
    solar geometry the host passes in, with the check that a photograph dataset's default camera faces the dataset; the default
    dataset's data coverage, read from its prepared minimap, that the default camera turns toward; and the turn toward a partial
    dataset's data when a reader picks it (`dataset-facing.ts`), from the coverage direction the minimap step records for each dataset,
    which the world-navigation stage applies to every dataset whose recipe authors no focus. It imports `objects/scene` and
    `raster`.
  - `objects/celestial`: an object's sky orientation and directional Sun, prepared into renderer-neutral JSON from its
    celestial profile and the solar geometry the host passes in. It imports `objects/scene` and `presentation`.
    `objects/default-view` and `objects/celestial` are topics of their own, not part of `objects/scene`, whose code the
    nebula lab's compiler identity reaches, so that identity does not pin them.
  - `objects/acquisition`: the converters a body's acquisition plan runs to restore a derived source from its pinned original
    (a SPICE DSK to a welded mesh archive, GeoTIFF numeric grids and images read by byte range, mapped-composition fits, the
    JPL satellite catalogue), and beside them the Python converters the body manifests name as reproduction routes, with their
    pinned requirements and method notes (`MAPPED-SCIENCE.md`, `DSK-RESTORATION.md`). `dsk-mesh.ts` launches `dsk-mesh.py`
    from this source folder, found by the package's name, so the path holds from `dist/`. `operations-acquisition.ts` runs a
    body's acquisition plan and restores its missing pinned sources. It imports `raster` and `objects/sources`, and loads
    `objects/layers/terrestrial` and `objects/layers/observation` for the plan steps that need them. `packages/bake/cli/mapped-composition-evidence.mts` writes a mapped-composition receipt; Ganymede's
    coverage comparison stays in `packages/bake/authoring/ganymede/` for per-body authoring.
  - `objects/sphere-survey`: the VLT/SPHERE asteroid survey as a source of photograph datasets: the LAM release's listings and
    downloads, apparitions and series of frames, which apparitions a dataset can join, and the survey figure's printed labels. It
    sets up a body's dataset (`survey-setup.ts`, with the survey figure table `vernazza-2021-figures.json` read through the
    package's name), installs it into the body's package (`survey-install.ts`) and measures a dataset against its paper's comparison
    figure (`published-comparison.ts`). It imports `objects/cameras`, `objects/geometry`, `objects/layers/terrestrial` and
    `sources`. Its commands are `packages/bake/cli/sphere-survey-{setup,install,apparitions}.mts` and `published-comparison.mts`,
    which resolve their checkout from their own location and pass it in; its tests are in `src/objects/sphere-survey/`.
  - `objects/interpretation`: the observation interpreter the raster lane packs surfaces through (`createSurfaceInterpreter`
    picks each surface's decoder: solar synoptic maps, terrestrial, shape-model, stellar and static observations, the
    Akatsuki UVI Level 3b grid), with the solar geometry the host passes in. It imports `raster`, `objects/color`,
    `objects/geometry`, `objects/raster`, `objects/scene`, `objects/sources`, `objects/stellar` and the observation,
    shape-model and terrestrial layers. It is a topic of its own, outside `objects/layers/observation`, whose code the nebula
    lab's compiler identity reaches. Its moved tests are in `src/objects/interpretation/`; the solar-geometry adapter suites are in `../../src/platform/{equirectangular-illustration,interpret-source-verification}.test.mts`.
  - `objects/host-adapters`: what the authored preparation passes the scene and presentation compilers
    (`loadGeometryAdapters`, `presentationHostAdapters`), each bound to the solar geometry the host passes in. It imports
    `presentation`, `scene`, `objects/scene` and `objects/layers/terrestrial`.
  - `objects/layers/<kind>` (`terrestrial`, `giant`, `paged-ellipsoid`, `material-composition`, `cutaway`, `observed-surfaces`,
    `observation`, `shape-model`):
    the libraries each layer pipeline shares, one entry per kind. A layer imports the object topics and bake topics above and,
    as `LOWER_TOPICS` declares, another layer (`material-composition` → `giant` → `observed-surfaces`, and `material-composition` → `cutaway`). The cutaway
    material bake lives in `material-composition` (`cutaway-materials.ts`): it reads that topic's recipe checks, and only the
    layered-oblate preparation uses it, so `cutaway` stays the contract below both. `layered-oblate.ts` and
    `cutaway-materials.ts` moved over the 600-line limit and are exempt in `eslint.config.mts` until they are split, as is
    the paged-ellipsoid `assets.ts`. The material atlas tile writer, bilinear samplers and relative-path check live in `giant`
    (`material-atlas.ts`, `relative-path.ts`), below `material-composition`, so the giant material bake, layered
    presentation, object preparation (`object.ts`) and observed polar surfaces sit in `giant` without a topic cycle.  The
    layered-oblate object preparation is `material-composition`'s `object.ts`. Code that reads
    the generated solar geometry takes it as a parameter (`SolarGeometry`), as the scene topic does: the terrestrial pipeline
    entry (`terrestrial-layers.ts`) and solid scene (`solid-scene.ts`, which also reads each body's retained position source,
    `SolidSceneSolarGeometry`), the shape-model entry (`shape-model.ts`) and the paged-ellipsoid object (`object.ts`) take it
    from `site/build/prepare/prepare-authored.ts`, which loads the generated module. The paged-ellipsoid object also takes its
    asset worker, `packages/bake/cli/paged-ellipsoid-asset-worker.mts`, which loads the solar geometry itself. They reach the astronomy package through `astronomy`, the object runtime contract through
    `contract`, the depth-source restore through `prepared-presentation` and the content preparer's types through
    `objects/content`, as lower topics. Earth's MUR acquisition commands stay in `packages/bake/authoring/earth/`
    for its per-body authoring and read the MUR color table through `globe/mur-image.ts`; the mantle-tomography extraction script
    (`extract-tomography.py`) sits beside `tomography.ts`. The terrestrial commands that derive
    observer cameras, write Horizons tables, re-measure registration and write its README block are in `packages/bake/cli/`,
    with the band-alignment, camera-reference and L'LORRI overlap commands and the archived-camera Python that runs the
    camera reference beside it. A source manifest's `generator` names the
    code that makes an intermediate, such as the radial snapshot and PDS constraint map in this topic.
    Terrestrial keeps its radial terrain and materials in `radial/`, its solid rasters in `solid/`, and the
    surface-observation pipeline (formats, cameras, pixel geometry, photometry, footprints, surface transfer, registration) in
    `surface-observations/`, described in its README (its tests are in `src/objects/layers/terrestrial/surface-observations/`, its evidence in
    `evidence/photograph-pipeline/`, the OSIRIS shape comparison in `packages/bake/cli/osiris-shape-comparison.mts`); the paged-ellipsoid globe (`globe/`) holds its recipe context and its scene, split into the
    shared scene context, the sphere leaves, the cutaway interior and the atmosphere material bank.
  Body pipeline tests stay in `packages/bake/authoring/<body>/`; domain tests also live under
  `packages/bake/src/objects/<topic>/`. The moved terrestrial Node suites live in
  `packages/bake/src/objects/{cameras,geometry,raster,layers/terrestrial}/`. The source-surface
  test and independent Python verifier are in `packages/bake/src/objects/geometry/`, with the
  source-surface fixture in its `fixtures/` directory. Tests read body sources, kernel banks and
  oracle fixtures through test helpers and import the entries. Self-contained Node tests sit beside their modules
  (`objects/layers/paged-ellipsoid/*.test.ts`, `objects/layers/terrestrial/triangle-alpha-atlas.test.ts`,
  `objects/raster/observed/observed-geotiff.test.ts`); `pnpm test:packages` runs them with the rest of the package.
- `src/nebula/` is published as `@cssearth/bake/nebula` (Node only): the nebula delivery bake (delivery recipes and
  kinds, compact density, finite-emission and compiler deliveries, catalogue fields, star sprites, frames,
  render-element budgets). It imports `volume`, `volume-leaves`, `density` and `stars`. `packages/bake/cli/prepare-nebulae.mts` is its
  entry and records the prepared closure with the platform's inventory.
- The star, shell and density-volume bakes write into an object's own `prepared/` directory only with the host's
  inventory passed in (`inventory`, the platform's `inventoryPreparedAssets`); a scratch bake needs none. Their commands
  (`packages/bake/cli/prepare-stars.mts`, `prepare-shell.mts`, `prepare-volume.mts`, the last also `pnpm prepare:volume`
  and the telescope's F16 volume operation) pass `@cssearth/objects/node`'s.

- `src/volume/` is published as `@cssearth/bake/volume`: the implementation contracts, coordinates, fields, materials and
  sampling. Prepared recipes, slices, compiler controls, star inputs, catalogue stars, authored shapes, observation
  photo data and their pure validators live in `@cssearth/objects`; import them there, without bake re-exports.
  Cancellation, callable observation mapping, simulation sampling and emission types coupled to field implementations stay here. It stays host-neutral, for preparation callers: no Node built-ins, `Buffer`,
  DOM, React, Vite, `sharp`, PolyCSS, renderer imports or file paths, and it never imports `node/`.
- `src/volume/node/` is published as `@cssearth/bake/volume/node`: the compact-input replay, the XYZ slices, the
  compiler bake and the published catalogue point banks, with the galaxy groups' placement and the shell selection that
  keeps them first (`catalogue-groups.ts`). `catalogue-spheroid.ts` draws a sky catalogue's depths through a published spheroid, around the Sun in kpc or around an
  object in pc. `body-points.ts` builds a bank centred on a body from positions relative to it
  (a planet's moons without a page); `packages/bake/cli/prepare-body-points.mts <object-directory> <id>` is its command. It may import `node:*`, `sharp`, the main volume entry and the
  objects' catalogue bank codec (`@cssearth/objects`), which packs a bank as the page decodes it. The main entry never imports it; the Node-only
  topics above may, as a lower layer.

## Behaviour is part of the contract

Prepared volumes, nebula deliveries and the lab's accepted density bakes depend on exactly what this code returns.
Preserve arithmetic order, finite support, frames, units, spectral semantics, missing-data handling and historical
compatibility. A relocation must not change accepted pixels or relax a validator. Material color does not define
density: keep component-bound 3D material distinct from historical image-ray samplers, and never add an XY fallback to
the finite-emission compiler. Change an output only on purpose, together with every test and accepted bake that pins it.

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

The presentation schema identifier, narrowed material/selection records and leaf-box data shape live in
`@cssearth/objects`; leaf-box extraction and presentation compilation stay here. The presentation-envelope
validator remains here until its sky/Sun format dependencies can move without weakening validation.
