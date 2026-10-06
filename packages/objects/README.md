# @cssearth/objects

Shared JSON parsing, validation, object capabilities, and preparation contracts.

`parseAuthoredObjectDescriptor()` is the authored-data boundary for migrated
objects. It returns a typed `recipe` composed from declared source references,
shape, surfaces and datasets, materials, frame banks, optional layers and motion,
plus bounded paging or destination plans. Preparation adapters consume those
capabilities; this package does not choose a renderer or execute object tools.

The registry contracts (`src/registry/`) are what the application's one `OBJECTS` registry (`site/objects.mts`) and the
preparation tools share: `defineObjects()`, `catalogEntry()` and `catalogueObject()` assemble and decode entries (`catalogueObject()` decodes one
entry of the prepared catalogue, as the registry and a page's object directory both read it), `parseObjectDiscovery()`,
`parseNavigationDistance()`, `parseArrivalView()` and `definePreparedFocus()` validate the prepared registry data,
`orderFacts()` orders factsheets, `normalizeDestinationQuery()` is the name normalisation preparation writes and search
reads, `contextColor()` picks a body's world-context color, and `validateWorldRotation()` checks a rotation. The host
binds `loadScene` to its own scene type; the site's client build compiles these modules from source, one module each.
Preparation reads the same registry through `readPreparedObjects(root)` in `@cssearth/objects/node`: it decodes the
prepared catalogue `prepare:catalog` writes (`PREPARED_CATALOGUE`: `site/prepared/prepared-catalogue.mjs`, every scene object's
descriptor with its distance and discovery and every prepared focus in registry order, written by
`preparedCatalogueModule()`) with these contracts and binds a `loadScene` that refuses to mount, so a preparer that lists objects through it does not import the application. A site
test (run in the universe runtime lane) holds both reads equal.

`parseDensityVolumeObjectDescriptor()` validates density-volume objects with a
physical frame, bounds, and declared preparation source. Volume images, concrete
sampling, and compiled renderer leaves remain outside this package. Physical slice data and its validation live here.

`parseImageLayerBankDescriptor()` uses the same physical-frame contract for
spatial models reconstructed from observations. Its type distinguishes prepared
image layers from measured density grids; concrete imagery, depth assumptions
and compiled rendering leaves stay with the object and preparation adapter.

`@cssearth/objects/sources` is the source catalogue: its records, citations and
bindings and the validators every one passes. It stays browser-safe, because the
application reads the catalogue with it. `@cssearth/objects/provenance` is the second
browser-safe entry: the in-memory object lineage (which manifest sources each prepared
product reads) and its product-input evidence, the exploration catalogue with its contribution graph and prepared
form, source usage and prepared sources, and context availability. Preparation writes these
records and the application reads them, so both import the same validators; its tests are in
the repository's `packages/objects/src/provenance/`. The entry also exports the canonical dataset destinations
and `DATASET_ROUTES`, shared by the application and preparation. Compilers and parsers take
`DatasetRoutes`, so a host can supply another routing policy. `@cssearth/objects/node`
is the Node-only entry for source manifests (their validation, coverage and byte-range
checks and the portable relative-path rule their entries follow), for preparation's read of
the registry and for the runtime asset closure: each object's `inventory.json` of baked
files, which the bake writes, `setup:assets` restores and the build assembles (tests in
`packages/objects/src/node/`). Nothing else in the package imports it. The manifests themselves stay beside each body.
`@cssearth/objects/node/contract` is a second Node-only entry: the helpers tests use to
check an object against its contract (its final prepared definition, read from
`src/objects/<id>/prepared/runtime.json`, and fixture values required before a test
inspects them).
`@cssearth/objects/node/source-test` is the public Node-only test API for restored source inputs across packages, labs, site and CI; `node/contract` provides fixtures and loaders and also exports this support.

```text
packages/objects/
├── src/           Generic TypeScript implementation and tests
│   ├── sources/   Source catalogue (`@cssearth/objects/sources`)
│   ├── provenance/ Provenance, exploration and source-usage records (`@cssearth/objects/provenance`)
│   └── node/      Source manifests, the prepared registry read and the runtime asset closure (`@cssearth/objects/node`, Node only)
│       ├── contract/ Object test helpers (`@cssearth/objects/node/contract`, Node only)
│       └── source-test.ts Public restored-source test API (`@cssearth/objects/node/source-test`, Node only)
├── AGENTS.md      Package boundaries
└── CLAUDE.md      Symlink to AGENTS.md
```

ESM, CommonJS, and declarations are built with tsup, matching astronomy and catalog.
Source files, tests, tools, and generated TypeScript must stay at or below 600
physical lines. `pnpm lint:packages` enforces this, including comments and blanks.

From the repository root:

```sh
pnpm install
pnpm build:packages
pnpm typecheck:packages
pnpm lint:packages
pnpm test:packages
```

Object JSON descriptors and generated assets live outside packages. Mercury and
Venus share implementations selected by capabilities; packages contain no
per-planet code or data folders. Concrete CSS/DOM rendering belongs to the
application renderer. Earth is a future consumer, outside this migration's scope.

Prepared volume scene contracts and their pure validators/helpers live in `src/volume/`, exported by `@cssearth/objects`. This includes volume and sampled recipes, emission-fit settings, slice data and layer validation, compiler controls and star inputs, joint parameters, authored shape settings, observation photo data, observation mappings, simulation depth-prior and structural cancellation interfaces, and prepared catalogue stars. Writers and readers import the same contracts here. Baking, fitting, sampling, cancellation and I/O remain in `@cssearth/bake`.

The browser-safe main entry exports `PREPARED_CSS_OBJECT_FORMAT`, `expandWorldContextSummary()` and
`expandWorldSystem()` from `src/prepared-data/`. The decoders expand compact body columns, shared tables,
billboards and orbit centres before validation. Full world-context validation, world-camera frame and presentation data, system views, orbit centres and
orbit-bank codecs live here too. JSON orbit arrays (`PreparedWorldContextData`) and decoded typed arrays
(`PreparedWorldContextGeometry`) have distinct contracts. Projection, navigation and spatial preparation
stay with their owners.

`src/prepared-bank.ts` owns the one container of the prepared data files a page fetches (magic `CSBANK01`): a JSON header
and named typed columns, packed by `prepared-binary.ts`. A new data file is a bank on this codec, never a layout of its own.
`src/prepared-data/catalogue/catalogue-bank-binary.ts` owns the catalogue point bank's columns and position scale on that container;
`catalogue-point-columns.ts` owns the form the page holds (columns, no object for a point) and its checks, and
`catalogue-dots.ts` the galaxy catalogue's dots as the page draws them.
`src/volume/delivery/volume-dataset-bank-files.ts` owns how a volume dataset bank is stored: an index, one volume a dataset, its
stars once as columns and a record of provenance; `src/node/volume-dataset-bank.ts` writes and reads those files.
`src/stars/` owns point-field data/manifest schemas, bank layout, quantization, decoding and validation,
exported through the browser-safe main entry. Hierarchy construction and encoding star rows remain in bake;
loading, selection and projection remain with their runtime owners. Contract tests run in the packages lane;
writer and reader tests live beside their producing bake and consuming renderer modules.

`src/prepared-data/` also owns the object runtime schema, controls and dataset metadata, the data-only runtime definition
and its JSON validators, deferred dataset transports, splitting and validated merging. Presentation, resource, material,
texture, camera, picking and feature-plan data needed by these validators live here; mounting, selection, projection,
resource loading and in-place dataset installation remain in renderer. Contract tests run in `pnpm test:packages`.

`src/prepared-data/` owns the presentation schema identifier, narrowed prepared material/selection records,
serialized pose keyframes and leaf bounds validation. Frustum computation, DOM animation and CSS publication
stay in renderer; leaf-box extraction stays in bake and imports the shared record. Leaf bounds contract tests
run in the packages lane; bake output and renderer frustum tests live beside their respective modules.
Prepared CSS sky, parallax, cubic-sky and directional-Sun contracts and validators live in `src/prepared-data/`,
exported by the main entry. Runtime and authored preparation validation retain their boundary policies and diagnostics.
Sky/Sun authored standards and direction computation stay with bake and renderer.
Bake retains the authored presentation-envelope checks: runtime validation is stricter in several fields and cannot
replace them without changing accepted authored input.

Prepared CSS volumes, impostors, volume datasets, embedded catalogue points and image-layer banks live in
`src/volume/`; surface-shell data and validation live in `src/prepared-data/`. Their schema and envelope identifiers,
pure validators, catalogue geometry/frame comparisons and shell atlas corner convention are exported from the
browser-safe main entry. Image generation, transport, projection, compositing, volume topology comparisons and
retained mounting stay with their implementation owners.
Contract tests use node:test and run in the packages lane.

Universe catalogue point banks, galaxy backings, image meshes and dataset billboards have browser-safe
format contracts and schema identifiers in `packages/objects/src/prepared-data/`, exported by `@cssearth/objects`.
The complete catalogue bank is `PreparedCataloguePointBank`; embedded volume stars keep `PreparedCataloguePoints`.
Counting, projection, transport and retained mounting stay in renderer; image/geometry preparation and file I/O stay in bake.
Contract tests use node:test in the packages lane.

Spatial catalogue and surface-feature formats live in `src/prepared-data/`, exported by `@cssearth/objects`.
Their contract tests run with `pnpm test:packages`. Scientific classification and citation interpretation stay in catalog;
sampling and geometry stay in bake; transport and label mounting stay in renderer.

Retained emission fields, photometric envelopes/colors and MGE recipes, emission windows, simulation-envelope
settings/records, dataset tone curves, compact compiler/sampled/symmetry/finite-emission inputs and component
material receipts live in `src/volume/`, alongside the cloud-parts catalogue. Their schema identifiers, pure
parsers and little-endian compact color/emission decoders are exported through `@cssearth/objects`. Sampling,
fitting, selection, decompression, compilation and file I/O stay with bake, reconstruction, lab and volume-viewer.
Contract tests use node:test in the packages lane; replay and selection conformance stay with their owners.

Preparation and runtime share canonical resource addresses/pools and image density, tile leaf styles/keys, interior-disc size, shell material addresses, marker/control validation, feature-bank hashing, point luminance threshold, CSS compiler budget and volume topology equality through the browser-safe main entry. Numeric camera and solar geometry live in `@cssearth/engine`.

`@cssearth/objects` depends only on core and owns formats, parsers, validators and codecs.
Shared rotation/reflection validation lives in core. Presentation-to-world conversion, camera pose/viewport
interfaces, default-view rotation, silhouette walking and surface fly-to calibration live in engine navigation.
Callers validate camera records with `requireCamera` before passing plain calibration values to engine.
Runtime viewport/layout and presentation projection stay in renderer.

`parsePreparedDensityVolume` validates the prepared envelope, identity and authored physical frame without transport. Bake, telescope F16 and renderer share it; filesystem/fetch transport stays with callers. Its node:test suite runs in the packages lane.

Shared prepared schema literals are enforced by the hard architecture ownership rule; see
[prepared format ownership](../../docs/prepared-format-ownership.md) for the computed owner rule, schema/owner exceptions and migration limits.

Schema identifiers are exported from their format owners, including the browser-safe source-manifest identifier.
Writers and readers import these constants; the pre-build body-reference check and preserved Python authoring
keep conformance-tested source-manifest, archived-camera and object-text spellings in the schema exception ledger.

Archived-camera data (including `SpiceCamera`), cited object/prepared-text records and prepared destinations
are browser-safe contracts in `packages/objects/src/prepared-data/`, exported from `@cssearth/objects`.
Their node:test suites run in the packages lane. Camera fitting and kernel computation stay with bake/SPICE;
text budgets and editorial checks stay in site; destination preparation and search projection stay with bake/site.

Authored preparation receipts, world-navigation preparation receipts and prepared feature descriptors live in
`packages/objects/src/prepared-data/`, exported through the browser-safe objects main entry.
Historical source-list and index/pre-build admission policies retain their accepted records and diagnostics.
Frame/source auditing, camera solving, geometry, file I/O and inventory lookup stay with bake/site/tooling.
Contract tests use node:test in the packages CI lane.

See the [shared source-format ownership contract](AGENTS.md) for WISE pins, rotation records and published limb coefficients.
Limb intensity lives in [core](../core/src/math/limb-intensity.ts).

Disc-integrated and stellar photometric color records, uniform-disc star measurements, and measured-spectrum
measurement documents live in `src/prepared-data/`, exported through the browser-safe main entry.
Their parsers preserve separate compiler/public-photometry admission and mode-dependent absent-wavelength policies.
CIE/Planck evaluation, spectrum file loading, binning, sphere generation and chart rendering remain in bake/telescope-cli.
Contract tests use node:test in the packages lane; scientific and file-output conformance stays with the consumers.

Authored density placement and observed stellar catalogue wire types, schema identifiers and pure parsers live in
`src/volume/`, exported by `@cssearth/objects`. Envelope admission is separate from stellar-row parsing to preserve
caller validation order. Transforms, fitting, projection, display selection and file I/O stay with bake/reconstruction/lab.
Contract tests use node:test in the packages lane.

Saved CSS camera snapshots (`CameraPose`), their schema identifier and pure matrix admission live in
`src/prepared-data/camera/camera-pose.ts`, exported through the browser-safe main entry. Share links retain
bounded proper-rotation validation; live restore retains finite-matrix admission before renderer projects
it to a rotation. DOMMatrix, camera controls and URL/base64 transport stay in renderer. Contract tests
use node:test in the packages lane.

Authored object-content recipes, prepared panel content and facility emblem-library records have browser-safe
contracts in `src/prepared-data/`, exported through `@cssearth/objects`. Source envelope admission, authored dataset
metadata and panel field parsing preserve caller diagnostics. Asset production, editorial checks, Astro adapters,
source binding resolution and image byte inspection stay in bake/site. Contract tests use node:test in the packages lane.

- Astronomy published-orbit/epoch, solar-system preparation, investigation-ledger and acquisition-plan schema identifiers live in `src/prepared-data/`; physical scene source/unit reads, acquisition and investigation parsers are shared. Scientific evaluation, survey expansion, Node containment, DSK validation and acquisition execution stay with their owners; host callbacks preserve admission order.
- Authored CSS presentation profiles and their pure parser belong to objects; compilation stays with bake.
- CSS geometry profiles, surface geometry/seam-outset data and the pure profile parser belong to objects; scene validation and generation stay with bake.
- Navigation marker recipe identifiers and wire types belong to objects; image/source validation and preparation stay with bake.
- Paged ellipsoid recipes, authored camera fields and pure parsers belong to objects. Full assets and navigation field reads retain separate admission policies; camera derivation and asset preparation stay with bake/site.
- Chart asset recipes and nested spectrum, measured-spectrum, retrieved-profile and system-orbits parsers belong to objects. Envelope/source spectrum admission stays distinct; rendering, source sampling and Node file paths stay with consumers.
- Volume dataset manifest identifiers live in `src/volume/delivery/volume-dataset-manifest.ts`; output selection and byte checks stay with bake/lab.
- Compact density delivery identifiers live in `src/volume/compact/compact-density-delivery.ts`; replay and source-owner admission stay with bake/lab.
- Nebula depth-model identifiers and `DepthRecipe`/`DepthSurface` wire types and the pure recipe parser live in `src/volume/nebula/nebula-depth-model.ts`; the caller supplies joint-path admission, while evidence policy and sampling stay with reconstruction/lab.
- Gaia nebula-field types and the pure parser live in `src/volume/nebula/gaia-nebula-field.ts`; explicit catalogue-selection and astrometry-table subsets preserve their historical admission and diagnostics. Projection, scientific admission, selection and file I/O stay with bake/telescope-cli.
- Nebula delivery identifiers, sky-frame data and pure envelope admission live in `src/volume/nebula/nebula-delivery.ts`; transport and compilation stay with bake/telescope-cli/lab.
- Circumstellar reconstruction identifiers, reconstruction records and opacity data live in `src/volume/nebula/circumstellar-reconstruction.ts`; opacity computation, reconstruction and historical file admission stay with lab/telescope-cli.
- UVFITS request/response types and pure validation live in `src/prepared-data/source/pyuvdata-uvfits.ts`; process and toolchain handling stay in telescope.
- Volume source-manifest envelope admission and context records live in `src/prepared-data/source/volume-source-manifest.ts`; manifest I/O, restoration and lineage stay with callers.
- Volume presentation-source identifiers, preview parsing and pure preview/dataset/presentation records live in `src/prepared-data/source/volume-presentation-source.ts`; preview creation and dataset text validation stay with callers.

Published mutual-orbit and body-epoch structures and pure decoding live in `src/prepared-data/orbit/published-orbit.ts`;
scientific evaluation and source I/O stay in astronomy. Product records and their evidence kinds/parser live in
`src/prepared-data/source/telescope-product.ts`; run identity, product paths and evidence queries stay in telescope.
VO metadata, pin, region and snapshot data/parsers live in `src/prepared-data/source/vo-discovery.ts`, using core JSON data;
archive operations, network transport, ADQL generation and row identity queries stay with telescope owners.

Body-map products, resolution evidence, raster recipes and limb-model references have browser-safe
contracts and parsers in `src/prepared-data/`, exported through `@cssearth/objects`.
The parsers require owner-supplied surface-resolution and lighting-bank resolvers at the historical
validation position. Bake supplies them through `readBodyMapProduct` and `readRasterRecipe`;
angular-to-surface conversion, sampled map combination, lighting banks and photometric evaluation stay in bake.
Contract and duplicate-ownership tests use node:test beside the formats.

`readMapSphereDatasetPreviews` admits the historical map-sphere dataset schema and validates only preview identities and image addresses; bake and site use it.

The site build reader rule follows lexical JSON.parse aliases, destructuring and literal
`JSON['parse']` access. Paths come from tracked schema records and the reader ledger
(including untracked map-sphere `prepared/datasets.json`). It follows local path aliases
and literal template substitutions. It does not resolve arbitrary filename computation,
cross-module file transports, dynamic JSON method keys or reassigned parser aliases;
those reads require manual review. This is a bounded static check, not complete data-flow proof.

`@cssearth/objects/archived-camera` provides the archived camera schema, parsers and camera types without importing the full objects entry. Browser-safe codec sources type-check with ES libraries and Node's host-compatible encoding globals; the main entry imports no Node runtime modules.
