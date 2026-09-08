# World-context publication during Sun–galaxy travel

The world-context renderer was projecting and publishing every body after the
system had completely faded away. It also sorted body depth and wrote every
group's `z-index` on each camera publication, including pure translation.

The renderer now publishes the zero-opacity transition once, preserving the
existing fade and retiring its hit targets, then updates only the anchor
locator while the system remains hidden. Re-entry resumes the full publication;
restoring navigation indicators invalidates retirement. The prepared nodes stay
mounted throughout. Depth order is retained until camera orientation changes;
selection changes update the detail-layer offset. Translation adds a common
depth offset and therefore cannot change the order.

## Measured scope

Recorded on 2026-09-08 against main `1588a643e6c323879f9debae438440f5e6045e4e`.
Both builds use the same checkout, dependencies, prepared assets and Astro dev
server configuration. Baseline compilation substitutes the HEAD version of
`prepared-world-context.ts`; candidate compilation uses the changed source.
The actual loaded module hashes are retained in each capture's `report.json`.

Headless Chrome Canary 155.0.8043.0; 1995 × 1236 CSS pixels; DPR 2; motion off.
Each run starts at the Sun and receives 384 native wheel events of +6 followed
by 396 of −6, with a hold at galaxy distance. Initial, peak and returned camera
positions match. Input delivery timing differs: the combined movement windows
last 41.174 seconds before and 42.543 seconds after. These are two sequential
instrumented observations, not a statistical benchmark or a wall-time speedup.

| Movement-window measurement | Before | After |
| --- | ---: | ---: |
| World-context `publish` sampled self CPU | 4,919 ms | 2,190 ms |
| World-context `publish` sampled inclusive CPU | 10,524 ms | 7,650 ms |
| Main-thread `UpdateLayoutTree` duration | 5,677 ms | 4,188 ms |
| Main-thread `Layout` duration | 423 ms | 442 ms |
| Main-thread `Paint` duration | 645 ms | 667 ms |
| rAF intervals above 25 ms | 204 / 2,267 | 226 / 2,326 |
| rAF interval p95 | 33.3 ms | 33.3 ms |

This pair demonstrates reduced publication work (55% self CPU, 27% inclusive
CPU) and style recalculation (26%). **It does not demonstrate improved frame
pacing.** rAF intervals are not a count of dropped display frames. Recorder
sampling itself averaged 3.79 ms before and 4.52 ms after at 125 ms intervals;
CPU tracing and screencasting also add overhead. Paint, compositing and the
remaining visible-system work are not solved by this change.

## Capture and behavior checks

Every run contains the native application recorder JSON, Chrome trace gzip and
simultaneously captured video, plus a frame manifest and synchronization check.
The recorder's start/stop User Timing anchors bind the trace to the recording ID.
CDP frame epoch timestamps bind the video to the recorder clock. Video encoding
preserves variable timing and holds the final observed frame until recorder stop.
Clock alignment does not establish screenshot latency or capture every refresh.

| Capture | Baseline | Candidate |
| --- | --- | --- |
| Recording ID | `5969ca99-4f0f-4463-8bd6-77f6c89e1386` | `66d47276-8d5d-4f45-b8e1-c399973aea97` |
| Observed video frames | 2,140 | 2,231 |
| Absolute start/stop clock-offset drift | 61 µs | 42 µs |
| Maximum encoded frame timestamp error | 1.24 ms | 1.59 ms |
| Trace loss / reload during recording / app errors | none | none |

The recording metadata reports one mounted Sun scene, paused animation, 50,358
retained scene nodes and 48,899 leaves throughout both runs. Sun resource state
stays at four decoded images, four allocations, no releases and no pending
material work. World root, input surface and document identities are retained.

The start, galaxy and returned scene screenshots are pixel-identical in the
scene region: device pixels x=720..3989, y=36..2435, excluding sidebar and header/
footer. This is endpoint evidence, not a claim of frame-by-frame pixel identity.

Validation:

- 93 focused universe, stars, labels and picking tests pass, including the new
  retirement/re-entry/indicator-toggle and depth-order invalidation regressions.
- Renderer typecheck, package build and renderer build pass.
- `universe-labels-browser.mjs` passes compact-system decluttering, shell and
  galaxy captions, Sun locator visibility during native drag and Sun-label click
  navigation while retaining the environment DOM.
- `galaxy-handoff-browser.mjs` passes outward/return travel, retained image bank,
  physical panorama translation and continuous background signal.
- Full renderer suite: 337 pass, two fail on Mercury/Venus prepared SHA-256
  checks. Their descriptors equal HEAD; the existing local prepared bytes do
  not match those descriptors. This change does not touch either input, the
  loader or decoder. The aggregate gate is not green in this checkout.

Raw captures remain outside Git in `output/world-context-zoom/baseline-2/` and
`output/world-context-zoom/candidate/`. The earlier `baseline/` attempt failed
before recording and is excluded. Artifact SHA-256 identities:

| Artifact | Baseline | Candidate |
| --- | --- | --- |
| Native recorder JSON | `a0e0f962fb5ee8597e8665eda0b8cf6a2d3a6af9c57ed66d83d3c7e02f029f46` | `67e90f8e28cf87913a155a9458e522a56fe121dffa7afc0da460bf24d14c96a1` |
| Chrome `trace.json.gz` | `b68c04b7077667656b46f031dc10ad0febd0e5e9dff07c32f68b909181fe8764` | `3cdd981c2ff42243f5cb519fb89ebf7c02ad769b9bd48f6ec8d7829a8e3f18a3` |
| `sun-milky-way-sun.mp4` | `41f858a94360259adedc4d52483c5fca363d95adf71aa8c8b6b66fb46bdaa94d` | `6ca3ab05ead31f103c81e9e8aacea7582729277d53e650021ababb32373567d3` |
