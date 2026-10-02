# Objects package instructions

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
exported through the browser-safe main entry. It also owns full world-context, world-camera frame and presentation contracts, system views, orbit centres and
JSON orbit data, and orbit-bank encoding, decoding and binary regions. Projection, navigation and spatial
preparation stay with their owners; never import renderer implementation here.
An object type describes supported behavior and data, not an individual planet.
Do not ship per-object configuration, generated payload modules, shell content, or renderer code here.
Keep one shared object contract; application discovery remains in the existing registry.
`src/registry/` holds that registry's shared contracts, exported from the main entry: the entry schema and catalogue
decoding (`defineObjects`, `catalogEntry`, `catalogueObject`), the discovery, distance, arrival, overview-level and package-fact parsers, the classification
categories, the fact order, the destination-name normalisation preparation and search share, the context color and
world-rotation validation. `site/objects.mts` stays the one `OBJECTS` registry: it binds these contracts to the shell's
scene loader. The registry here never loads a scene, reads a file or lists an object. Preparation reads that same
registry with `readPreparedObjects` (`src/node/prepared-registry.ts`): the prepared catalogue decoded with the same
contracts, without a scene loader. It is a read of the one registry, never a second list; keep it assembled as
`site/objects.mts` assembles `OBJECTS`. The catalogue is prepared from the object folders themselves: `readCatalog` and
`readContextObjects` (`src/node/catalog-directory.ts`) read the descriptors that opt into the catalogue and the context objects
without an entry, and `readOverviews` the ladder data an object's package authors under `properties.overview` when the object is a level of the zoom ladder (its zoom thresholds and framing, the classifications it holds, the context packages the world draws for it), refusing two levels with one order or one classification; the caller passes the navigation distance in (`prepareSceneDistance` in `@cssearth/bake/navigation`).
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
writer/reader conformance stays in `integration/renderer-bake/src/stars/`.

`src/prepared-data/` also owns the object runtime schema, controls and dataset metadata, the data-only runtime definition
and its JSON validators, deferred dataset transports, splitting and validated merging. Presentation, resource, material,
texture, camera, picking and feature-plan data needed by these validators live here; mounting, selection, projection,
resource loading and in-place dataset installation remain in renderer. Contract tests run in `pnpm test:packages`.

`src/prepared-data/` owns the presentation schema identifier, narrowed prepared material/selection records,
serialized pose keyframes and leaf bounds validation. Frustum computation, DOM animation and CSS publication
stay in renderer; leaf-box extraction stays in bake and imports the shared record. Leaf bounds contract tests
run in the packages lane; writer/frustum conformance remains in `integration/renderer-bake/`.
Prepared CSS sky, parallax, cubic-sky and directional-Sun contracts and validators live in `src/prepared-data/`,
exported by the main entry. Sky/Sun validators default to the historical authored bake acceptance and diagnostics. The single 'runtime' policy
opts into runtime checks; there are no independent validation flags.
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
