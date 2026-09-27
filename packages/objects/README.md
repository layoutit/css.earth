# @cssearth/objects

Shared JSON parsing, validation, object capabilities, and preparation contracts.

The same surface geometry, polar sampling, coverage completion, atmosphere,
lighting, and interior pixel operators serve every compatible object. Inputs
are numbers, pixels, and validated recipes; outputs contain no DOM or CSS.
Node file/image I/O and CSS projection are separate application adapters.

`parseAuthoredObjectDescriptor()` is the authored-data boundary for migrated
objects. It returns a typed `recipe` composed from pinned source references,
shape, surfaces and lenses, materials, frame banks, optional layers and motion,
plus bounded paging or destination plans. Preparation adapters consume those
capabilities; this package does not choose a renderer or execute object tools.

The registry contracts (`src/registry/`) are what the application's one `OBJECTS` registry (`site/objects.mts`) and the
preparation tools share: `defineObjects()` and `catalogEntry()` assemble and decode entries, `parseObjectDiscovery()`,
`parseNavigationDistance()`, `parseArrivalView()` and `definePreparedFocus()` validate the prepared registry data,
`orderFacts()` orders factsheets, `normalizeDestinationQuery()` is the name normalisation preparation writes and search
reads, `contextColour()` picks a body's world-context colour, and `validateWorldRotation()` checks a rotation. The host
binds `loadScene` to its own scene type; the site's client build compiles these modules from source, one module each.
Preparation reads the same registry through `readPreparedObjects(root)` in `@cssearth/objects/node`: it decodes the
prepared catalogue `prepare:catalog` writes (`PREPARED_CATALOGUE`, in catalogue order) with these contracts and binds a
`loadScene` that refuses to mount, so a preparer that lists objects through it does not import the application. A site
test (run in the universe runtime lane) holds both reads equal. Some preparation code still imports `site/objects.mts`:
`tools/cli/run-implemented-objects.mts`, `tools/prepare/prepare-arrival-billboard.mts` and the object-runtime ownership
check. They move to this reader, or out of preparation, in later slices.

`parseDensityVolumeObjectDescriptor()` validates density-volume objects with a
physical frame, bounds, and pinned preparation source. Volume images, concrete
sampling, and renderer-specific slice geometry remain outside this package.

`parseImageLayerBankDescriptor()` uses the same physical-frame contract for
spatial models reconstructed from observations. Its type distinguishes prepared
image layers from measured density grids; concrete imagery, depth assumptions
and compiled rendering leaves stay with the object and preparation adapter.

`@cssearth/objects/sources` is the source catalogue: its records, citations and
bindings and the validators every one passes. It stays browser-safe, because the
application reads the catalogue with it. `@cssearth/objects/node` is the Node-only
entry for source manifests (their validation, coverage and byte-range checks and the
portable relative-path rule their entries follow) and for preparation's read of the
registry. Nothing else in the package imports it. The manifests themselves stay beside each body.
`@cssearth/objects/node/contract` is a second Node-only entry: the helpers tests use to
check an object against its contract (its final prepared definition, read from
`src/objects/<id>/prepared/object.json`, and fixture values required before a test
inspects them).

```text
packages/objects/
├── src/           Generic TypeScript implementation and tests
│   ├── sources/   Source catalogue (`@cssearth/objects/sources`)
│   └── node/      Source manifests and the prepared registry read (`@cssearth/objects/node`, Node only)
│       └── contract/ Object test helpers (`@cssearth/objects/node/contract`, Node only)
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
