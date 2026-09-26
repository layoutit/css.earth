# Renderer package instructions

Own the CSS renderer runtime: loading, decoding and validating prepared objects, the shared world camera and its
navigation, retained CSS rendering of bodies, skies, stars, volumes, image layers and labels, and the universe context
around the focused object. The site and the preparation tools reach it through `@cssearth/renderer` and its subpaths.
The compilers that write the renderer's prepared formats are preparation code; they live in `@cssearth/bake` and import
this package.

## The runtime contract

- This is browser code. Import packages and the renderer's own modules only: never the application (`site/`,
  `src/platform/`, `src/objects/`), tools, labs, preparation code (`@cssearth/bake`) or
  Node built-ins. `eslint.config.mts` enforces it for everything but tests.
- Keep runtime DOM retained and stable. Decode and transport prepared state; never derive source data, geometry,
  charts, atlases or scene assets at runtime.
- No runtime `clip-path`, CSS masks, filters, CSS gradients, blend modes, canvas or WebGL. Detailed bodies are PolyCSS.
- No per-object folders, planet-specific implementations or branches on named object ids: every object fact arrives in
  its prepared data. Object page stylesheets (`src/renderers/css/styles/*-surfaces.css`) belong to the objects, not here.
- Validate every external value where it enters (`src/validation/`); no `any` and no TypeScript suppression comments.

## Entries

- `tsup.config.ts` names the built entries; `package.json#exports` publishes each of them and the TypeScript source
  subpaths (`@cssearth/renderer/<folder>/<file>.ts`). Change them together.
- The site's client build compiles the built entries from their sources and marks every non-worker module free of side
  effects ([renderer-sources.mts](../../tools/performance/renderer-sources.mts)), so modules declare and export only.
  Worker entries keep their load-time effects.
- Node code built by esbuild with `packages: 'external'` must bundle this package
  ([bundle-renderer.mts](../../tools/cli/bundle-renderer.mts)): the sources name their siblings `.js`, which Node cannot
  load unbundled. The lab's builder and the implementation fingerprints follow the sources the same way.

## Source size and package maintenance

- Strict TypeScript. Every source file and test is limited to 600 physical lines; `pnpm lint:packages` enforces it.
  Four files moved in over the limit and are listed in `eslint.config.mts` until they are split.
- Tests may read prepared object data from the checkout, so run `pnpm setup:assets` first.
- A change that only moves or renames code keeps the site's built bundles byte-identical; compare `dist/` before and after.
- Maintain README.md and CLAUDE.md as a symlink to this guide.
