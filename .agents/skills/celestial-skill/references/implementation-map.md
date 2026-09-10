# cssEarth implementation map

Paths are relative to the selected repository. The documentation links were
checked against main `2f6f8614add9a5a22ef03b86a47edef631950ade` on 2026-09-09.
Code examples below name the revisions where they were checked. Inspect the
current checkout before using them.

## Start from authored data

Current celestial packages live under `src/planets/<id>/`, including moons and
dwarf planets. Their `object.json` supplies a `properties.recipe` with pinned
source references and supported capabilities. Shared preparation produces the
renderer payload. Do not scaffold a private runtime, preparation script suite,
or shell for each new body.

```text
src/planets/<id>/
  object.json                         authored recipe and prepared reference
  README.md                           sources, processing, evidence and known problems
  NOTICE.md                           credits and reuse terms
  source/manifest.json                 exact source closure
  source/preparation/*.json            acquisition and capability inputs
  source/content/object.json          content and supported controls
  source/presentation/                title and applicable map inputs
  prepared/                           generated runtime/content/controls/object JSON
  prepared/page.json                  generated page assets and controls
  runtime-assets.json                 generated image inventory and hashes

public/scenes/<id>/                    prepared assets
site/pages/[id].astro                  one shared route for all body ids
tests/objects/unit/<id>/               focused body tests
tests/objects/browser/<id>/browser-profile.mjs
```

The [documentation contract](../../../../docs/provenance/CONTRACT.md) explains
where body docs and evidence go. Every file under `source/` needs a manifest
entry. Keep test logs and browser screenshots outside it.

Use `tools/object-package-contract.mts` for actual required files. Its authored
branch is selected through `tools/authored-object.mts`; the legacy branch still
mentions `runtime/client.mjs`, package Astro pages, and per-body tools. Those
fallback requirements are not the current authored-package template.

## Find the owner for the change

| Change | Source owners |
| --- | --- |
| Identity, route, lazy loading | `site/objects.mts`, `site/object-schema.mts`, `site/object-adapter.mts`, `site/packaged-object-runtime.mts` |
| Authored and prepared object contracts | `packages/objects/src/descriptor.ts`, `packages/objects/src/authored.ts`, `src/renderers/css/validation/` |
| Preparation dispatch and publication | `tools/objects/prepare-authored.ts`, `tools/objects/publication.mts`, `tools/prepare-object-json.mts` |
| Source acquisition, verification and runtime inventory | `tools/objects/operations.ts`, `tools/objects/operations-acquisition.ts`, package source manifests and acquisition JSON |
| Retained scene, selection, resources and lifecycle | `src/renderers/css/runtime/object-runtime.ts`, `src/renderers/css/rendering/`, `site/scene-contract.mjs`, `site/scene-router.mts` |
| Shared input, world camera and physical registration | `site/runtime-policy.mjs`, `src/renderers/css/navigation/`, `src/renderers/css/rendering/prepared-camera-runtime.ts`, `tools/objects/world-navigation.ts` |
| Shared page and content presentation | `site/pages/[id].astro`, `site/components/ObjectPage.astro`, `site/object-page-data.mts`, `site/object-page-contract.mts`, `site/layouts/PlanetLayout.astro` |
| Content, lens labels, title and minimap preparation | `tools/objects/content/`, `site/prepare-lens-labels.mts`, `tools/prepare-planet-title-sources.mts`, `tools/prepare-surface-minimaps.mts` |
| Search and marker presentation | `site/planet-search-objects.mts`, `tools/prepare-navigation.mts`, `src/navigation/marker-presentation.mts` |
| Open hyperbolic trajectories | `packages/astronomy/src/kepler.ts`, `src/platform/prepare-hyperbolic-path.mts`, shared world-context preparation and orbit validation/projector |

For an unbound body, use the shared prepared hyperbolic path with explicit open
endpoints and an epoch vertex. Do not wrap its anomaly, close its last edge or
invent a revolution period. The finite display window is not a physical bound
or a propagation-accuracy claim. See [open trajectories](../../../../docs/prepared-navigation-ownership.md#open-trajectories).

Follow the selected preparation branch into its reusable implementation under
`tools/objects/`. Preparation owns geometry, source interpretation, atlases,
lighting and other scene assets; the shared CSS renderer consumes prepared data.
Body facts stay in the package. Extend a shared capability only when the source
requires behavior the existing capability cannot express.

`site/pages/[id].astro` derives routes from `OBJECTS` and passes the selected id
to `ObjectPage.astro`. That component loads the body's prepared page and content,
applies its declared stylesheets, and uses the shared head/panel and `PlanetLayout`.
`site/objects.mts` loads descriptors through `loadPackagedObject`. Preserve one
registry, generic adapter, shared shell and active object scene; navigation uses
the shared world camera.

Navigation marker appearance comes from each authored package's
`source/preparation/navigation.json`. `tools/prepare-navigation.mts` generates
`site/prepared-navigation-markers.mjs`; `PlanetNavigationMarker.astro` consumes
it. Adding a body does not require a hand-maintained component presentation map.

## Choose examples by source needs

- **Observation mosaics:** Triton's `source/preparation/terrestrial.json` uses
  the shared `tools/objects/terrestrial-layers/` path for native image geometry,
  photometric correction, compositing and gaps. Reuse the capability with the
  target body's inputs and conventions.
- **Elevation relief:** Ceres's `source/preparation/terrestrial.json` supplies
  its height datum, validity limits and cartographic lighting to
  `tools/objects/terrestrial-layers/scientific-raster.mts`. These values and gap
  rules belong to its dataset.
- **A sourced shape model:** Haumea's `source/preparation/shape-model.json` uses
  `tools/objects/shape-model/`. Inspect both the authored schema and that
  preparer's actual shape support before choosing it for another body; verify
  camera picking in the shared renderer if the new geometry requires it.
- **Published ellipsoids and unresolved outlines:**
  `tools/objects/source-authoring/distant-worlds/README.md` documents the existing
  analytical radius-table extraction. Its helpers accept a selected input file;
  `outer-worlds/inputs.json` supplies the later occultation and thermal examples.
  Keep a projected ellipse distinct from a 3D shape, disclose any assumed depth,
  and use the normal unmapped grid. A short title must match the content display
  name; a longer designation can remain in the shared registry for search.
- **Measured irregular radial terrain:** Vesta's
  `source/preparation/terrestrial.json` selects `geometry.radialTerrain`, native
  `primitive: "u"`, and optional meshoptimizer simplification. Read
  [irregular meshes](irregular-meshes.md) before using this branch. The owners
  below were verified in Vesta PR #24 at `1979293e` on 2026-09-07; inspect the
  selected checkout for availability rather than assuming that revision is merged.

| Irregular-mesh capability | Owner relative to the repository |
| --- | --- |
| Source sampling, native triangle planning and per-texel lighting bake | `tools/objects/terrestrial-layers/radial-terrain.mts` |
| Position welding, compaction, meshoptimizer simplification and topology checks | `tools/objects/terrestrial-layers/radial-meshoptimizer.mts` |
| PDS radius values / OBJ radial intersections | `tools/objects/terrestrial-layers/pds-scalar-grid.mts`, `tools/objects/terrestrial-layers/obj-shape.mts` |
| Geometry regressions and independent body anchors | `tools/objects/terrestrial-layers/radial-meshoptimizer.test.mjs`, `tools/objects/terrestrial-layers/radial-terrain.test.mjs`, `tests/objects/unit/vesta/source.test.mjs` |

The OBJ sampler supplies radius by ray intersection; this route resamples the
shape and does not retain arbitrary OBJ connectivity or UVs. It is not proof of
a general full-mesh rendering capability.

These examples identify implementations to inspect, not universal visual or
scientific templates. See [qualification](qualification.md) for source and
browser comparisons relevant to the actual feature.

## Registered photographic mosaics

For photographs with per-pixel surface geometry, read
[registered photographic mosaics](registered-photographic-mosaics.md). The 67P
OSIRIS example below was inspected at commit
`fde7dc8f3f35f6c56fee440b24bc7041a47255a2` in PR #49. Check the selected checkout
for availability; this reference does not establish merge or deployment status.

| Capability | Owner relative to the repository |
| --- | --- |
| Observation pins, quality policy, photometry and transfer limits | `src/planets/comet-67p/source/preparation/terrestrial.json` and `acquisition.json` in the same directory |
| OSIRIS decoding, companion identity, projective fit and footprint sampling | `tools/objects/terrestrial-layers/osiris-geo.mts` |
| Disjoint camera validation, source-mesh correspondence and visibility | `tools/objects/terrestrial-layers/observed-geo-surface.mts` |
| Deterministic surface samples, bounded overlap gains and observation selection | `tools/objects/terrestrial-layers/observation-mosaic.mts` |
| Atlas baking and lossless observation-index output | `tools/objects/terrestrial-layers/radial-terrain.mts` |
| Selection/level regressions and prepared provenance checks | `tools/objects/terrestrial-layers/observation-mosaic.test.mjs`, `tests/objects/unit/comet-67p/mosaic.test.mjs` |
| Worked method, limitations and measured evidence | [67P source and evidence account](../../../../src/planets/comet-67p/README.md) |

Inspect the actual recipe/schema before reuse. The OSIRIS decoder and quality
bits are instrument-specific; source identity, geometry qualification and
provenance are transferable requirements. 67P's distances, angles, sample counts,
photometric model and gain limits are evidence for that dataset, not defaults.

## Commands and test routing

Read `package.json` for the selected checkout. The commands below have distinct
purposes; run those needed for the task, not every preparation step by default.

| Purpose | Current entry point |
| --- | --- |
| Build shared tool bundles when needed | `pnpm build:packages`, `pnpm build:renderer`, `pnpm build:preparation` |
| Install already published prepared files | `pnpm setup:assets --object=<id>` |
| Restore missing source pins and verify existing bytes | `node tools/objects/dist/operations.js acquire <id>` |
| Verify source closure without acquiring | `node tools/objects/dist/operations.js acquire <id> --verify-only` |
| Prepare selected objects through the cache and shared steps | `pnpm prepare:planets -- --object=<id>` |
| Invoke authored preparation directly | `node tools/objects/dist/prepare-authored.js <id> --write` |
| Restore sources before root preparation | `pnpm prepare:checkout` |
| Build the site and assemble declared runtime files | `pnpm build` |

Default acquisition restores missing pins from `source/preparation/acquisition.json`
and fails on changed existing bytes. `tools/restore-source-inputs.mts` delegates
selected objects to shared acquisition; it also restores Earth's pinned WMTS
inputs. `setup:assets` installs prepared files independently of source preparation.

`tools/run-implemented-planets.mts` discovers registered objects and selects the
authored commands. It routes `test:planets` to `tests/objects/unit/<id>/`.
`pnpm test` currently runs packages, renderer, platform and shell checks;
`test:planets` and `test:preparation` are separate commands.

`pnpm test:browser` currently runs DOM cleanliness. Shared interaction
conformance is `pnpm test:browser:conformance`. Browser profiles live in
`tests/objects/browser/<id>/`, use `site/test/object-browser-profile.mjs`, and
consume prepared controls. `site/test/load-browser-profile.mjs` already handles
absent lenses and requires race inputs only when more than one lens exists.
Use the actual command coverage when reporting proof; readiness requirements
belong to the user's contract and [qualification](qualification.md).
