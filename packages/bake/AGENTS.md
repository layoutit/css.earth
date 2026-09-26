# Bake package instructions

Own the build-time preparation code: what the preparation tools and the nebula lab run to turn source records into
prepared delivery. Nothing here runs in the application. The runtime (`@cssearth/renderer` and
`site/**`) must never import `@cssearth/bake`; a type the renderer needs belongs in the renderer's own contracts.

Each topic is one subpath entry. Topics must not import each other sideways. A topic may import a lower topic, and only
through that topic's `index.ts`, when `LOWER_TOPICS` in `src/entries.test.ts` declares it; the declared order has no
cycle. Share anything else through `@cssearth/core` or another package. Build-time code may import `@cssearth/renderer`
(the raster lane reads the prepared-asset constants the renderer owns, and the scene and presentation compilers write what
its validators accept); the renderer never imports the bake.

- `src/photometry/` is published as `@cssearth/bake/photometry` (Node only): published photometric models, their
  records and normalization, and the limb laws and PSG limb profiles preparation draws from them. It imports no topic.
- `src/raster/` is published as `@cssearth/bake/raster` (Node only): raster recipes and their validation, surface maps,
  pages and poles, the lighting, limb and atmosphere banks, interiors, missing-coverage painting and the lossy WebP lane.
  It imports `photometry`.
- `src/scene/` is published as `@cssearth/bake/scene` (Node only): geometry profiles, projected surface leaves and their
  raster presentation, seam outsets, polar caps, ring wedges, cutaways, atmospheric materials and solid-body surfaces.
  It imports `raster`. The host passes the physical scene and Sun directions in (`ScenePreparationAdapters`).
- `src/presentation/` is published as `@cssearth/bake/presentation` (Node only): the retained node tree with its
  projective layouts and leaf boxes, offline CSSOM reads (Playwright's Chromium), activation groups, and the row-bank
  cutaway, composite and emissive presentations. It imports `scene` and `raster`. The host passes material tracks, the
  prepared-presentation contract and lens navigation in (`PresentationHostAdapters`); nothing here loads tools or
  platform modules itself.
- `src/volume-leaves/` is published as `@cssearth/bake/volume-leaves` (Node only): the CSS volume compilers that turn
  slice stacks and detail planes into retained PolyCSS leaves, their bounds and depth order, and the volume impostors.
  It imports `scene` and `volume`.
- `src/stars/` is published as `@cssearth/bake/stars` (Node only): the point-field star bake (recipes, catalogue
  sources, palette, hierarchy, point atlas and photometry, diffuse sky, encoded bank). It imports `raster` and `volume`.
- `src/shell/` is published as `@cssearth/bake/shell` (Node only): the surface-shell bake and its CSS compiler. It
  imports `scene` and `volume`.
- `src/sky/` is published as `@cssearth/bake/sky` (Node only): the cubic sky bake (recipes, EXR source, baked faces,
  near-star sprites) and its CSS compiler. It imports `volume-leaves` and `volume`.
- `src/density/` is published as `@cssearth/bake/density` (Node only): the density-volume object bake (acquisition,
  column depth, fixed discs, slice atlases and retirement, lens-bank promotion). It imports `sky`, `volume-leaves` and
  `volume`.
- `src/image-layers/` is published as `@cssearth/bake/image-layers` (Node only): the extruded image-layer bake and its
  resampler. It imports `volume-leaves`.
- `src/environment/` is published as `@cssearth/bake/environment` (Node only): the environment-image replay. It
  imports `image-layers`, `shell`, `stars`, `density` and `volume`.
- The star, shell and density-volume bakes write into an object's own `prepared/` directory only with the host's
  inventory passed in (`inventory`, the platform's `inventoryPreparedAssets`); a scratch bake needs none.

- `src/volume/` is published as `@cssearth/bake/volume`: the volume contracts, coordinates, fields, materials and
  sampling. It stays host-neutral, because the nebula lab's browser viewer imports it: no Node built-ins, `Buffer`,
  DOM, React, Vite, `sharp`, PolyCSS, renderer imports or file paths, and it never imports `node/`.
- `src/volume/node/` is published as `@cssearth/bake/volume/node`: the compact-input replay, the XYZ slices and the
  compiler bake. It may import `node:*`, `sharp` and the main volume entry. The main entry never imports it; the Node-only
  topics above may, as a lower layer.

## Behaviour is part of the contract

Prepared volumes, nebula deliveries and the lab's accepted density bakes depend on exactly what this code returns.
Preserve arithmetic order, finite support, frames, units, spectral semantics, missing-data handling and historical
compatibility. A relocation must not change accepted pixels or relax a validator. Material colour does not define
density: keep component-bound 3D material distinct from historical image-ray samplers, and never add an XY fallback to
the finite-emission compiler. Change an output only on purpose, together with every test and accepted bake that pins it.

The `nebulaImplementation` inventory in `package.json` lists the sources that nebula delivery identities hash. Keep it
covering every topic directory whose code a delivery runs.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs. The host supplies object
  paths, recipes and backends through validated contracts.
- Keep object JSON, source inputs/manifests, licences, required notices, provenance, and prepared payloads outside
  packages.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.
