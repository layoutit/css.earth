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
  pages and poles, the lighting, limb and atmosphere banks, the prepared atmosphere frame and composite, interiors, missing-coverage painting and the lossy WebP lane.
  It imports `photometry`.
- `src/scene/` is published as `@cssearth/bake/scene` (Node only): geometry profiles, projected surface leaves and their
  raster presentation, seam outsets, polar caps, ring wedges, cutaways, atmospheric materials, solid-body surfaces and
  the perspective camera of a solid scene.
  It imports `raster`. The host passes the physical scene and Sun directions in (`ScenePreparationAdapters`).
- `src/presentation/` is published as `@cssearth/bake/presentation` (Node only): the retained node tree with its
  projective layouts and leaf boxes, offline CSSOM reads (Playwright's Chromium), activation groups, and the row-bank
  cutaway, composite and emissive presentations; and the prepared-presentation contract with its schemas, and the cubic-sky
  and directional-Sun contracts and preparers it validates, and the material-track source planning (frame lookups and banks)
  the layer presentations build on. It imports `scene` and `raster`. The host passes material
  tracks and lens navigation in (`PresentationHostAdapters`); nothing here loads tools or platform modules itself.
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
- `src/galaxy-catalog/` is published as `@cssearth/bake/galaxy-catalog` (Node only): the galaxy catalogue bake (recipes,
  CSV and archive sources, bibliography, positions, memberships, the display sample). It imports no topic.
- `src/cluster-catalog/` is published as `@cssearth/bake/cluster-catalog` (Node only): the galaxy-cluster catalogue,
  placed with the galaxy positions. It imports `galaxy-catalog`.
- `src/world-context/` is published as `@cssearth/bake/world-context` (Node only): the spatial world context (sources,
  bodies, orbit banks, system and group views, hyperbolic paths). It imports no topic.
- `src/objects/` holds the shared object libraries the per-body preparation pipelines in `tools/objects/` import. Each of
  its folders is a topic of its own, published as `@cssearth/bake/objects/<topic>` (Node only), importing another topic only as `LOWER_TOPICS` declares:
  - `objects/color`: the sRGB transfer, band-colour and asinh displays, palettes and tints, a placed star's catalogue colour,
    and the uniform colour of whole-disc photometry. The host passes the CIE 1931 colour-matching table in.
  - `objects/geometry`: shape models (OBJ, STL, PDS plate, vertex-facet and radius tables, FITS facet fields) and the records
    that describe them, radial meshes and their simplification, controlled shape cameras and band alignment, ellipsoids, the
    Lambert attenuation atlas and the radial-layer contract.
  - `objects/cameras`: observer-computed cameras from an ephemeris and a spin state or IAU pole model, and the shared SPICE
    kernel banks bound to the source-manifest reader (`packages/bake/cli/kernel-bank.mts` is their command line).
  - `objects/scene`: the physical world frame navigation is solved in, authored synchronous and hosted rotations, and the frames
    derived from the prepared solar geometry: the ecliptic presentation frame, the default camera, the Sun's reference view
    direction and the astrometric sky registration, and from them an object's physical solar-system scene and focused
    camera; also the authored presentation basis and drawn node chain the world-navigation stage solves, the physical
    projection it adds to rotating material tracks, and a recipe's camera source. The solar geometry is generated into the checkout (`src/platform/solar-geometry.mts`) after the packages build,
    so the host passes it in (`SolarGeometry`). The prepared sky and Sun contracts and their preparers belong to
    `presentation` (`src/presentation/{cubic-sky,directional-sun}-contract.ts`), which the scene imports as a lower topic.
  - `objects/raster`: scientific surfaces from PDS, ISIS, FITS, GeoTIFF, VTK, NumPy, HEALPix and Tecplot products,
    categorical geology and symbols, exoplanet eclipse and published phase-curve maps, observed colour rasters and their
    photometric composition, the source records they read, the WISE atlas mosaic grid, FITS binary tables (OIFITS and archive
    tables) and a star's limb darkening fitted to TESS transits. It imports `objects/scene`,
    `objects/geometry`, `objects/color`, `objects/cameras`, `raster` and `photometry`.
  - `objects/sources`: an object's authored source references read through its source manifest, and the pinned source
    files (bindings, byte ranges, contained paths, atomic publication) preparation reads and writes; JSON source values
    left unchecked for their consumer; the shared reference banks under `src/references/` (the CIE 1931 table), whose
    directory is found on first use; the matcher that binds a manifest's recorded generator name to today's code; and the
    idle-timeout stream relay pinned downloads go through.
  - `objects/layers/<kind>` (`terrestrial`, `giant`, `paged-ellipsoid`, `material-composition`, `cutaway`, `observed-surfaces`,
    `observation`, `shape-model`):
    the libraries each layer pipeline shares, one entry per kind. A layer imports the object topics and bake topics above and,
    as `LOWER_TOPICS` declares, another layer (`material-composition` → `giant` → `observed-surfaces`). Code that reads
    the generated solar geometry takes it as a parameter (`SolarGeometry`), as the scene topic does. The pipelines' entry
    scripts and modules that still read platform files stay in `tools/objects/`. A source manifest's `generator` records
    what made an intermediate when it was made, so manifests keep naming the radial snapshot and PDS constraint map by their
    old `tools/objects/terrestrial-layers/` paths; `objects/sources` (`preparation-generator.ts`) binds those names to this code.
    Terrestrial keeps its radial terrain and materials in `radial/`, its solid rasters in `solid/`, and the
    surface-observation pipeline (formats, cameras, pixel geometry, photometry, footprints, surface transfer, registration) in
    `surface-observations/`; the paged-ellipsoid globe (`globe/`) holds its recipe context and its scene, split into the
    shared scene context, the sphere leaves, the cutaway interior and the atmosphere material bank.
  Their tests stay beside the pipelines in `tools/objects/` (`node --test`), because they read body sources, kernel banks and
  oracle fixtures through the repository's test helpers; they import the entries. `pnpm test:bake-objects`
  (`tools/ci/test-bake-objects.mts`) runs every test that imports an object entry, in the contract lint job.
- `src/nebula/` is published as `@cssearth/bake/nebula` (Node only): the nebula delivery bake (delivery recipes and
  identities, compact density, finite-emission and compiler deliveries, catalogue fields, star sprites, frames,
  render-element budgets). It imports `volume`, `volume-leaves`, `density` and `stars`. `tools/nebula/prepare.mts` is its
  entry and records the prepared closure with the platform's inventory.
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
covering every topic directory whose code a delivery runs (`tools/nebula/application/package-identity.test.ts` checks it
against the delivery's import closure); `src/nebula/objects.ts` names only owners outside the package.

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
- `tsup` bundles the JavaScript; declarations come from one `tsc` pass (`tsconfig.build.json`, per file under
  `dist/types/`), and each exported `dist/<entry>.d.ts` re-exports its topic's index. A new topic needs only its entry in
  `tsup.config.ts` and `package.json`; don't raise Node's heap for the build.
