# Objects package instructions

## What may live here

- **Allowed:** format types, schema-id constants, parsers, validators, binary encoders and decoders, and their fixtures.
- **Not allowed:** algorithms that compute from the data: camera or navigation math, level or hysteresis walkers, geometry derivation, projection, sampling and fitting. They belong in `engine` (camera and navigation) or the owning package.
- **Quick test:** if a function does more than read, check or (de)serialize a format, it does not belong here.
- `objects` imports `@cssearth/core` only; the `objects-imports-core-only` architecture rule enforces it.

Own the shared object JSON parser, validation, reusable object types, and preparation contracts.
Own the source catalogue (`src/sources/`, browser-safe), the provenance, exploration and source-usage records the
application reads and preparation writes (`src/provenance/`, the browser-safe `@cssearth/objects/provenance` entry; the
canonical dataset destinations live here; compilers accept `DatasetRoutes` for host-supplied routing), the
source-manifest format, preparation's read of the registry and the runtime asset closure that owns each object's
inventory (`src/node/`, the Node-only `@cssearth/objects/node` entry); the main, `sources` and `provenance` entries never
import `node/`.
`src/node/contract/` is the Node-only `@cssearth/objects/node/contract` entry: the helpers tests use to check an object
against its contract (its final prepared definition, and fixture values required before a test inspects them).
`src/node/source-test.ts` is the Node-only `@cssearth/objects/node/source-test` entry for tests that need restored object sources.
`src/volume/` holds browser-safe prepared compiler/joint/shape scene contracts, density-filter helpers,
layer-plan/report readers and render-element budgets; exported through the main entry. It also owns the data-only
volume and sampled recipes, emission-fit settings, physical slice formats and validation, compiler controls and star
inputs, joint parameters, authored shape settings, observation photo data and mappings, simulation depth-prior and
structural cancellation interfaces, and prepared catalogue stars. Writers and readers import these from
`@cssearth/objects`; sampling, fitting, cancellation handling and file I/O remain outside this area.
`src/prepared-data/` owns the prepared CSS object format identifier and compact world-summary/system table decoders,
exported through the browser-safe main entry. It also owns the data shapes of the full world-context, world-camera frame and presentation records, system views, orbit centres and
JSON orbit data, and orbit-bank encoding, decoding and binary regions. Projection, navigation and spatial
preparation stay with their owners; never import renderer implementation here.
An object type describes supported behavior and data, not an individual planet.
Do not ship per-object configuration, generated payload modules, shell content, or renderer code here.
Keep one shared object contract; application discovery remains in the existing registry.
`src/registry/` holds that registry's shared contracts, exported from the main entry: the entry schema and catalogue
decoding (`defineObjects`, `catalogEntry`, `catalogueObject`), the object tree (`checkObjectTree`: every object names the one object it is inside, the Observable Universe is the root), the discovery, distance, arrival, zoom and package-fact parsers, the classification
categories, the fact order, the destination-name normalisation preparation and search share, the context color and
world-rotation validation from core. `site/objects.mts` stays the one `OBJECTS` registry: it binds these contracts to the shell's
scene loader. The registry here never loads a scene, reads a file or lists an object. Preparation reads that same
registry with `readPreparedObjects` (`src/node/prepared-registry.ts`): the prepared catalogue decoded with the same
contracts, without a scene loader. It is a read of the one registry, never a second list; keep it assembled as
`site/objects.mts` assembles `OBJECTS`. The catalogue is prepared from the object folders themselves: `readCatalog` and
`readContextObjects` (`src/node/catalog-directory.ts`) read the descriptors that opt into the catalogue and the context objects
without an entry, with the objects seen from inside (`properties.zoom`), whose scene is the world around a star; the caller passes the navigation distance in (`prepareSceneDistance` in `@cssearth/bake/navigation`).
Preparation must remain reproducible from source inputs and provenance outside packages.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs.
- Keep object JSON, source inputs/manifests, licences, required notices, provenance, and prepared payloads outside packages.
- Shared parsers validate versioned JSON into reusable object types and capability data.
- Objects using the same capabilities use the same implementation and differ through their JSON.
- Preparation and rendering use explicit interfaces; concrete renderer implementations live outside packages.
- Capabilities must compose so complex objects can add prepared layers or paging without planet-specific forks.
- The shared scene and navigation contract covers every prepared object and future object type, independently of navigation-menu membership.
- Scientific reference tables belong to astronomy/catalog; object presentation customizations do not.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility; keep bulk prepared data outside source code.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.

`src/prepared-data/catalogue-bank-binary.ts` owns the catalogue bank magic, position scale and binary codec.
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
exported by the main entry. Sky/Sun validators default to the historical authored bake acceptance and diagnostics. The single 'runtime' policy
opts into runtime checks; there are no independent validation flags.
Sky/Sun authored standards and direction computation stay with bake and renderer.
Bake retains the authored presentation-envelope checks: runtime validation is stricter in several fields and cannot
replace them without changing accepted authored input.

Prepared CSS volumes, impostors, volume datasets, embedded catalogue points and image-layer banks live in
`src/volume/`; surface-shell data and validation live in `src/prepared-data/`. Their schema and envelope identifiers,
pure validators, catalogue geometry/frame comparisons and shell atlas corner convention are exported from the
browser-safe main entry. Image generation, transport, projection, compositing, retained mounting stay with their implementation owners.
Contract tests use node:test and run in the packages lane.

Universe catalogue point banks, galaxy backings, image meshes and dataset billboards have browser-safe
format contracts and schema identifiers in `packages/objects/src/prepared-data/`, exported by `@cssearth/objects`.
The complete catalogue bank is `PreparedCataloguePointBank`; embedded volume stars keep `PreparedCataloguePoints`.
Counting, projection, transport and retained mounting stay in renderer; image/geometry preparation and file I/O stay in bake.
Contract tests use node:test in the packages lane.

Spatial galaxy, cluster and nebula delivery records, schema identifiers, parsers, galaxy display samples and prepared
position/host validation live in `src/prepared-data/`. Distance-subject records also live here; objects never imports
catalog. Scientific classification and citation interpretation stay in catalog, which imports the format contracts.
Surface-feature wire records, normalized reader projections and catalogue parsing also live in `src/prepared-data/`;
feature geometry, sampling, file I/O, transport and label mounting remain with bake and renderer.
Contract tests use node:test in the packages lane.

Retained emission fields, photometric envelopes/colors and MGE recipes, emission windows, simulation-envelope
settings/records, dataset tone curves, compact compiler/sampled/symmetry/finite-emission inputs and component
material receipts live in `src/volume/`, alongside the cloud-parts catalogue. Their schema identifiers, pure
parsers and little-endian compact color/emission decoders are exported through `@cssearth/objects`. Sampling,
fitting, selection, decompression, compilation and file I/O stay with bake, reconstruction, lab and volume-viewer.
Contract tests use node:test in the packages lane; replay and selection conformance stay with their owners.

`src/prepared-data/` also owns canonical image density/resource addresses and pools, tile leaf styles and keys, interior-disc size, shell material addresses, marker and shell-control validation, feature-bank hashing. `src/stars/` owns the luminance threshold; `src/volume/` owns the CSS compiler budget and pure topology equality. Numeric camera orientation and solar geometry belong to engine.

`@cssearth/objects` depends only on core and owns formats, parsers, validators and codecs.
Shared rotation/reflection validation lives in core. Presentation-to-world conversion, camera pose/viewport
interfaces, default-view rotation, silhouette walking and surface fly-to calibration live in engine navigation.
Callers validate camera records with `requireCamera` before passing plain calibration values to engine.
Runtime viewport/layout and presentation projection stay in renderer.

`parsePreparedDensityVolume` validates the prepared envelope, identity and authored physical frame without transport. Bake, telescope F16 and renderer share it; filesystem/fetch transport stays with callers. Its node:test suite runs in the packages lane.

Shared prepared schema literals are enforced by the hard `format-schema-ownership` architecture rule.
Only shared-schema debt has schema/owner exceptions; owner-internal formats need no entry. Exceptions live in `.github/scripts/architecture/format-schema-exceptions.json`; stale entries fail.

Schema identifiers are exported from their format owners, including the browser-safe source-manifest identifier.
Writers and readers import these constants; the pre-build body-reference check and preserved Python authoring
keep conformance-tested source-manifest, archived-camera and object-text spellings in the schema exception ledger.

Archived-camera data (including `SpiceCamera`), cited object/prepared-text records and prepared destinations
are browser-safe contracts in `packages/objects/src/prepared-data/`, exported from `@cssearth/objects`.
Their node:test suites run in the packages lane. Camera fitting and kernel computation stay with bake/SPICE;
text budgets and editorial checks stay in site; destination preparation and search projection stay with bake/site.

Bake-only recipe routing identifiers and lab-only molecular catalogue envelopes stay with their owners.
Preserved Python audit/native protocols retain narrow, conformance-tested schema exceptions; scientific code stays outside objects.

Authored preparation receipts, world-navigation preparation receipts and prepared feature descriptors live in
`packages/objects/src/prepared-data/`, exported through the browser-safe objects main entry.
Historical source-list and index/pre-build admission policies retain their accepted records and diagnostics.
Frame/source auditing, camera solving, geometry, file I/O and inventory lookup stay with bake/site/tooling.
Contract tests use node:test in the packages CI lane.

WISE tile pins, authored display/synchronous rotation records and cited published limb coefficients have
browser-safe schema identifiers, data types and pure validation in `packages/objects/src/prepared-data/`.
Contract tests use node:test in the packages lane. WISE photometry, FITS/mosaicking, orbit/rotation evaluation,
model-grid interpolation and file I/O remain with their scientific owners. Limb intensity lives in
`packages/core/src/math/limb-intensity.ts`. The preserved
Python display-orientation writer has a literal conformance test and a specific schema-ledger exception.

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
`src/prepared-data/camera-pose.ts`, exported through the browser-safe main entry. Share links retain
bounded proper-rotation validation; live restore retains finite-matrix admission before renderer projects
it to a rotation. DOMMatrix, camera controls and URL/base64 transport stay in renderer. Contract tests
use node:test in the packages lane.

Authored object-content recipes, prepared panel content and facility emblem-library records have browser-safe
contracts in `src/prepared-data/`, exported through `@cssearth/objects`. Source envelope admission, authored dataset
metadata and panel field parsing preserve caller diagnostics. Asset production, editorial checks, Astro adapters,
source binding resolution and image byte inspection stay in bake/site. Contract tests use node:test in the packages lane.

Astronomy published-orbit/epoch, solar-system preparation, investigation-ledger and acquisition-plan schema identifiers live in `src/prepared-data/`; acquisition operations and investigation entry types are shared, while scientific evaluation, survey expansion and acquisition validation/execution stay with their owners.
Authored CSS presentation profiles and their pure parser belong to objects; compilation stays with bake.
CSS geometry profile identifiers belong to objects; scene validation and generation stay with bake.
Navigation marker recipe identifiers and wire types belong to objects; image/source validation and preparation stay with bake.
Paged ellipsoid recipe identifiers belong to objects; camera derivation and asset preparation stay with bake/site.
Chart asset recipe identifiers belong to objects; nested chart validation, rendering and file I/O stay with their consumers.
Volume dataset manifest identifiers live in `src/volume/volume-dataset-manifest.ts`; output selection and byte checks stay with bake/lab.
Compact density delivery identifiers live in `src/volume/compact-density-delivery.ts`; replay and source-owner admission stay with bake/lab.
Nebula depth-model identifiers and `DepthRecipe`/`DepthSurface` wire types live in `src/volume/nebula-depth-model.ts`; joint-path admission, evidence policy and sampling stay with reconstruction/lab.
Gaia nebula-field types and the pure parser live in `src/volume/gaia-nebula-field.ts`; explicit catalogue-selection and astrometry-table subsets preserve their historical admission and diagnostics. Projection, scientific admission, selection and file I/O stay with bake/telescope-cli.
Nebula delivery identifiers, sky-frame data and pure envelope admission live in `src/volume/nebula-delivery.ts`; transport and compilation stay with bake/telescope-cli/lab.
Circumstellar reconstruction identifiers, reconstruction records and opacity data live in `src/volume/circumstellar-reconstruction.ts`; opacity computation, reconstruction and historical file admission stay with lab/telescope-cli.
UVFITS request/response types and pure validation live in `src/prepared-data/pyuvdata-uvfits.ts`; process and toolchain handling stay in telescope.
Volume source-manifest envelope admission and context records live in `src/prepared-data/volume-source-manifest.ts`; manifest I/O, restoration and lineage stay with callers.
Volume presentation-source identifiers, preview parsing and pure preview/dataset/presentation records live in `src/prepared-data/volume-presentation-source.ts`; preview creation and dataset text validation stay with callers.

Published mutual-orbit and body-epoch structures and pure decoding live in `src/prepared-data/published-orbit.ts`;
scientific evaluation and source I/O stay in astronomy. Product records and their evidence kinds/parser live in
`src/prepared-data/telescope-product.ts`; run identity, product paths and evidence queries stay in telescope.
VO metadata, pin, region and snapshot data/parsers live in `src/prepared-data/vo-discovery.ts`, using core JSON data;
archive operations, network transport, ADQL generation and row identity queries stay with telescope owners.

Body-map products, resolution evidence, raster recipes and limb-model references have browser-safe
contracts and parsers in `src/prepared-data/`, exported through `@cssearth/objects`.
The parsers require owner-supplied surface-resolution and lighting-bank resolvers at the historical
validation position. Bake supplies them through `readBodyMapProduct` and `readRasterRecipe`;
angular-to-surface conversion, sampled map combination, lighting banks and photometric evaluation stay in bake.
Contract and duplicate-ownership tests use node:test beside the formats.
