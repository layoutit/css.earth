# @cssearth/engine

Shared camera, navigation, lifecycle, and renderer-independent execution contracts.

`selectPreparedPointField()` selects deterministic exact-star references for a
perspective view; hierarchy nodes are traversal bounds and are never drawn as
centroid dots. `selectVisiblePreparedStars()` adds camera-distance apparent-
magnitude filtering and optional prepared coverage anchors. `consideredCount`
and `drawnCount` describe the catalogue and retained pool; `coveredCount` is a
compatibility alias for the considered catalogue size. The error field is a
diagnostic rather than a pixel guarantee.

`presentPhysicalPoseInVolume()` expresses the canonical physical observer in a
prepared volume's local units. This projection never replaces the observer with
large-origin volume coordinates, preserving close-object camera precision.

```text
packages/engine/
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
