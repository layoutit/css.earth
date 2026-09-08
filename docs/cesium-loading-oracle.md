# Cesium loading oracle

This development harness compares cssEarth's prepared map owner with Cesium's
actual imagery and quadtree pipeline. A shared timeline connects camera state,
network requests, pending work, readiness, fallback, publication and captures.
Cesium's renderer is used inside `tools/cesium-oracle`. The application also
uses `@cesium/engine` Core math and licensed helpers for the surface minimap
and view readout. cssEarth owns its prepared traversal and CSS rendering; the
Cesium renderer is not mounted in the product.

```sh
pnpm oracle:cesium --dpr=1
pnpm oracle:cesium --dpr=2
pnpm oracle:cesium:serve output/playwright/cesium-explore-dpr1-<run>
```

Open the printed local report URL. The default captures one continuous take:
search for Buenos Aires, follow the app's flight, zoom out to the surrounding area,
pan along the coast, and take a closer look. Both renderers occupy the same browser
page. Cesium follows the CSS geographic view on each animation frame.

The report plays an actual video. Its media clock drives pending requests,
page/imagery states and ancestor relationships; the timeline slider seeks the
video. Timestamped Chrome screencast frames remain in `frames/`, with hashes and
capture times in `frames.json`. The 30 fps MP4 preserves their elapsed time at
normal speed, including capture stalls. A 256 MiB / 2,400-frame limit bounds the
raw recording. This default route adds 350 ms to each fixture imagery response.

`pnpm oracle:cesium:stress --dpr=1 --delay=500` retains the earlier mechanical
loading scenario, with separate browser contexts, a 200 ms camera follower and
still checkpoints. Its still timeline is not continuous video. That runner also
accepts `--replay` and `--smoke --drain=2000`; those switches do not apply to the
default continuous take.

## Source and request identity

The acquirer pins Cesium **1.145.0**, upstream commit
[`845a06b71d37a38604a8045a479dd3567453009a`](https://github.com/CesiumGS/cesium/tree/845a06b71d37a38604a8045a479dd3567453009a),
and checks the npm archive's SHA-512 before extracting its unmodified browser
build. The archive, bundle and original license hashes are recorded. Original
Cesium and third-party notices remain beside the local build. No ion token,
paid imagery or hosted terrain is required.

The imagery URL template comes from Earth's prepared normal-imagery descriptor:
ESA WorldCover RGB 2021 through Terrascope WMTS. The
[Cesium WMTS provider](https://cesium.com/learn/cesiumjs/ref-doc/WebMapTileServiceImageryProvider.html)
uses the same tile matrix labels and original PNG URLs. A bounded recording
fixture shares exact response bytes across both renderers and stores their hashes,
headers and acquisition dates. It admits at most 2,048 images and 64 MiB, with a
327,680-byte envelope per 256-pixel PNG. Cached response hashes are rechecked.

The stress runner's `--replay` prohibits new upstream imagery requests: any missing response makes
the capture incomplete. It reuses recorded imagery, not a deterministic input
tape. A changed view or DPR can require another bounded recording pass. Both
modes impose the chosen **per-response delay**, not a simulated aggregate
bandwidth. First acquisitions add real provider latency. Neither mode measures
provider speed, Cloudflare cost or product performance. Prepared geometry uses
the existing checkout's local mirror; its release is not rebuilt or uploaded.

## What is observed

| Layer | Evidence |
| --- | --- |
| Browser transport | CDP request start, URL, range, initiator type, headers, protocol, cache flags, finish, encoded transfer count, failure and cancellation |
| cssEarth imagery | Shared image acquisition/reuse, body receipt, native decode start/end, consumer release and owner eviction |
| cssEarth paging | Desired page groups and lineage, auxiliary ancestors, metadata queue, active loads, decoded slots, CSS visibility binding, publication and release |
| Cesium imagery | Every observed `Imagery.state` transition, source tile identity, request state, texture presence, reference count and cache eviction |
| Cesium traversal | High/medium/low terrain queues, load priority, selected terrain cut, wanted imagery and attached ready ancestor per terrain tile |
| Cesium drawing | Image identities resolved from texture bindings in globe commands submitted to the scene command list |

The private hooks are tied to the verified build and fail if required methods or
source anchors drift. They delegate to the original methods without replacing
selection or request policy. cssEarth's hooks are applied only by the oracle's
isolated Vite server; application source is not instrumented in production.

Cesium's
[`Imagery`](https://github.com/CesiumGS/cesium/blob/845a06b71d37a38604a8045a479dd3567453009a/packages/engine/Source/Scene/Imagery.js),
[`TileImagery`](https://github.com/CesiumGS/cesium/blob/845a06b71d37a38604a8045a479dd3567453009a/packages/engine/Source/Scene/TileImagery.js),
[`RequestScheduler`](https://github.com/CesiumGS/cesium/blob/845a06b71d37a38604a8045a479dd3567453009a/packages/engine/Source/Core/RequestScheduler.js)
and
[`GlobeSurfaceTileProvider`](https://github.com/CesiumGS/cesium/blob/845a06b71d37a38604a8045a479dd3567453009a/packages/engine/Source/Scene/GlobeSurfaceTileProvider.js)
define those observations. `RECEIVED`, `TEXTURE_LOADED`, `READY`, attached
fallback and submitted texture are separate facts. A cached `UNLOADED` ancestor
is not counted as queued demand merely because it exists. Request deferral is
recorded separately from an active HTTP request. Submitted commands and CSS
publication still do not prove that every pixel contains valid source coverage.

## Camera and proof limits

The scenario uses real search selection, wheel packets and dragging in
cssEarth. Cesium follows CSS view state; its input controller is disabled
for this controlled comparison. This does **not** test native Cesium input feel.
Camera publications and samples have separate monotonic clocks mapped to epoch
time. In the continuous take, camera following runs on the shared browser
animation loop; CSS state is sampled at 200 ms and Cesium state at 100 ms. Each
video frame retains its actual capture timestamp. Samples describe the latest
observed state, not an invented state between observations.
The observer, dual renderers and recordings add overhead.

Registration uses the prepared regular faces' geographic homographies and the
actual CSS projection. Six prepared cardinal locations establish one fixed
geography-to-body basis and equatorial radius. Orientation comes directly from
the published CSS transform; its row scales and CSS perspective determine the
reference lens. Face texture Jacobians never determine orientation or zoom:
their changing distortion had produced artificial tilt and scale bobbles.
The reference camera is translated to keep the same geographic center, with
distance derived from that point's actual CSS depth. Flat-face distortion remains
an explicitly measured difference. Direct vectors avoid the loss introduced by
a distant-view heading/pitch/roll conversion.
The reference canvas occupies the visible content region beside the card.
cssEarth can still select imagery beneath its card, so tile counts are not equal
units of visible coverage.

Every registered sample records geographic anchor residuals. The anchor grid
shrinks to the projected globe extent at distant views, so its outer samples do
not all miss the globe. The run requires the center residual to remain below one
CSS pixel; other anchors expose off-center projection differences. Their maximum
is printed in the continuous report, with no pixel-parity claim. This first route covers a globe flight to
Buenos Aires and a regional/city exploration. The stress runner adds repeated
reversals. The calibration currently
requires a regular face at the view center; polar-cap registration is not
qualified. NASA's base globe in cssEarth and Cesium's WorldCover overview are
different images. There is no pixel-parity pass or global qualification claim.

Continuous capture completion requires attached timelines for both renderers,
subpixel center registration, no follower/renderer errors or trace overflow,
stable source hashes throughout the take, successful image-fixture delivery and
video duration within 150 ms of the raw frame interval. The stress runner also
asserts imagery receipt/texture stages, mapped draw-command textures and CSS
decode/publication observations. Both reports retain those lifecycle details.
App and harness hashes, prepared-face hash, release identity, browser, DPR, actual
policy values, inputs and raw events are stored in `report.json`. Do not edit
watched checkout files during capture: a Vite reload detaches the recorded scene.
