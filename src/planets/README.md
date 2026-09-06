# Adding one object

cssEarth renders one object at a time. Add a future object as an owned package.
Do not copy Saturn into shared code and do not add an unfinished object to the
registry.

## Required files

Use `src/planets/<id>/` as the planet boundary:

- `SOURCE.md`: exact source URLs, versions or commit ids, measurements,
  interpretation limits, and preparation choices.
- `NOTICE.md` and applicable license files: attribution and reuse terms.
- `source/`: checked source inputs when redistribution is permitted.
- `tools/`: reproducible acquisition and preparation commands that fail
  clearly when inputs or schemas change.
- `runtime/`: the retained-DOM client, planet CSS, and checked-in prepared
  modules used by the browser.
- `public/scenes/<id>/`: deterministic browser assets selected by the prepared
  runtime manifest.
- `site/<Planet>Page.astro`, panel components, head resources, overlays, and
  planet-owned CSS.
- `site/control-content.mjs`: export the actual `objectControls = { lenses,
  settings }` consumed by both the panel and browser profile loader. Use null
  or empty controls for unsupported capabilities; do not invent feature flags.
- `test/*.test.mjs`: source, prepared-output, renderer, page, and regression
  assertions.

Prepare editorial text inside the object package, with checked provenance and
provider-specific validation. The existing NASA importer uses `data/planets/`,
but that path and NASA's record schema are not generic requirements. Pluto's
owned NASA/JPL snapshots and parser are an example. Do not fetch editorial
services in the browser.

Use `LENS_LABELS` and `prepareLensLabels` from
`site/prepare-lens-labels.mjs` in `site/control-content.source.mjs` for shared
concepts. Select labels from source meaning: `normal` can mean Monochrome or
Visible color. Elevation, Enhanced color, Thermal infrared, and Cross section
use the same names across bodies; instrument and coverage details stay in
descriptions. New concepts may keep package-owned names. Regenerate the literal
controls with `node tools/prepare-object-controls.mjs --object=<id>`.

The shell displays the registry's classification as a tag beside the title.
Selecting it browses that category in the retained object search results.
The adjacent AU tag uses the registry distance and lists all objects in solar-distance order.
Do not repeat classification as a factsheet row.

## Object package contract

1. Export one mount function from the planet renderer.
2. The mount function receives the shared `.planet-stage` and `{ onError }`.
   Require that handler; do not install a silent default.
3. It returns a `ready` promise plus `pause()`, `resume()`, and `destroy()`.
4. It mounts a stable retained DOM and resolves its `ready` promise. The shared
   router publishes shell readiness and the stage's `aria-busy` state.
5. Calls made before readiness have defined behavior: `pause()` records a
   paused target state, `resume()` records a running target state, and
   `destroy()` permanently cancels later publication.
6. It may decode or transport checked prepared state. It performs no source
   acquisition, source interpretation, geometry generation, atlas generation,
   chart generation, or rasterization at runtime.
7. It selects the canonical highest-density prepared assets at mount,
   independent of device DPR. DPR changes after mount do not replace the bank.

The lifecycle methods are behavioral promises, not names alone. `pause()` stops
the scene's active animations. `resume()` restarts them once. `destroy()`
cancels pending publication, removes listeners, releases retained resources,
and remains safe when called again. The router alone decides automatic
playback, combining readiness, the user's Motion request, document visibility,
and reduced motion. Objects apply the latest command; they do not subscribe to
those environmental events or publish `html[data-playing]` themselves. Speed
zero changes the local animation rate, not the shared permission to play.

Use the shared coordination helpers instead of copying a neighboring client:

- `createSceneLifetime()` owns cleanup and logical cancellation. Register each
  image owner, listener, animation, DOM root, and timer as soon as it exists.
  Await native startup work through `lifetime.wait()` and check disposal before
  publication. `waitForScenePaint()` and `waitForSceneDocument()` are cancellable
  startup waits. They do not add a clock or recurring frame loop.
- `decodePreparedImage()` and `releasePreparedImage()` transport already-selected
  URLs. `createPreparedImageStore()` adds mount-local deduplication and explicit
  release for ordinary assets. Keep row/neighborhood/group eviction policy in
  the object. Retiring one image must not prevent sibling cleanup if it throws.
- `bindSpeedControl()` publishes the established five-state speed cycle and
  reports failed rate application. It never grants playback or starts animations.
- `createLatestSelection()` separates asynchronous `prepare({ isCurrent })` from
  synchronous `commit(value)`. Keep one immutable desired snapshot for coupled
  controls. Guard nested asynchronous cache work with the same request identity.
  Restore desired state to the last committed snapshot on a current preparation
  failure; a stale failure cannot reset newer controls or clear their busy state.

`ready` rejects a live startup failure and settles promptly after destruction,
even if a native decode or frame never completes. Do not dispose inside an inner
startup catch and then wrap that same work in a cancelling outer wait: that can
turn a real rejection into apparent cancellation. Recoverable lens preparation
failures remain local and retryable. Unexpected partial publication or speed
application calls `onError(error)` and stops immediately; the router may destroy
the mount synchronously. Cleanup finishes every owner, reports aggregate cleanup
errors, and preserves the original failure. Cancellation releases ownership; it
does not promise that Chrome stopped decoding or reclaimed physical memory.

Pluto is a compact example of ordinary image ownership. Earth demonstrates a
bounded row cache; Uranus demonstrates nested material preparation; Saturn
demonstrates a coupled presentation snapshot and keeps its existing native
animation wrapper. These are examples, not renderer templates.

All planet cameras follow the established Saturn interaction behavior:

- dragging down moves toward top-down;
- dragging up moves toward the lower view;
- horizontal dragging does not add horizontal orbit;
- wheel direction and zoom bounds remain consistent;
- in portrait orientation or at widths up to 820 pixels, vertical page flow remains available with
  `touch-action: pan-y` and wheel zoom is disabled.

These are observable behavior requirements. They do not prescribe a camera
bank, matrix representation, default composition, or renderer implementation.

Add one record to `site/objects.mjs` with a factual `classification`, the exact
route `/<id>/`, and a lazy scene loader. `site/object-adapter.mjs` is the single adapter for the Sun,
planets, and any future renderable object; it must not contain an object-specific
branch.
Add a thin `site/pages/<id>.astro` route that renders the object-owned page.
The registry rejects missing loaders and route mismatches.

Search includes every registry entry, including the Sun. The logarithmic planet
scale selects `classification === "planet"`; it has no object-id allowlist.
Classification never turns off interaction or lifecycle tests.

Each package supplies `tools/navigation-marker.mjs`: pinned source, preparation
recipe, and marker presentation. Run `pnpm prepare:navigation` after a registry
or marker change. It prepares the common raster atlas and shell presentation
module together. Missing or invalid descriptors fail; no planned-object fallback
exists. Both shell marker views use the same prepared package data.

## Object, renderer, and shell boundaries

`site/object-schema.mjs` validates one open-ended renderable-object record.
`site/objects.mjs` is the only registry. Solar distance is ordinary object
metadata used by the navigation presentation; it does not create another
registry or adapter. The package contract independently validates the owned
source, preparation, runtime, page, browser profile, assets, and tests of each
registered object.

Every registered object uses the shared shell. Introduction, facts, charts,
lenses, settings, and credits are capabilities supplied by its package. A
capability with no supplied data produces no placeholder section. Shared
Settings, Motion, and high contrast always exist, even without object extras.
An absent lens list produces no lens panel. The
wordmark, typography, panel layout, chart presentation, navigation, fixed
GitHub action, responsive behavior, and shell controller stay shared.

`site/layouts/PlanetLayout.astro`, `site/site.css`,
`site/scene-contract.mjs`, `site/object-adapter.mjs`, and
`site/scene-router.mjs` are shared. They provide navigation, the stage,
loading, one active mount, and lifecycle handling. They must not import a
planet renderer or contain planet-prefixed panel rules.

Saturn's rings, moons, weather, lighting banks, orbit preparation, and CSS are
examples of Saturn's needs. They are not shared APIs and are not requirements
for another planet.

An optional prepared capability belongs in `src/platform/` only when its data
and runtime contract remain planet-neutral. Orbit guides are one example: the
platform owns the validated prepared schema, vector-circle preparation,
retained-leaf mounting, conic hit testing, input lifecycle, and cleanup. The
object package supplies its own body data, asset names, CSS, visibility policy,
and preparation command. A package without orbit guides imports and mounts none of
this capability, and the required planet lifecycle contract does not change.

Repository-level `tools/` contains only planet-neutral orchestration and shared
preparation helpers. Planet-specific acquisition, preparation, audit, capture,
and trace commands stay inside that planet's `tools/` directory.

Every registered object package provides `tools/acquire.mjs`. Its non-mutating
`--verify-only` mode proves the complete local source closure. Normal
acquisition restores intentionally untracked pinned inputs. `--refresh` may
contact upstream authorities, but it publishes a file only after its pinned
size and hash pass, using a temporary file and atomic rename.

## Proof map

`site/scene-contract.mjs` is the shared behavior declaration.
`requireSceneLifecycle()` checks only the returned object shape. The claims are
earned by the lower-level owners and executable proofs below.

| Shared claim | Lower-level owner | Executable proof |
| --- | --- | --- |
| One authority combines readiness, Motion intent, visibility and reduced motion, including startup and restoration. | `site/runtime-policy.mjs`, `site/scene-router.mjs` | `site/test/runtime-policy.test.mjs`, `site/test/router-runtime.test.mjs`, `site/test/runtime-playback-browser.mjs`, `site/test/runtime-bfcache-browser.mjs` |
| Cancellation settles pending work, partial failures clean every owner, and stale callbacks cannot publish. | `src/platform/scene-lifetime.mjs`, object clients | `src/platform/scene-lifetime.test.mjs`, `src/planets/moon/test/runtime-coordination.test.mjs`, `src/planets/earth/test/runtime-lifetime.test.mjs`, `src/planets/saturn/test/runtime-coordination.test.mjs` |
| Prepared transport deduplicates live requests and retries failure without changing object cache policies. | `src/platform/prepared-image-store.mjs`, object-owned caches | `src/platform/prepared-image-store.test.mjs`, package cache tests, lens rejection/race browser conformance |
| Speed is separate from playback permission; only current successful selection work commits. | `src/platform/planet-feature-controls.mjs`, `src/platform/latest-selection.mjs` | Their colocated tests, object compound/nested selection tests, retained-interaction browser conformance |
| Actual content drives optional lens and extra-setting proofs without weakening existing coverage. | Package `site/control-content.mjs`, `site/test/load-browser-profile.mjs` | Control-content/profile fixtures, package contract tests, `site/test/planet-browser-conformance.mjs` |
| One open-ended object registry contains the Sun and current planets, and every record has a canonical route and lazy scene loader consumed by one generic adapter. | `site/object-schema.mjs`, `site/objects.mjs`, `site/object-adapter.mjs` | `site/test/object-schema.test.mjs`, `site/test/planet-shell.test.mjs` |
| Every registered object package has the required source, preparation, runtime, page, browser-profile, and asset files. | `tools/object-package-contract.mjs` | `site/test/object-package-contract.test.mjs` |
| Checked source bytes and provenance form a complete, safe closure. | `src/platform/source-manifest.mjs`, each package's `source/manifest.json` and `tools/acquire.mjs` | `pnpm acquire:planets -- --verify-only`, `src/platform/source-manifest.test.mjs`, package preparation tests |
| Prepared public assets exactly match each package-owned runtime inventory. | `src/platform/runtime-asset-closure.mjs`, each package's `runtime-asset-inventory.mjs` and `runtime-assets.json` | `src/platform/runtime-asset-closure.test.mjs`, `site/test/object-package-contract.test.mjs`, `pnpm build` |
| Shared preparation transport is safe, while preparation order and rendering data remain object-owned. | `src/platform/preparation-runner.mjs`, each package's `tools/prepare.mjs` | `src/platform/preparation-runner.test.mjs`, `pnpm prepare:planets`, `pnpm test:planets` |
| One shared shell and router own loading, readiness, visibility pause and resume, teardown, restoration, and one active mount. | `site/components/PlanetShell.astro`, `site/planet-shell-client.mjs`, `site/scene-router.mjs` | `site/test/planet-shell.test.mjs`, `site/test/smoke-browser.mjs` |
| Every object package obeys the same camera direction, mobile input, canonical high-density asset, lifecycle, one-scene, one-camera, retained-node, and no-external-request behavior at browser DPR 1 and DPR 2. | Object-owned runtime clients and browser profiles, interpreted by `site/test/planet-browser-conformance.mjs` | `pnpm test:browser:conformance`, `pnpm test:browser:planets` |

`pnpm test:platform` owns platform, navigation, and root tool unit tests.
`pnpm test:shell` owns catalog, shell, router, and orchestration tests.
`pnpm test:planets` runs every registered object's discovered tests.
`pnpm test` runs all three lanes.

## Completion proof

Before marking a planet implemented:

1. Run `pnpm acquire:planets -- --verify-only` and the complete `pnpm test`.
2. Run `pnpm build`.
3. Run `pnpm test:browser <served-worktree-url>` in installed Chrome. Standard
   and doubled display scaling must load the same highest-density asset bank.
4. Capture focused visual evidence against that planet's accepted baseline.
5. Confirm the browser makes no source-authority requests and adds no
   unapproved runtime dependency.

The shared conformance proof also requires one retained planet scene and one
camera, no canvas or scene SVG, stable base-node identity, bounded declared
on-demand DOM growth, decoded visible assets before readiness, working pause
and resume, idempotent destruction, clean persisted restoration, and the
shared camera and mobile behavior above.

Root preparation, Node tests, focused browser smokes, and production assembly
must discover every implemented planet from the catalog. Do not maintain a
second manual list of implemented planets in package scripts.

If any source, route, loader, lifecycle method, owned file, prepared output, or
proof is missing, leave the planet unimplemented and out of the registry.
