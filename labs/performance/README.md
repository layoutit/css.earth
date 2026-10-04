# Performance captures

Tools that record and read performance evidence from the running application: iOS Simulator and iPad WebKit captures, and Chrome traces from `navigation-capture.mts`. Processing is local. Run the tooling checks with `node --test "labs/performance/*.test.mts"`.

## Cold tests

A cold test of first-visit bytes and load time needs a production build, but only of the pages it opens. `CSSEARTH_BUILD_PAGES` names them, comma-separated as `/` and `/<id>/`:

```sh
ASSET_ORIGIN=https://earth-assets.lowpoly.cc pnpm prepare:catalog
ASSET_ORIGIN=https://earth-assets.lowpoly.cc CSSEARTH_BUILD_PAGES=/,/earth/ pnpm exec astro build
pnpm preview --host 0.0.0.0
```

The build prerenders those pages and the navigation fragment, first view and prepared object of the scenes they mount; every other data route and fragment still builds. On 2026-09-30 it took 146 s against 318 s for every page: prerendering fell from 3 min 22 s to 19 s, and the remaining time is bundling. The bundles and every file it writes match the full build's byte for byte. A link to a page it did not build answers 404, and a name that is not an object's page stops the build. Unset, every page builds.

## iOS Simulator

`ios-capture.mts` records one moment of the site in Safari on the booted iOS Simulator:

```sh
node labs/performance/ios-capture.mts --name typing --open http://127.0.0.1:4261/ --settle 25 --steps steps.json --dist dist
node labs/performance/ios-capture.mts --name by-hand --seconds 15
```

It needs Xcode, `ios_webkit_debug_proxy` and AXe (`brew install cameroncooke/axe/axe`). Steps are a JSON list of `{ "tap": [x, y] }`, `{ "type": "text" }`, `{ "drag": { "from": [x, y], "to": [x, y], "seconds": 1.5 } }`, `{ "wait": seconds }`, `{ "screenshot": "name" }`, `{ "viewport": "name" }` and `{ "probe": "name" }` (records the scene router's state, the route and the page's element count), in simulator points, sent as real touch input.

- `--open` loads the page in the visible tab, waits until the app reports its body ready, then until the page has been quiet for a second (no file finished loading, no frame over 20 ms), for at most `--settle` seconds. It waits for a changed document clock and the requested route, so an outgoing page cannot satisfy it.
- `--no-cache` requests a cold load; otherwise Safari keeps its cache as a visitor's would.
- A `screenshot` is the full device or simulator screen (`.screen.png`); a `viewport` is only the Web Inspector page image (`.viewport.png`). A device screenshot fails if the native screen service is unavailable; it never falls back to the page image. Check the screenshots before reading any numbers: a tap on the wrong control records the wrong moment.
- `--native page` (the default) traces only the web content process holding the page. `--native all` records every process on the Mac, for compositor and GPU questions; its trace is several times larger. `--native off` skips it. A recording that fails to stop within 30 s is killed and the report says so.

For JavaScript names, build with source maps: `CSSEARTH_PERFORMANCE_SOURCEMAPS=1 pnpm build:renderer`, then `astro build --mode performance`, and pass that output as `--dist`. Output goes to `output/performance/ios-captures/<name>-<time>/`: `report.json`, a `README.md` summary, `native.trace` (open it in Instruments) and the screenshots.

The simulator runs on the Mac's CPU and GPU, so absolute times are not a phone's. Compare builds with the same steps.

### Comparing builds

`--compare <capture dir>` pixelmatches each screenshot against the one with the same name in an earlier capture and writes `<name>.diff.png`; a change that should not show must report 0 differing pixels. The status-bar clock is pinned to 9:41. Take a screenshot only once the view has settled.

`--compare <name>` treats every earlier capture called `<name>-<time>` as a baseline and writes a before/after table of means to `comparison.md`. `--runs <n>` repeats the capture; one run varies, so compare three against three:

```sh
node labs/performance/ios-capture.mts --name drag-before --runs 3 --open http://127.0.0.1:4261/itokawa/ --steps drag.json
node labs/performance/ios-capture.mts --name drag-after --runs 3 --open http://127.0.0.1:4261/itokawa/ --steps drag.json --compare drag-before
```

The dev server must be idle while it measures: a server busy with a bake or a file-watch storm serves an error page, and every number from that run is wrong.

### Recording a hand and playing it back

Every capture writes `input.json`: each pointer event the page received and the camera state on every frame. `--replay <capture dir>` plays that input back in place of steps, so two builds see the same hand. Compare a replay with another replay of the same input, not with the recording. On the simulator the replay dispatches the recorded pointer events in the page at their recorded times.

### Recording initial scene mounting

`ios-capture.mts --device --cold-load --open <same-origin URL> --steps <steps.json> --screens --name <name>` starts Timeline, Network and native frames before a WebKit `Page.reload(ignoreCache: true)`, then waits for the new document and scene readiness. It needs an already-visible tab on the same origin and rejects debug and replay hooks. Keep normal resource sharing enabled: adding `--no-cache` can refetch the same CSS texture separately for hundreds of faces. Cache bypass is a request, not proof of a cold load: check `Network.responseReceived.response.source` in the raw recording, where `memory-cache` means bytes were reused.

## A real iPhone or iPad over USB

For a local iPad preview, open Safari on the unlocked device and enable Settings > Apps > Safari > Advanced > Web Inspector. Run `pnpm ipad` (or `pnpm ipad --route /jupiter/`). It starts the dev server on the Mac's LAN, navigates the existing Safari tab and confirms its URL. It reuses a server on port 4210 only if that server belongs to this checkout. `--open-only` uses an already running server; `--port` and `--address` override the defaults.

`--device [udid]` records a device instead of the simulator. Trust this Mac, keep the device unlocked (Auto-Lock off while plugged in) with the page open in Safari, and start the dev server on the network (`pnpm exec astro dev --host 0.0.0.0 --port 4210`). An `--open` path that starts with `/` loads from this Mac's address (`--origin` overrides it):

```sh
node labs/performance/ios-capture.mts --device --name ipad-drag --open /jupiter/ --seconds 15
node labs/performance/ios-capture.mts --device --name ipad-replay --open /jupiter/ --replay output/performance/ios-captures/ipad-drag-<time> --compare ipad-drag-before
```

Touch steps need the simulator; on a device, script steps move the camera. For an iPad visual failure, first inspect the existing recording and its images without touching Safari:

```sh
pnpm ipad:inspect output/performance/ios-captures/<capture-directory>
```

Captures without an image receipt say `source unrecorded`; inspect those images directly. A device screenshot step needs `--open <url>` or `--expect-url <url>`; the capture checks the visible Safari page's origin and path first. For a fast still without starting a trace:

```sh
pnpm ipad:screen after-flight --device --expect-url http://192.168.0.8:4212/lutetia/
```

This writes a full device PNG and a source receipt under `output/performance/ios-stills/`. A single grab can take seconds; for a moving flight, use the native `--screens` filmstrip. `--screens` perturbs frame timing, so leave it off for performance comparisons. Capture one origin at a time: loading another origin moves Safari's page to a new process and drops the inspector session.

[pymobiledevice3](https://github.com/doronz88/pymobiledevice3) adds what Web Inspector cannot see (`pip install pymobiledevice3`, then `--pymobiledevice3 <path>` or `PYMOBILEDEVICE3`; Developer Mode on the device). With `--device-monitors` a device recording samples Core Animation's frames per second and the memory of Safari's web content processes into `device-graphics.jsonl` and `device-webcontent.jsonl`; they are off unless asked for, because starting them was 3 s of every capture and the device's system monitor works for them while the page is being timed (2026-10-04). A device `--replay` plays the recorded path as real touch through its CoreDevice HID service (`device-touch.py`), after three calibration taps.

#### Where a device capture's time goes

`--stage-timing` prints each stage of a capture. A one-second capture of Earth from the dev server on the iPad, measured
on 2026-10-04:

| Stage | With `--open` | Page already open |
|---|---|---|
| The page reloads until the app reports ready | 1.3 s | none |
| The settle after `--open`: until the page is quiet for a second, at most `--settle` seconds | 1 s | none |
| The steps (`[{"wait": 1}]`) | 1 s | 1 s |
| Attaching, recorder setup, final probes and report | about 0.9 s | about 0.8 s |
| **Total** | **4.2 s** | **1.8 s** |

The device's Web Inspector proxy keeps running after the capture that started it, so the next one attaches at once: a
proxy started right after the last was stopped took up to 8.5 s to list the device's pages.

Every capture ends with a `Capture time:` line naming the stages that took over half a second. The native recorder
(`--native page` or `all`) is the dearest: on 2026-10-04 it added 5.6 s before a one-second capture's trace started and 20 s
after it, to stop and export, and its processes used three times the page's own CPU while it recorded. Use it for a
question that needs WebKit's own stacks, and count late frames without it.

To iterate on one view, open the page once and leave out `--open`. Use `--open` only when a fresh load is the subject:
startup, or two servers compared behind the same URL. After switching servers, Safari can run the previous build's
cached modules on the first load. Check a probe that tells the builds apart, and discard that run.

The recorder waits for events rather than fixed times. Memory endpoints wait for WebKit's first tracking update. The
tracker drain waits for 100 ms of socket quiet. Layer-tree lookups are pipelined. The checkout's `git status` skips
untracked files. Before these changes it spent about 9 s of every capture on sleeps and serial round trips.

A cold dev load of Venus used to take 7.3 s on the iPad. Every page imported all 2,071 prepared files of the 29 context
objects as one `?url` module each. Safari needed about 4 s to resolve them, and no frame rendered until it had.
`site/prepared-context-objects.mts` now lists those files from each object's inventory, as the asset-origin build
always did. The load takes 3.3 s with 263 requests instead of 2,335.

### Counting late frames: the page times itself

A capture that records the device changes what it measures: with the native recorder attached, the capture's own
processes (the tunnel, the Instruments hub, the system monitor, the Inspector's samplers) used 16 to 17 ms of the iPad's
CPU a frame, against 5.4 ms for the page's main thread, and some of the late frames in such a capture were theirs
(2026-10-04). So late frames are counted with nothing attached:

```sh
pnpm ipad:timed --open /earth/ --origin http://192.168.0.8:4293 --name far-zoom
```

It installs a wheel program in the page (out of the subject and back, twice, unless `--program` gives another), leaves
for the run, and comes back for the record: every frame's time, how long the page's frame callbacks ran, and for each
frame over 25 ms the hand-over, the files that arrived and the timers over 8 ms in it. It prints the summary and saves
it as `self-timed.json` beside the reading capture. Use a profiled capture to name what runs in a frame; never to count
late frames, or to judge a change by their count.

### Repeatable journeys on the connected iPad

`pnpm ipad:run` opens the start route in visible Safari, attaches Web Inspector, and runs ordered actions while WebKit tracing and native iPad screen grabs are active. It targets this checkout's dev server on the Mac LAN (port 4210, launch.json `ipad-root`) and starts it when none listens, so a code change is one reload away. `--built` targets a performance build instead (port 4212, rebuilt when stale, about 4 minutes): use it for load and byte questions, not frames. Safari needs Remote Automation (Settings → Apps → Safari → Advanced):

```sh
pnpm ipad:run --start mars --fly moon --name mars-to-moon
pnpm ipad:run --start ceres --zoom -200 --drag '{"from":[400,500],"to":[600,530],"seconds":1}' --fly venus --name ceres-to-venus
pnpm ipad:run --start earth --fly lutetia --heap-snapshot --name earth-to-lutetia-memory
pnpm ipad:run --live --start earth --fly lutetia --name live-earth-to-lutetia
```

- Actions: `--tap '[x,y]'`, `--drag '{"from":[x,y],"to":[x,y],"seconds":1}'`, `--type text`, `--zoom <pixel-delta>` (negative zooms in), `--fly <object>`, `--wait <seconds>` and `--screenshot <name>`. Coordinates are Safari viewport CSS pixels. `--tail <seconds>` (default 2) lets the last handoff finish.
- `--scenario journey.json` runs a longer sequence: `{"start":"ceres","actions":[{"zoom":-200},{"fly":"venus"},{"wait":2},{"screenshot":"after-venus"}]}`.
- `--live` targets `https://css.earth` (or an explicit HTTPS `--origin`) without building. `--origin http://<Mac-LAN-IP>:<port>` sets a different preview port.
- `--heap-snapshot` writes `heap.before.json` and `heap.after.json` around the journey. A zero resource-owner count alone does not prove every allocation was freed.
- `--style-writes` records DOM writes to `style-writes.json`, aligned with the `cssEarth:capture:style-writes-start` trace marker. It adds overhead. When styles spike without a DOM write, inspect listener lifetimes: adding or removing a document wheel listener can invalidate the whole scene.

Flights use the app's own `objectnavigationquery` and `objectnavigate` events and verify the destination is ready and visible. Tap, drag, type and zoom are page-dispatched through the app's input handlers, not native touch: this iPad's iOS 26.6 refuses CoreDevice HID remote touch. `screens/*.jpg` and `filmstrip.png` come from the actual iPad screen. Each journey records WebKit memory categories over time and `residency.json` snapshots of scene resources before and after each action. These are WebKit's accounting categories, not total process memory.

### Release gate: cold loads on a slow connection

Run this on the connected iPad before calling a build a release candidate. It serves a running production preview
through a proxy that holds the world summary back, cold-loads each page in visible Safari one after another, and exits 1
when a load does not start. Safari failed this way on a slow connection while headless WebKit and Chromium passed.

```sh
node labs/performance/ipad-slow-start.mts --target 4216 /earth/ /itokawa/ /comet-67p/ /trappist-1b/
```

### Debug exports

`pnpm ipad:run --debug ...` records the DOM-to-compositor chain. It is diagnostic; use a normal run for frame-time comparisons.

```sh
pnpm ipad:run --debug --start earth --fly lutetia --screenshot arrived --name lutetia-mount-debug
```

It writes `causes.json` (DOM, style and listener calls with stacks and node IDs), `layers.jsonl` (native layer snapshots), `compositor-checkpoints.json` (computed styles and boxes at arrival and at the end) and `analysis.json` with a paint and image-decode lane. Layer IDs and Inspector node IDs must never be joined by array position; the page-side retained node identity provides that link. Native snapshots are asynchronous observations, not proof that pixels reached the screen.

The capture writes the page's script samples as `javascript.cpuprofile` and `javascript.callers.cpuprofile`. The iPad returns a recording's first samples in order but without a time; `placeUntimedSamples` places each by the script time before it, which the profiler's script spans give. A sample's place is therefore good to a frame or two, not to the millisecond. Native stacks name WebKit's functions only: script frames in them are addresses, and these samples are how a frame's script is named.

`--debug --native page` adds the Instruments Time Profiler, filtered to the WebContent process; `--debug --native all` keeps every process, for commit stalls. `ios-capture.mts --rebuild <capture>` reprocesses existing native recordings with symbols and rewrites the script profiles. On a physical iPad, native profiling holds a `pymobiledevice3 remote start-tunnel --native` connection for the recording. A saved Instruments file whose end reason reports a disconnect is rejected as native coverage. Inspect native export errors and sample coverage before drawing native-stack conclusions; sample weights do not partition elapsed commit time.

## Chrome traces

`navigation-capture.mts` records a Chrome trace and recorder metadata. Use the same saved `CSSEARTH_CAPTURE_ROUTE` and `CSSEARTH_CAPTURE_SCENARIO=drag-zoom` for a repeatable drag/zoom comparison, and compare builds one after another. `CSSEARTH_CAPTURE_VIDEO=1` adds video.

For an invalidation investigation, add node tracking and DOM snapshots and keep the gesture short; stacks for thousands of leaves can fill Chrome's trace buffer in a few seconds:

```sh
CSSEARTH_CAPTURE_ORIGIN=http://127.0.0.1:4246 \
CSSEARTH_CAPTURE_DIST=dist \
CSSEARTH_CAPTURE_SCENARIO=world-zoom \
CSSEARTH_CAPTURE_ZOOM_PACKETS=8 \
CSSEARTH_CAPTURE_ZOOM_CYCLES=1 \
CSSEARTH_TRACE_INVALIDATIONS=1 \
CSSEARTH_TRACE_DOM=1 \
node labs/performance/navigation-capture.mts unique-capture-name
```

For a frozen baseline, set `CSSEARTH_CAPTURE_DIST` to the directory its server actually serves. The tool exits unsuccessfully if synchronization, source-file collection, retained ownership or trace completeness fails. Do not compare frame rates from an invalidation-heavy capture with an ordinary trace.

## Subsystem boundary

The lab owns capture orchestration and local trace analysis (A4). The site build
uses its source-map and package-source helpers so captures can recover authored
source locations. This is an intentional build-time dependency; capture and trace
processing do not belong in the running application. A standalone package would
need an actual second host and a defined public API before extraction is useful.

## Device-bound accepted limits

The iPad runner's eager prepared-registry load is accepted because this command starts a device journey against a prepared checkout, rather than exposing an importable host-neutral library. Change it when a second non-device host needs the runner; device/browser lifecycle behavior can only be qualified on the actual device.

The navigation capture harness's preview port/readiness and shutdown lifecycle remain accepted device/browser-bound limits: local mocks cannot establish Safari or browser-process lifecycle correctness. Change these defaults only with a real capture showing readiness and bounded cleanup on the target device/browser; a launched process alone is insufficient evidence.
