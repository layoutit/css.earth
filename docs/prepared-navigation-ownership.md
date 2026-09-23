# Prepared navigation ownership

Navigation preparation creates an image-bank lease and a detached DOM-tree lease.
Handoff claims each once; the mounted lifetime then owns cleanup. The
[flight lifecycle](flight-lifecycle.md) owns the camera handoff, and
[page transport](page-navigation-transport.md) owns card metadata and decoder jobs.
This guide covers prepared nodes, resource leases, motion and leaf visibility.

| Phase | Owner and work |
| --- | --- |
| Offline object preparation | Source textures, geometry, final DOM records, motion keyframes and timings, immutable leaf planes |
| Package worker | Verify, decode and validate the pinned prepared object document |
| Navigation preparation | Decode a bounded image bank; transport DOM records in detached tasks capped at approximately 2 ms |
| Detail handoff | Transfer existing nodes and images, create explicitly paused animation handles, bind the camera, attach roots |
| Mounted presentation | Publish camera state, select prepared resource addresses and change retained leaf visibility only when it changes |
| Application context | Keep the star selector worker and context DOM across object handoffs |

## Implementation and URL ownership

The CSS renderer owns object mounting, camera navigation, saved-view encoding,
material publication and map paging. Preparation tools use the renderer's
`dist/preparation.js` entry for the same pure matrix, asset-address and prepared
transport helpers used by the browser. These helpers live in `prepared-data/`;
a build-closure test prevents this entry from importing DOM construction or
runtime modules. CSS-specific layout stays with the renderer. Platform tests exercise those renderer
implementations; there is no separate platform mount or codec.

Saved views use one binary format (version 5), with a physical rotation, either
a distance or translated body centre, an explicit epoch and playback state.
Capture has no angular-camera fallback, and restoration requires the same epoch.
Versions 1–4, the former JSON format and the unused Galaxio codec are unsupported. Dataset links
use `?dataset=<id>`; `#dataset=...` is an ordinary fragment and does not select a
dataset. Restoring a valid saved view preserves its token without upgrading it.

The internal renderer build emits ESM only. Publishable package export contracts
are separate from this build target.

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

`tools/prepared/prepared-presentation-bindings.mts` reads each object's imported authored CSS
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

## Open trajectories

For negative semimajor axis and eccentricity above one, the astronomy package
uses the standard hyperbolic Kepler equation. Preparation samples a finite
inbound-to-outbound path through
[prepare-hyperbolic-path.mts](../src/platform/prepare-hyperbolic-path.mts),
marks it `closed: false`, and records `bodyVertexIndex` for the epoch position.
The parser and projector keep its N−1 edges open, including full-path highlighting.
Runtime projects the prepared vertices; it does not derive orbital geometry.

These paths have no periodic trail, finite apoapsis or revolution period.
Parabolic and inconsistent elements are rejected. The drawing extent encloses
at least 600 au and the epoch position; it is a display window, not a physical
boundary or an accuracy claim over that interval. Body source notes must state
the element epoch, frame and limits of the osculating two-body approximation.
See [ʻOumuamua](../src/objects/oumuamua/README.md) for independent Horizons
comparisons and the interpretation used for its model.

## Verification

- `node --test tools/prepared/prepared-activation-registry.test.mts tools/prepared/prepared-activation-transport.test.mts`
  checks activation ownership and cancellation.
- `node --test site/test/navigation-lifecycle.test.mts site/test/scene-session.test.mts`
  checks navigation and retained scene state.
- `node --test site/test/rendered-page.test.mts` parses built Saturn, Earth and
  Mercury HTML for one scene, a camera and prepared texture references. It does
  not run Chrome or verify animation and flight behavior.
- [prepared-object-worker-client.test.ts](../src/renderers/css/prepared-object-worker-client.test.ts)
  in the renderer suite — persistent worker reuse, cancellation and disposal.

Performance evidence needs matched route, camera, viewport, DPR and browser runs.
Unit tests and reduced layer counts do not establish delivered frame rate. Use
an immutable build as described in [flight verification](flight-lifecycle.md#verification).

Preparation preserves the bytes and modification time of unchanged object
documents and descriptors, avoiding unnecessary Vite reloads. The binding
comparison blocks the development WebSocket in its test page to keep hot reloads
from invalidating a sample.

The [September 7 implementation and subsequent integrations](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/prepared-navigation-ownership.md#september-7-implementation-evidence)
retain the original browser, visual and performance results. The
[adapter precedents](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/prepared-navigation-ownership.md#published-adapter-precedents) belong to that design record.
