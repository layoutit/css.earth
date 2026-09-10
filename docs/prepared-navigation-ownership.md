# Prepared navigation ownership

A selection immediately installs its complete prepared sidebar card. The current
mounted object continues the world-camera flight while the destination prepares.
Preparation produces an image-bank lease and a detached DOM-tree lease. Handoff
claims both once and continues the same numeric flight from its last drawn sample.
There is still exactly one mounted object scene.

| Phase | Owner and work |
| --- | --- |
| Offline object preparation | Source textures, geometry, final DOM records, motion keyframes and timings, immutable leaf planes |
| Package worker | Verify, decode and validate the pinned prepared object document |
| Navigation preparation | Decode a bounded image bank; transport DOM records in detached tasks capped at approximately 2 ms |
| Detail handoff | Transfer existing nodes and images, create explicitly paused animation handles, bind the camera, attach roots |
| Mounted presentation | Publish camera state, select prepared resource addresses and change retained leaf visibility only when it changes |
| Application context | Keep the star selector worker and context DOM across object handoffs |

## Lifetimes

`preparePresentationTree` can be cancelled before or during construction. Its
lease rejects a different document or tree and cannot be claimed twice. After
claim, the mounted scene lifetime owns cleanup; aborting the completed preparation
cannot destroy mounted nodes. The image-bank lease follows the same transfer.

A startup image reservation yields before incoming-view preparation. Ready but
unpublished demand can be replaced without protecting both selections. The bank
commits the incoming view only when claimed. This preserves the prepared capacity
of small lighting pools; it does not increase their capacity to conceal a leak.

Navigation checks the exact last drawn view before handoff. The source keeps
moving while assets and detached nodes become ready. Input cancels a pending
flight through the same signal and keeps the drawn camera. The sidebar is a
separate selection owner, so mounting never replaces it with an intermediate card.

## Explicit native motion

`tools/prepared-presentation-bindings.mts` reads each object's imported authored CSS
in offline Chromium and compiles transform-only native motion, including dataset
specific durations. Both `prepared/runtime.json` and the pinned `prepared/object.json`
contain these bindings. Unsupported keyframes, timing or changing motion membership
fail preparation.

The renderer disables the corresponding CSS animation before attaching nodes and
creates retained native handles directly. Playback owns their time, speed, pause,
resume and disposal. Mount does not call `getAnimations` or read computed styles.
Pose-addressed animation and motion playback retain separate roles.

## Conservative leaf visibility

Only immutable, single-sided leaves receive a prepared plane. Leaves under native
motion, pose, material or transform publishers are excluded. Selection visibility
has its own owner and is also excluded. Double-sided rings remain native.

The physical camera supplies the eye transform through one shared projection
function. The presentation tests prepared planes against that eye and writes
`visibility` only on transitions. It never changes topology, transforms or display.
The compiler also preserves the transform determinant when normalizing each
plane. Chromium's native `IsBackFaceVisible` compares the cofactor times the
determinant against float epsilon, so direction alone is insufficient for tiny
transforms. The prepared tolerance is `2^-23 / (normalLength * determinant^2)`;
runtime scales it using the camera determinant and focal length. A narrow angular
margin additionally leaves grazing raster edges under the browser's ownership.
See the [Chrome 152 implementation](https://chromium.googlesource.com/chromium/src/+/refs/tags/152.0.7977.76/ui/gfx/geometry/transform.cc).

The visual comparison restores native backface handling on the exact same nodes,
textures, camera and clocks. It requires zero changed pixels after pixelmatch's
antialias handling (threshold 0.1); it does not accept a percentage difference.

## Published adapter precedents

The local implementations examined are published adapters on https://css.graphics/,
not the experimental Flowerbox work:

- Cyclone: `src/adapters/cyclone/src/csscyclone/preparedDom.mjs` separates detached
  preparation from attachment, with explicit retained handles.
- Galaxy: `src/adapters/galaxy/src/cssgalaxy/preparedBlockWorker.mjs` splits
  materialization into short tasks and bounds retained banks.
- Menger: `src/adapters/menger/src/cssmenger/preparedPlayback.mjs` uses prepared
  facing schedules to limit lighting writes. cssEarth's free camera uses prepared
  planes instead of a prerecorded orientation schedule.
- PolyCSS Morph: `packages/morph/src/render/preparedDomTarget.ts` caches published
  values and writes only changes to stable targets.

These are ownership precedents. cssEarth does not import an experimental adapter,
change its renderer, derive new scene geometry in a worker, or reduce prepared
texture density.

## Verification

- `pnpm test` and `pnpm typecheck:renderer`
- `pnpm build`
- `node site/test/prepared-bindings-browser.mjs` — registry-derived Chrome DPR 1/2,
  stable nodes and animations, native visual comparisons, actual pause/resume.
- `node site/test/navigation-capacity-browser.mjs` — real bank replacement and
  flights, capacity limits, no resets and retained sidebar.
- `node site/test/navigation-selection-browser.mjs` — delayed package and input
  cancellation, immediate complete card, no intermediate card at mount.
- `node site/test/prepared-worker-production-browser.mjs` — emitted production
  workers, one persistent selector, retired decode jobs, retained document.

Performance evidence belongs to matched route, camera, viewport, DPR and browser
runs. Unit tests and reduced layer counts do not by themselves prove smooth
120 Hz playback. See `output/playwright/mount-architecture/` for the local replay,
trace, screenshots and verification logs from this implementation.

The generator preserves the contents and modification time of unchanged imported
object documents and descriptors. Rewriting those files unnecessarily makes Vite
reload every open app tab once per object. Full builds must run outside the live
serving checkout while someone is using it; browser validation reads existing
outputs and opens its own pages. The binding comparison blocks Vite's development
WebSocket in that test page so external hot reloads cannot invalidate its sample.

## September 7 implementation evidence

Chrome 152 passed all 26 registry objects at DPR 1 and DPR 2. Immutable-leaf
comparisons covered four camera orientations and found zero changed pixels under
the stated pixelmatch settings. The newer Haumea lighting package also passed;
its subsequent material-only update preserved every facing target and ancestor.
The renderer's 204 tests, type checking and 10 focused compiler/contract/publication
tests passed. Earlier navigation checks covered 60 bounded-bank and flight cases,
immediate complete selection, cancellation, and worker lifetime at both DPRs.

A paired 2202 × 1800, DPR 2 Sun-to-Haumea replay disabled only the facing publisher
in the control. All other implementation, camera and assets were shared:

| Measurement | Native backfaces only | Prepared facing enabled |
| --- | ---: | ---: |
| Arrival composited layers | 1749 | 1005 |
| Median Layerize task | 2.556 ms | 1.832 ms |
| Largest renderer main task | 77.220 ms | 68.314 ms |

Both runs completed without application errors or a navigation reset. These are
local headless Chrome samples, not proof of smooth 120 Hz playback. Handoff still
has a substantial browser layout/paint task; the optimization reduces ongoing
compositor work but does not eliminate that remaining cost.

## PR 19 integration validation

The changes were integrated in an isolated checkout on top of PR 19 commit
`4b25b9ddb1e8e9701d295def73cfd3060fb7e8f1`. The existing sidebar, orbit and dwarf
planet changes were preserved. All 26 regenerated runtime documents changed only
their prepared `motion` and `facing` fields, with corresponding descriptor hashes.

The full `pnpm build`, renderer type checking, all 205 renderer tests and every
package test suite passed. The platform and shell runs passed their architecture
and source-closure checks. Initial failures were limited to missing local pinned
inputs and the cwebp executable in the offline install. After restoring those
inputs, all affected test modules passed (8 platform tests and 7 shell tests).
This is component-suite evidence with targeted retries, not a claim that one
fresh aggregate `pnpm test` invocation passed uninterrupted.

Chrome checks on this combined PR checkout passed at DPR 1 and DPR 2: immediate
complete sidebar selection and cancellation; 60 bounded-bank and flight checks;
and emitted production worker checks covering five packages, retired decode jobs
and one persistent star selector. Integration logs are retained locally under
`output/pr19-integration/`. The earlier visual and performance measurements above
remain implementation evidence; the integration run did not repeat those traces.

Builds and validation ran outside the live preview checkout. The earlier Pluto
asset and Milky Way source-closure blockers are resolved in this combined PR.

## Integration with the shared universe on main

PR 19 now incorporates main `b698b01ed93eef440d0ae8e832025fe16bf4a784`
in the isolated `cssEarth-pr19-prepared-runtime` checkout. The retained worker and
resource owners coexist with the prepared NASA sky, Milky Way crossfade and
heliosphere shell. Foreground labels and compact orbit footprints exclude
background captions; the existing Sun indicator also serves as the distant
locator. One alpha fader owns label visibility while hover remains independent.

A real destination mismatch was found during integration: the Sun context still
used Makemake's former radius while its finalized detail frame used the new one.
Object preparation now refreshes dependent contexts after all requested body frames
are final. A registry-wide test compares every context body's radius and origin
with its actual detail frame. Identical context bytes retain their modification
time, preventing unnecessary development reloads.

Native logarithm and power results differed by a last bit between Node 22 and 24.
The offline star compiler now publishes photometry at 12 decimal places and treats
arithmetic uncertainty at a hierarchy-magnitude rounding boundary consistently.
The catalog, hierarchy membership and positions, and texture bytes are unchanged.
Exact prepared JSON and resource reproduction passes on Node 22.15 and 24.19.
The minimum supported Node version is 22.15 because universe preparation uses
native Zstd; the README and engine constraint now state that requirement.

Validation on the combined tree:

- Source verification for all 26 bodies, full production build, renderer and
  preparation type checking, and the aggregate package/renderer/platform/shell
  tests. The renderer has 300 tests, platform 583 and shell 215.
- All 74 universe preparation tests on both Node 22.15 and Node 24.19, including
  exact prepared output reproduction and independent physical-frame checks.
- Production Chrome conformance for all 26 objects at DPR 1 and 2; 66 capacity and
  real-flight checks including Haumea, Makemake and Eris; immediate complete
  selection and cancellation at both DPRs.
- Extended Makemake browser conformance: loading-time Motion/visibility policy,
  native wheel and drag interruption, retained identity, canonical density and
  paused release at DPR 1 and 2.
- Sun/system/galaxy round trip, compact URL restore, physical panorama translation,
  continuous cloud handoff, heliosphere lifecycle, label exclusion and single-click
  Sun navigation. Browser probes follow the shared input gain and Sun overview
  selection rules, and distinguish UI transitions from prepared object motion.
- Emitted production workers: cold destination decoders retire, one selector
  survives navigation, and the document and single mounted detail scene persist.

Logs are retained locally in `output/pr19-merge/`. The earlier paired visual and
performance samples remain scoped to their recorded implementation and hardware;
this integration does not claim to eliminate the remaining layout/paint hitch.
Builds and tests did not modify or restart the user's port 4210 preview.
