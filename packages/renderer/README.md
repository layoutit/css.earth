# @cssearth/renderer

The CSS renderer runtime. It loads, decodes and validates prepared objects, keeps the one shared world camera and its
navigation, and renders bodies, skies, star fields, volumes, image layers and labels as retained PolyCSS and CSS, with
the universe context around the focused object. The site mounts objects through it; the preparation tools import its
formats and validators so that what they write is what the browser reads.

It was `src/renderers/css` until 2026-09-26. The compilers that write its prepared formats stayed there
(`src/renderers/css/preparation`) until they moved into `@cssearth/bake`; the object page stylesheets
(`src/renderers/css/styles/*-surfaces.css`), which belong to the objects, stay there.

## World depth ownership

The universe mount assigns numeric `z-index` values directly to the detail stage, shared orbit SVG and flight annotations.
Its returned `depthBase` lets application-owned moon labels use the same band before attachment. Keep these values on
the elements that own stacking; an inherited depth variable on the shared stage propagates through the mounted scene.

## Entries

| entry | what it holds |
|---|---|
| `@cssearth/renderer` | the object runtime (`createObjectRuntime`), the object contract, prepared-object loading, parsing and asset origins |
| `@cssearth/renderer/navigation` | the world camera and its rotation maths, view URLs, selection targets and the prepared world-camera frame parser |
| `@cssearth/renderer/universe` | the universe context (`createPreparedUniverse`), the world-frame queue and the loaders of volumes, point appearances, surface shells, image layers and volume datasets |
| `@cssearth/renderer/platform/*` | single modules the application and tools import on their own (`object-orbit`, `camera-input`, `camera-layout`, `prepared-wheel-zoom`, `prepared-residency`, `object-contract`, `prepared-image-store`, `object-selection-runtime`, `prepared-presentation`, `perspective-dolly`, `solar-view-direction`, `prepared-object-assets`, `surface-fly-to`, `directional-sun-coordinate`) |
| `@cssearth/renderer/testing` | the same implementations, exposed for tests |
| `@cssearth/renderer/scene-native-waits`, `…/prepared-object-worker`, `…/world-context-planner-worker` | native wait helpers and the two worker entries |
| `@cssearth/renderer/<folder>/<file>.ts` | a TypeScript source module, for the types and small functions the entries above do not publish |
| `@cssearth/renderer/styles/*.css` | the runtime stylesheets: `volume.css`, `world-context.css`, `triangle-faces.css` |

The built entries are ESM with declarations in `dist/`. The site's client build compiles them from their sources
instead ([package-sources.mts](../../site/build/package-sources.mts)); server rendering and Node tools use `dist/`.
Node bundles that keep packages external still bundle this one ([bundle-renderer.ts](../bake/src/preparation/bundle-renderer.ts)),
because its sources name their siblings `.js`. `src/runtime/shell-contract.ts` and `src/labels/universe-label-policy.ts` name
theirs `.ts` instead, so plain-Node tools can load them without a bundler.

Three small modules moved in from `src/platform` with the runtime, since the renderer was their only runtime owner:
`src/runtime/shell-settings.ts` (the setting names the shared shell owns), `src/labels/surface-feature-banks.ts` (the
feature-bank address that preparation writes and the labels read) and `src/validation/prepared-texture-levels.ts` (the
texture-level validators). None is generic enough for `@cssearth/core`. The shell's object-controls and scene-lifecycle
contract (`src/runtime/shell-contract.ts`) moved in later from `site/scene`, so `src/platform` and the tools can check a
scene against it without importing the site.

```text
packages/renderer/
├── src/
│   ├── index.ts, loader.ts, testing.ts, prepared-object-*.ts   entries, prepared-object loading and its worker
│   ├── runtime/        object runtime, object contract, scene lifecycle
│   ├── navigation/     world camera, camera input, flights, view URLs, navigation marker presentation
│   ├── rendering/      prepared presentation, residency, materials, leaf pools
│   ├── validation/     parsers for every prepared format
│   ├── prepared-data/  world context, ellipsoid projections
│   ├── universe/       universe context and catalogues
│   ├── solar-system/   heliocentric geometry, orbits, and the prepared cubic-sky and directional-Sun contracts
│   ├── sky/, stars/, volume/, shell/, image-layers/, labels/
│   └── styles/         runtime stylesheets
├── tsup.config.ts      built entries
├── AGENTS.md           package rules
└── CLAUDE.md           symlink to AGENTS.md
```

## First connection and backing sizes

A detached presentation selects its initial leaf-box levels from the incoming physical view before its roots connect.
The prepared stylesheet's close-up default is not a resident raster cache. Keeping it through a distant system arrival
allocates large backing surfaces for tiny projected faces. `createLeafBoxBlocks.prepare()` applies the existing
prepared levels while detached; after connection, `publish()` keeps the existing motion freeze and paced settling.
No new geometry, texture or device-specific level policy is introduced.

The connection-order regression uses Neptune's real prepared groups in `src/platform/object-selection-runtime.test.mts`.
The leaf-box unit test checks initial selection, unchanged repeated preparation and the subsequent motion freeze.
[Matched iPad captures](evidence/initial-leaf-backing.json) record the reduced layer allocation, remaining first-paint
stalls and measurement limits.

## Evidence

The move from `src/renderers/css` left the site's `astro build` output byte-identical: all 9,508 files outside
`dist/scenes` were byte-identical before and after. The package's built JavaScript matched `src/renderers/css/dist` except for
source-path comments and the content-hashed chunk names that follow from them, and its declarations differ only in how
the shared declaration chunks are split and named. The preparation bundle in `tools/objects/dist` differed only in the
source-path comments.

Most tests read prepared object data, so restore it first with `pnpm setup:assets`. From the repository root:

```sh
pnpm build:renderer
pnpm typecheck:renderer
pnpm test:renderer
```

## Prepared image transport

The mounted object's image store deduplicates URLs across leases. For finite pools,
up to six unfinished image loads (bounded by pool capacity, or the existing concurrency if larger) overlap network
transport with the pool's explicit `decode()` calls. A slow download does not occupy a decode slot. Images retain their
original URLs and native handles; transport does not create a separate fetch or blob cache. The browser still owns
its internal decode and eviction decisions.

Residency reserves the prepared decoded-byte cost before admitting a URL; download overlap does not change that
budget or admit extra assets. Releasing the final lease cancels pending image
loads and removes their listeners; completed warm handoffs preserve the decoded URL used by retained CSS. Detail
publication and paced painting continue to wait on the same decoded-resource receipts.

The universe billboard atlas has one shared decode lease for both the nebula and
image-layer billboard banks. First visible demand starts its asynchronous decode;
CSS receives the atlas only after readiness, followed by a requested publication.
The lease ends with the universe. Cold body close-ups do not request this atlas,
and decoding never reveals a new billboard during an inertial coast.
