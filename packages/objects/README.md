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

`parseDensityVolumeObjectDescriptor()` validates density-volume objects with a
physical frame, bounds, and pinned preparation source. Volume images, concrete
sampling, and renderer-specific slice geometry remain outside this package.

`parseImageLayerBankDescriptor()` uses the same physical-frame contract for
spatial models reconstructed from observations. Its type distinguishes prepared
image layers from measured density grids; concrete imagery, depth assumptions
and compiled rendering leaves stay with the object and preparation adapter.

```text
packages/objects/
├── src/           Generic TypeScript implementation and tests
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
