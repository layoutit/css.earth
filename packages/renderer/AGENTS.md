# Renderer package instructions

Own the CSS renderer runtime: loading, decoding and validating prepared objects, the shared world camera and its
navigation, retained CSS rendering of bodies, skies, stars, volumes, image layers and labels, and the universe context
around the focused object. The site and the preparation tools reach it through `@cssearth/renderer` and its subpaths.
The compilers that write the renderer's prepared formats are preparation code; they live in `@cssearth/bake` and import
this package. Shared format identifiers and compact world-summary/system table decoders live in
`@cssearth/objects`; world-context validation, camera frame/presentation data, system views and orbit-bank codecs also live there.
Catalogue bank codecs and point-field data, manifest and binary bank contracts live in `@cssearth/objects` too.
Camera projection, star loading and navigation remain here.

## The runtime contract

- This is browser code. Import packages and the renderer's own modules only: never the application (`site/`,
  `src/platform/`, `src/objects/`), tools, labs, preparation code (`@cssearth/bake`) or
  Node built-ins. `eslint.config.mts` enforces it for everything but tests.
- Keep runtime DOM retained and stable. Decode and transport prepared state; never derive source data, geometry,
  charts, atlases or scene assets at runtime.
- A publication of an unchanged view writes nothing and asks for no frame. Guard a write with the value last written
  (`src/rendering/retained-write.ts`), never with a value read back from the page: the browser normalizes transforms,
  opacities and lengths, so a read-back compare rewrites them every frame. Statistics belong in `stats()` or
  `inspect()`, not in attributes written on each publication.
- No runtime `clip-path`, CSS masks, filters, CSS gradients, blend modes, canvas or WebGL. Detailed bodies are PolyCSS.
- No per-object folders, planet-specific implementations or branches on named object ids: every object fact arrives in
  its prepared data. Object page stylesheets (`src/renderers/css/styles/*-surfaces.css`) belong to the objects, not here.
- Validate every external value where it enters (prepared runtime validators in `@cssearth/objects`); no `any` and no TypeScript suppression comments.

## Entries

- `tsup.config.ts` names the built entries; `package.json#exports` publishes each of them and the TypeScript source
  subpaths (`@cssearth/renderer/<folder>/<file>.ts`). Change them together.
- The site's client build compiles the built entries from their sources and marks every non-worker module free of side
  effects ([package-sources.mts](../../site/build/package-sources.mts)), so modules declare and export only.
  Worker entries keep their load-time effects.
- Node code built by esbuild with `packages: 'external'` must bundle this package
  ([bundle-renderer.ts](../bake/src/preparation/bundle-renderer.ts)): the sources name their siblings `.js`, which Node cannot
  load unbundled. The lab's builder and the implementation fingerprints follow the sources the same way.

## Source size and package maintenance

- Strict TypeScript. Every source file and test is limited to 600 physical lines; `pnpm lint:packages` enforces it.
  Four files moved in over the limit and are listed in `eslint.config.mts` until they are split.
- Tests may read prepared object data from the checkout, so run `pnpm setup:assets` first.
- A change that only moves or renames code keeps the site's built bundles byte-identical; compare `dist/` before and after.
- Maintain README.md and CLAUDE.md as a symlink to this guide.

Object runtime definitions, control metadata, prepared dataset tables and their JSON validators belong to
`@cssearth/objects`. Selection operations and in-place dataset installation stay in this package.

Leaf bounds and their validator, prepared material/selection records and serialized pose keyframes belong to
`@cssearth/objects`; frustum computation, CSS publication and live Web Animations interfaces stay here.

Prepared CSS sky/parallax, cubic-sky and directional-Sun data and validation belong to `@cssearth/objects`;
retained sky mounting, camera projection and direction computation remain here.
