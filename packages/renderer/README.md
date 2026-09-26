# @cssearth/renderer

The CSS renderer runtime. It loads, decodes and validates prepared objects, keeps the one shared world camera and its
navigation, and renders bodies, skies, star fields, volumes, image layers and labels as retained PolyCSS and CSS, with
the universe context around the focused object. The site mounts objects through it; the preparation tools import its
formats and validators so that what they write is what the browser reads.

It was `src/renderers/css` until 2026-09-26. The compilers that write its prepared formats stayed there
(`src/renderers/css/preparation`), as did the object page stylesheets (`src/renderers/css/styles/*-surfaces.css`), which
belong to the objects.

## Entries

| entry | what it holds |
|---|---|
| `@cssearth/renderer` | the object runtime (`createObjectRuntime`), the object contract, prepared-object loading, parsing and asset origins |
| `@cssearth/renderer/navigation` | the world camera and its rotation maths, view URLs, selection targets and the prepared world-camera frame parser |
| `@cssearth/renderer/universe` | the universe context (`createPreparedUniverse`), the world-frame queue and the loaders of volumes, point appearances, surface shells, image layers and volume lenses |
| `@cssearth/renderer/platform/*` | single modules the application and tools import on their own (`object-orbit`, `camera-input`, `camera-layout`, `prepared-wheel-zoom`, `prepared-residency`, `object-contract`, `prepared-image-store`, `object-selection-runtime`, `prepared-presentation`, `perspective-dolly`, `solar-view-direction`, `prepared-object-assets`, `surface-fly-to`, `directional-sun-coordinate`) |
| `@cssearth/renderer/testing` | the same implementations, exposed for tests |
| `@cssearth/renderer/scene-native-waits`, `…/prepared-object-worker`, `…/world-context-planner-worker` | native wait helpers and the two worker entries |
| `@cssearth/renderer/<folder>/<file>.ts` | a TypeScript source module, for the types and small functions the entries above do not publish |
| `@cssearth/renderer/styles/*.css` | the runtime stylesheets: `volume.css`, `world-context.css`, `triangle-faces.css` |

The built entries are ESM with declarations in `dist/`. The site's client build compiles them from their sources
instead ([renderer-sources.mts](../../tools/performance/renderer-sources.mts)); server rendering and Node tools use `dist/`.
Node bundles that keep packages external still bundle this one ([bundle-renderer.mts](../../tools/cli/bundle-renderer.mts)),
because its sources name their siblings `.js`.

Three small modules moved in from `src/platform` with the runtime, since the renderer was their only runtime owner:
`src/runtime/shell-settings.ts` (the setting names the shared shell owns), `src/labels/surface-feature-banks.ts` (the
feature-bank address that preparation writes and the labels read) and `src/validation/prepared-texture-levels.ts` (the
texture-level validators). None is generic enough for `@cssearth/core`.

```text
packages/renderer/
├── src/
│   ├── index.ts, loader.ts, testing.ts, prepared-object-*.ts   entries, prepared-object loading and its worker
│   ├── runtime/        object runtime, object contract, scene lifecycle
│   ├── navigation/     world camera, camera input, flights, view URLs
│   ├── rendering/      prepared presentation, residency, materials, leaf pools
│   ├── validation/     parsers for every prepared format
│   ├── prepared-data/  world context, ellipsoid projections
│   ├── universe/       universe context and catalogues
│   ├── solar-system/, sky/, stars/, volume/, shell/, image-layers/, labels/
│   └── styles/         runtime stylesheets
├── tsup.config.ts      built entries
├── AGENTS.md           package rules
└── CLAUDE.md           symlink to AGENTS.md
```

## Evidence

The move from `src/renderers/css` left the site's `astro build` output byte-identical: all 9,508 files outside
`dist/scenes` had the same SHA-256 before and after. The package's built JavaScript matched `src/renderers/css/dist` except for
source-path comments and the content-hashed chunk names that follow from them, and its declarations differ only in how
the shared declaration chunks are split and named. The preparation bundle in `tools/objects/dist` differed only in the
source-path comments.

Most tests read prepared object data, so restore it first with `pnpm setup:assets`. From the repository root:

```sh
pnpm build:renderer
pnpm typecheck:renderer
pnpm test:renderer
```
