# @cssearth/objects

Shared JSON parsing, validation, object capabilities, and preparation contracts.

The same surface geometry, polar sampling, coverage completion, atmosphere,
lighting, and interior pixel operators serve every compatible object. Inputs
are numbers, pixels, and validated recipes; outputs contain no DOM or CSS.
Node file/image I/O and CSS projection are separate application adapters.

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
reads, `contextColour()` picks a body's world-context colour, and `validateWorldRotation()` checks a rotation. The host
binds `loadScene` to its own scene type; the site's client build compiles these modules from source, one module each.
Preparation reads the same registry through `readPreparedObjects(root)` in `@cssearth/objects/node`: it decodes the
prepared catalogue `prepare:catalog` writes (`PREPARED_CATALOGUE`: `site/prepared-catalogue.mjs`, every scene object's
descriptor with its distance and discovery and every prepared focus in registry order, written by
`preparedCatalogueModule()`, and the rows of the objects that are levels of the zoom ladder again in `site/prepared-overview-objects.json`, the one part every page's
object directory reads) with these contracts and binds a `loadScene` that refuses to mount, so a preparer that lists objects through it does not import the application. A site
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
`@cssearth/objects/node/source-test` is the Node-only test helper for restored object source inputs.

```text
packages/objects/
├── src/           Generic TypeScript implementation and tests
│   ├── sources/   Source catalogue (`@cssearth/objects/sources`)
│   ├── provenance/ Provenance, exploration and source-usage records (`@cssearth/objects/provenance`)
│   └── node/      Source manifests, the prepared registry read and the runtime asset closure (`@cssearth/objects/node`, Node only)
│       ├── contract/ Object test helpers (`@cssearth/objects/node/contract`, Node only)
│       └── source-test.ts Restored source test helper (`@cssearth/objects/node/source-test`, Node only)
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

Prepared volume scene contracts and their pure validators/helpers live in `src/volume/`, exported by `@cssearth/objects`. This includes volume and sampled recipes, emission-fit settings, slice data and layer validation, compiler controls and star inputs, joint parameters, authored shape settings, observation photo data and prepared catalogue stars. Writers and readers import the same contracts here. Baking, fitting, sampling, cancellation and I/O remain in `@cssearth/bake`.

The browser-safe main entry exports `PREPARED_CSS_OBJECT_FORMAT`, `expandWorldContextSummary()` and
`expandWorldSystem()` from `src/prepared-data/`. The decoders expand compact body columns, shared tables,
billboards and orbit centres before validation. Full world-context validation still lives in the renderer,
where its shared geometry parser depends on camera/projection implementation.
