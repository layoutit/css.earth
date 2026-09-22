# Trace triage

Run from the cssEarth checkout:

```sh
node tools/performance/trace-brief.mts /path/to/Trace.json.gz
```

The same command is used by the agent. Sending a raw trace is sufficient; users
do not need to preprocess it themselves. Processing is local and opens no browser.

Raw JSON and gzip are parsed as streams, so a decoded recording larger than
V8's single-string limit remains usable. Every event is retained for analysis;
memory still grows with event count. For a multi-million-event recording:

```sh
NODE_OPTIONS=--max-old-space-size=6144 node tools/performance/trace-brief.mts /path/to/Trace.json.gz
```

Run large reports sequentially. The loader validates JSON/gzip completion and
records the compressed SHA-256 and decoded byte count.

## iOS Simulator

`ios-capture.mts` records one moment of the site in Safari on the booted iOS Simulator:

```sh
node tools/performance/ios-capture.mts --name typing --open http://127.0.0.1:4261/ --settle 25 --steps steps.json --dist dist
node tools/performance/ios-capture.mts --name by-hand --seconds 15
```

It needs Xcode, `ios_webkit_debug_proxy` and AXe (`brew install cameroncooke/axe/axe`). Steps are a JSON list of
`{ "tap": [x, y] }`, `{ "type": "text" }`, `{ "drag": { "from": [x, y], "to": [x, y], "seconds": 1.5 } }`,
`{ "wait": seconds }` and `{ "screenshot": "name" }`, in simulator points, sent as real touch input. Safari keeps its cache
as a visitor's would; `--no-cache` measures a cold load. `--open` loads the
page in the visible tab first and waits until the app reports its body ready, then `--settle` seconds more, so each
capture starts from a fresh, loaded page. Check the screenshots before reading any numbers: a tap that lands on the
wrong control records the wrong moment.

`--compare <capture dir>` pixelmatches each screenshot against the one with the same name in an earlier capture and
writes `<name>.diff.png`; a change that should not show must report 0 differing pixels. Antialiased pixels count, and
the status-bar clock is pinned to 9:41 during every capture so it never differs. Take a screenshot only once the view
has settled: one taken mid-flight differs with the flight's timing.

The native trace records only the simulator's web content process holding the page (`--native page`, the default).
`--native all` records every process on the Mac, for compositor and GPU questions; its trace is several times larger and
its export alone takes about 14 s. `--native off` skips it. A recording that fails to stop within 30 s is killed and
the report says so.

For JavaScript names, build with source maps: `CSSEARTH_PERFORMANCE_SOURCEMAPS=1 pnpm build:renderer`, then
`astro build --mode performance`, and pass that output as `--dist`. Output goes to
`output/performance/ios-captures/<name>-<time>/`: `report.json`, a `README.md` summary, `native.trace` (open it in
Instruments) and the screenshots. The report holds JavaScript samples for the page and each worker, timeline time by
record type and rendering frames, CPU per thread, memory by category after collection before and after, console
messages, network requests, and the Time Profiler summary for Safari's web content process.

The simulator runs on the Mac's CPU and GPU, so absolute times are not a phone's. Compare builds with the same steps.

## Chrome traces

For internal measurements, `navigation-capture.mts` records a Chrome trace and
recorder metadata without screencasting or video encoding. Use the same saved
`CSSEARTH_CAPTURE_ROUTE` and `CSSEARTH_CAPTURE_SCENARIO=drag-zoom` for a bounded,
repeatable drag/zoom comparison. Compare builds sequentially. Opt into video
only when needed with `CSSEARTH_CAPTURE_VIDEO=1`. Node invalidation tracking and
DOM snapshots are optional diagnostic captures, separate from timing comparisons.

Outputs go to `output/performance/trace-briefs/<name>-<hash>/`:

- `diagnosis.json`: compact entry point: ranked exclusive costs, worst busy
  interval, largest presentation gap, first scheduling call, node evidence and
  what remains unknown. `INVALID capture` means cross-artifact validation failed;
  `PARTIAL evidence` means some attribution signals are unavailable.
- `agent-brief.json`: ranked busy tasks, exact timestamps, overlapping frame
  intervals, recent inputs, navigation phase and style/layout scheduling stacks.
  It also includes recurring style initiators, JS self-time by exact function
  location, worker message delivery links and source excerpts.
- `report.html`: the averaged chart, cost tables, first style triggers, node
  ownership, recorded phases and links to synchronized video when available.
- `performance.svg`: **one averaged frame-time line per trace**. Each point is
  the arithmetic mean of presentation intervals ending in the preceding 500 ms,
  sampled every 100 ms. The final endpoint is included. Missing observations
  break the line; they are never treated as zero. Lower is better.
- `performance-chart.json`: portable chart series with trace hashes and the
  averaging convention, allowing later reports to share the same chart.
- `performance.png`: the same chart ready to display or share as an image.
- `frame-times.svg`: the unaveraged presentation timeline, retained separately
  so a rolling average cannot hide individual hitches.
- `README.md`: compact text report.
- `analysis.json`: full FrameSleuth analysis for deeper inspection.

The brief deliberately ranks main-thread work separately from long presentation
gaps with little main activity. Idle, worker or GPU waits are not automatically
called CPU stalls. Nested trace slices use union time instead of double counting.
The `costs` section partitions main-thread task time into exclusive categories:
GC, style, layout, prepaint, paint, layers, commit, compile, script and other.
Specific rendering and GC slices take precedence over enclosing JS wrappers;
forced style inside a function is not charged twice. `other` is uncategorized
task time, not idle. Without RunTask coverage it reports the observed slice union
explicitly rather than claiming all main-thread work was captured.
Navigation marks are decoded into request-to-motion, assets-ready, mount and
finish timings, joined by navigation ID. Backdated async measures are excluded.
Chrome's postMessage trace IDs join sends to receives; a nearby input is reported
as context rather than asserted as the cause of the next task.

Style scheduling stacks are joined to the next style pass in the same document.
They identify the call that scheduled work, not every mutation responsible for
that pass. The **first** scheduling call is preserved independently of node
invalidation events. Stacks keep the first eight frames and their original depth,
avoiding enormous repeated async stacks; full trace events remain in the input.
Missing stacks and detailed invalidations are reported explicitly.
CPU functions are grouped by URL, line **and column**, so minified functions with
the same name do not incorrectly share a cost. Sampling estimates self time;
it does not identify the exact statement executing between samples.

Useful options:

```sh
node tools/performance/trace-brief.mts /path/to/Trace.json.gz --url 4243 --build output/playwright/world-bank-site-v2
node tools/performance/trace-brief.mts /path/to/Trace.json.gz --out /tmp/trace-report
node tools/performance/trace-brief.mts /path/to/next-trace.json.gz --label "After change" \
  --compare output/performance/trace-briefs/previous/agent-brief.json
```

Repeat `--compare` to overlay multiple saved traces on **one** chart. Old traces
are not reparsed: their version-3 briefs contain the averaged series. Version-2
briefs must be regenerated once. All lines use elapsed seconds from the selected
trace window start and a shared millisecond axis; gestures are not time-stretched
or silently aligned. The 16.7 ms reference is a 60 Hz reference, not an inferred
device refresh rate. Comparisons flag different browser versions, viewport/DPR,
settings, input protocols, recording overhead and missing metadata. Even the same
recorded protocol is not statistical proof from one run. Raw manual traces remain
useful for descriptive comparisons without claiming identical journeys.

If capture sidecars are beside the trace, the processor discovers them; use
`--capture directory` to specify another location. It checks unique start/stop
recording IDs, renderer identity, both clock anchors and drift, reported trace
data loss, capture errors and the synchronization receipt. Failed captures keep
their trace timings but do not get recorder/DOM/source/video attribution.
No sidecars is a normal trace-only report, not a failed run.

Matched DOM snapshots join invalidation backend IDs **and document frame IDs**
to recorded ancestry. Ownership conflicts between snapshots are marked ambiguous.
Events queued before a pass are separate from during-pass propagation. Counts
are not milliseconds, selector matches or proof that all affected work was
avoidable. Snapshot ancestry is before/after evidence, not a live per-frame DOM.
Recorder context uses the latest preceding sample, with sample age and a stale
flag; it is never presented as exact state at that frame. Video links use the
validated clock metadata; the processor does not inspect video pixels.

`--build` adds hashes and source excerpts at recorded bundle call locations.
If adjacent `.js.map` files exist, it also resolves original source locations
and includes excerpts from the map's embedded source, not the current checkout.
It never fetches scripts from the trace's URLs. Only supply the build that served
the trace; a matching URL name alone is not proof of identical source bytes.
With a matched capture it automatically reads the copied `served/` bundles and
checks them against the capture's size/SHA-256 manifest. A mismatch withholds
source-map attribution. Maps supplied separately are identified as such.
Symlinks outside the supplied build directory are not followed.

`pnpm build:performance` is configured to request renderer and hidden final source
maps. Verify the actual build output: the candidate captured on 2026-09-10 did
not emit final `.js.map` files, so its reports retain generated locations and
explicitly report unavailable original-source attribution. Build configuration
alone is not evidence that source maps reached the served bundle.

FrameSleuth is reused directly from the sibling `cssGraphics` checkout. For a
different layout, set `CSSEARTH_FRAMESLEUTH` or use
`--framesleuth /path/to/cssGraphics/scripts/frame-sleuth.mjs`. The report records
both processor hashes so later runs can distinguish analyzer changes.

Read `diagnosis.json` first, then `agent-brief.json` for the indicated evidence.
The command performs the event joins and source
lookups; do not repeat these manually. Use its evidence when changing the app.
Missing recorder data, screenshots, per-node invalidations or allocation owners
cannot be reconstructed from timing alone. The brief lists those missing signals
instead of filling them with a guessed architectural cause.

Run the focused tooling checks with `pnpm test:performance-tools`.

## Capturing node-level style evidence

The existing capture tool always records metadata, Chrome trace and video.
For a bounded invalidation investigation, add DOM snapshots outside the measured
window and keep the gesture short; stacks for thousands of leaves can fill
Chrome's trace buffer in a few seconds.

```sh
CSSEARTH_CAPTURE_ORIGIN=http://127.0.0.1:4246 \
CSSEARTH_CAPTURE_DIST=dist \
CSSEARTH_CAPTURE_SCENARIO=world-zoom \
CSSEARTH_CAPTURE_ZOOM_PACKETS=8 \
CSSEARTH_CAPTURE_ZOOM_CYCLES=1 \
CSSEARTH_TRACE_INVALIDATIONS=1 \
CSSEARTH_TRACE_DOM=1 \
node tools/performance/navigation-capture.mts unique-capture-name
```

`CSSEARTH_CAPTURE_ROUTE` can supply a saved view URL path. For a frozen baseline,
set `CSSEARTH_CAPTURE_DIST` to the directory its server actually serves, so source
hashes come from that build. The tool exits unsuccessfully if synchronization,
source-file collection, retained ownership or trace completeness fails. Do not
compare frame rates from an invalidation-heavy capture with an ordinary trace;
use node evidence to locate work, then qualify timings separately.


### Idle gaps in comparison charts

The 500 ms average excludes a long interval only when Chrome explicitly disabled
frame requests for at least 80% of it, main work stayed below a quarter of one
frame budget, no active main callback/input is captured inside it, and the
pipeline reports no update desired with no dropped, smoothness-affected or
high-latency frame. Unknown gaps remain. No numerical spike clipping is applied.
The chart lists exclusion counts, and `averageSeries.excludedGaps` records each
omitted interval and reason. Raw frame intervals, percentile metrics and dropped
frame counts remain unchanged. Reprocess older reports to use the same filtering
policy before overlaying them.
