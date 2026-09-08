# Prepared orbit publication during Sun–galaxy travel

World-context publication was processing every body after its planetary context
had faded away, and processing every orbit vertex while the system was visible.
PR #45 now moves the static decisions into preparation and skips work that cannot
contribute to the current view.

## Preparation and runtime ownership

Preparation emits a conservative sphere around each authored orbit trail and an
ordered list of its positive-weight chords. In the latest 175-orbit catalog,
13,485 of the 21,000 authored chords have positive weights. The sphere includes the pinned
position and both endpoints of every active chord. Existing vertices, trail
weights, source positions and appearance are unchanged. The renderer validates
these fields on load; it does not derive a replacement bank at runtime. Older
banks without the optional metadata retain the exact projection path.

For each live camera publication, the renderer tests the prepared sphere against
the viewport and the existing 12-pixel zero-opacity threshold. Near-plane
crossings use the exact chord path. Surviving orbits project only their prepared
active chords, with the same clipping, occlusion, order and opacity. Retained line
nodes cache their last written transform and opacity in JavaScript, avoiding
redundant style writes and CSSOM matrix serialization.

After the whole system fades out, the renderer publishes the zero-opacity
transition once, retiring its hit targets, then updates only the anchor locator.
Re-entry and indicator restoration resume full publication. Depth order is
retained until camera orientation changes; selection updates the detail-layer
offset. Translation cannot change depth order. Prepared DOM stays mounted.

Main's six-asteroid expansion (`ddee157b`) is integrated in this branch. The same
preparation step supplies metadata to the expanded catalog. It does not introduce
an object allowlist, reduce orbit detail, or generate scene geometry at runtime.

## Follow-up: fixed styles and direction-owned optics

The follow-up commit `1b0c2e27` removes redundant publications without changing
prepared assets, geometry, opacity, optical coefficients, or camera behavior:

- Fixed orbit/indicator stroke widths are installed at mount. Orbit pointer
  state changes only when navigability changes; retirement and indicator
  suspension still retire and restore picking.
- Volume camera transforms still follow translation and viewport changes.
  Axis weights and optical-copy coefficients update only when camera orientation
  changes, which is the input that owns them. No orientation quantization is used.

A separate setter-count probe found 563,348 unchanged custom-property writes for
stroke widths and orbit picking during the route. These are setter invocations,
not a measured count of browser style invalidations. Probe timing is excluded
from the performance comparison.

A fresh pair uses the expanded 175-orbit catalog and the same camera input tape,
viewport, DPR, paused animation, recorder and simultaneous trace/video setup.
The baseline substitutes exact renderer sources from PR revision `06684c41`;
`publication-candidate` contains the four-file publication change above.

| Movement-window measurement | PR revision `06684c41` | Publication ownership |
| --- | ---: | ---: |
| Movement duration | 41.547 s | 39.882 s |
| World-context publish sampled self CPU | 2,598 ms | 2,299 ms |
| World-context publish sampled inclusive CPU | 5,786 ms | 5,191 ms |
| Main-thread UpdateLayoutTree | 4,528 ms | 4,243 ms |
| rAF intervals >25 ms, 5–5,000 AU | 132 / 562 (23.5%) | 99 / 566 (17.5%) |
| rAF p95, 5–5,000 AU | 33.4 ms | 33.3 ms |
| Maximum rAF interval, whole movement | 166.7 ms | 233.3 ms |

This pair shows about 10% less sampled inclusive publication CPU. It does **not**
show acceptable frame pacing: the galaxy-entry stall remains and the maximum
interval is worse. Neither movement window has a main-thread task over 50 ms;
the candidate's galaxy pause overlaps a 249 ms GPU SwapBuffers/ScheduleOverlays
operation. That correlation does not establish the browser's underlying cause.

Both recordings have no app errors, reloads or trace loss; recorder/trace clock
alignment drifts by 51 and 25 microseconds, and video timestamp error stays below
0.50 ms. They contain 2,188 and 2,059 video observations respectively. Document,
world root, input surface and the 51,852-node/50,345-leaf scene remain retained.
The Sun-start, galaxy and Sun-return screenshots are pixel-identical between the
pair in the scene region used above. This is endpoint evidence, not visual proof
for every orientation. The native recorder averages 4.36 and 4.37 ms per sample.

| Run | Recording ID | Recorder SHA-256 | Trace SHA-256 | Video SHA-256 |
| --- | --- | --- | --- | --- |
| `publication-baseline` | `675ef5db-35a4-4d87-bb3e-92600f655207` | `443f3aaa04d19583b5a07749e98078cab3b2a97701c968a57fa92b1a6467a69c` | `7d561744c9c43593a7f45cf6b11541742f1bc8591e2defecd5904c321dd9079f` | `1a5b1be76623430a1d5172b66f5aefcfffb9cac8e8095985e0f4bddb9f5a652f` |
| `publication-candidate` | `f411b1fc-65ae-47ea-a5e7-abd9ff1c4b78` | `cc423062482c5fd4a2fd8f43a29be17f56964254d526e82a8b6a9c3ae339c087` | `ddabc41b65d3031b5e1a766bdd5107ce640d7dfc798bd08bca59a995ae86ab31` | `923472a8dc7e28e8f6fc311ffaacdb5a980400e9508365d69d79a6185bd9e9c2` |

### Experiments excluded from the PR

The `publication-warm`, `publication-contained` and
`publication-contained-repeat` recordings are diagnostic experiments, not the
submitted renderer. Early layer activation did not remove the stall. Per-axis
paint containment reduced the measured pause but failed rotated-view image
checks. Completed-image containment and flat optical-copy prototypes also failed
strict visual qualification. None of those CSS or topology changes is included.
Their captures and unstable frame-sequence reports are retained outside Git.

A follow-up optical check captures each axis separately and compares their
weighted composition with stationary browser frames. Chrome 152.0.7977.76 at
DPR 2 intermittently differs by up to 21 channel levels in the exact old renderer
as well as the candidate. That reproduces the instability without the new
publication caching; it does not prove a fix or justify widening the image gate.
The current work has not resolved that volume-compositing problem.

### Current integration and checks

Main `3d76ff39` (the 67P observation lens) is integrated in merge `98d6679b`.
It does not change the Sun route's prepared world bank or these renderer paths.
After integration, renderer build/typecheck and all 136 focused tests pass.
The native universe-label and outward/return galaxy-handoff checks pass.
The retained-leaf-pool browser check fails its Ceres hover expectation identically
on the candidate and the exact prior renderer: the first DOM hit-corridor chosen
by the harness is not confirmed as the native hovered object. Its initial exact
culled/unculled image comparison passes, but its later picking assertions remain
unqualified. This work does not claim an aggregate green browser gate.

## Earlier controlled performance comparison

Recorded on 2026-09-08 against main `1588a643`. The comparison holds the catalog at
169 contextual bodies, before the six-asteroid merge. All runs use the same
checkout, dependencies, assets and Astro dev configuration. Baseline compilation
substitutes the original world-context renderer; candidate runs use the changed
renderer and prepared metadata. Reports retain loaded-module and source hashes.

Headless Chrome Canary 155.0.8043.0; 1995 × 1236 CSS pixels; DPR 2; motion off.
Each run starts at the Sun and receives 384 native wheel events of +6, a hold at
galaxy distance, then 396 of −6. Start, peak and return camera positions match.
Delivery timing varies, so these are sequential instrumented observations, not a
statistical benchmark or a wall-time speedup.

| Movement-window measurement | Main | First PR revision | Prepared orbits | Repeat |
| --- | ---: | ---: | ---: | ---: |
| Movement duration | 41.174 s | 42.543 s | 40.394 s | 41.927 s |
| World-context `publish` sampled self CPU | 4,919 ms | 2,190 ms | 2,351 ms | 2,431 ms |
| World-context `publish` sampled inclusive CPU | 10,524 ms | 7,650 ms | 5,383 ms | 5,504 ms |
| Main-thread `UpdateLayoutTree` | 5,677 ms | 4,188 ms | 4,352 ms | 4,650 ms |
| Main-thread `Layout` | 423 ms | 442 ms | 430 ms | 470 ms |
| Main-thread `Paint` | 645 ms | 667 ms | 681 ms | 735 ms |
| rAF intervals >25 ms, 5–5,000 AU | 198 / 551 | 215 / 541 | 110 / 564 | 137 / 566 |
| Share >25 ms, 5–5,000 AU | 35.9% | 39.7% | 19.5% | 24.2% |
| rAF p95, 5–5,000 AU | 33.4 ms | 33.4 ms | 33.4 ms | 33.4 ms |
| rAF intervals >25 ms, whole movement | 204 / 2,267 | 226 / 2,326 | 116 / 2,291 | 145 / 2,356 |
| Maximum rAF interval, whole movement | 33.5 ms | 50.0 ms | 166.7 ms | 216.6 ms |

The prepared-orbit runs reduce sampled inclusive publication CPU by 48–49%
relative to main. They also reduce the frequency of long rAF intervals in the
visible-orbit range. **They do not establish consistently smooth playback.**
The target-range p95 remains 33.4 ms, and larger stalls remain at galaxy scales.
In the first prepared-orbit run, those stalls overlap long compositor
`SwapBuffers`/`ScheduleOverlays` events, with no main-thread task exceeding 50 ms
in either movement window. That localizes remaining work; it does not prove its
cause or excuse the worse maximum. This PR does not claim to solve it.

The distance band uses the latest recorder camera sample for each rAF timestamp;
sampling is every 125 ms, so boundaries have that granularity. rAF intervals are
not counts of dropped display frames. Native recorder sampling averages 3.79,
4.52, 4.27 and 4.39 ms per sample respectively; CPU tracing and screencasting add
further overhead. Paint and compositing costs remain.

## Synchronized evidence and behavior

Each run contains the native application recorder JSON, Chrome trace gzip and
simultaneous CDP video. Start/stop User Timing anchors bind the recorder and trace
to one recording ID. Capture timestamps bind video frames to the recorder clock.
Frames are ordered by capture timestamp while preserving their original receipt
indices and file identities; encoding preserves variable timing and holds the
last observed frame until recorder stop. Clock alignment does not establish
screenshot latency or capture every display refresh.

| Capture directory | Recording ID | Video observations | Clock-offset drift | Max video timestamp error |
| --- | --- | ---: | ---: | ---: |
| `baseline-2` | `5969ca99-4f0f-4463-8bd6-77f6c89e1386` | 2,140 | 61 µs | 1.24 ms |
| `candidate` | `66d47276-8d5d-4f45-b8e1-c399973aea97` | 2,231 | 42 µs | 1.59 ms |
| `candidate-final` | `10ab6698-c007-421a-b51c-56f6100bb736` | 2,073 | 6 µs | 0.50 ms |
| `candidate-repeat` | `5524d201-7ad9-45ff-a0fd-8cf54d57e3ca` | 2,191 | 9 µs | 0.50 ms |

There are no recording-time reloads, trace loss or application errors. Metadata
reports one mounted Sun scene, paused animation, 50,358 retained scene nodes and
48,899 leaves throughout the controlled runs. Sun resources remain at four
decoded images, four allocations, no releases and no pending material work.
World root, input surface and document identities are retained.

The start, galaxy and return screenshots from `candidate-final` are pixel-identical
to `baseline-2` in device-pixel region x=720..3989, y=36..2435, excluding the shell.
This is endpoint evidence, not frame-by-frame pixel identity. Intermediate video
observations were inspected around 5, 50 and 5,000 AU in both directions.

## Latest-main integration capture

A further synchronized run, `candidate-latest`, uses code commit `cb1e9dfc` after
integrating main `ddee157b` and regenerating all 175 orbit records. It has recording
ID `3f7ecdbd-cd14-4a2a-a243-f3a76b547925`, 2,080 video observations, 81 µs clock-offset
drift and 0.50 ms maximum video timestamp error. The route retains one mounted
Sun, document/world/input identity and 51,852 scene nodes / 50,345 leaves. The
larger retained catalog comes from main's six new bodies. No app error, reload or
trace loss occurred; the final label and galaxy-handoff browser checks also pass.

This run recorded 214 / 589 (36.3%) rAF intervals above 25 ms in the 5–5,000 AU
range, with p95 33.4 ms and a 149.9 ms maximum there; whole-movement maximum was
233.4 ms. Sampled inclusive world-context publication was 5,881 ms. Because the
catalog and run conditions differ, this is not the controlled comparison above.
It also does not establish that the earlier frame-pacing improvement carries
unchanged to the expanded build. The latest application still has visible stalls.

Its native recorder, Chrome trace gzip and simultaneous video SHA-256 hashes are
`31f56a5a22263f15b81eb1b619b4995d0232f3136d12c19950abf96158b37cb7`,
`5cf6d16580f6a5bb2443a0d9c6c22e028f8f2629aba398c15ae9ea64c3260963`, and
`edc4ae8aefabfd0e9d490405ada17c24e086d842fe2ef9707f365a2b44773628` respectively.

## Validation

- 124 focused universe, solar-system, stars, labels and picking tests pass.
  These include conservative-bound comparisons against exact projection,
  active-chord equivalence across clipping/occlusion cases, prepared metadata
  validation, unchanged-style publication, retirement/re-entry and depth order.
- 228 universe preparation tests pass after integration with latest main. Existing prepared geometry and appearance
  are unchanged when the two new metadata fields are removed.
- Shared package, preparation and renderer builds and both typechecks pass.
- Real Chrome universe-label and galaxy-handoff checks pass: compact-system
  decluttering, native galaxy drag, Sun-label navigation, outward/return travel,
  retained environment/images and continuous background.
- CI now includes the whole solar-system test directory, so the new projector and
  line-publication regressions run with the existing shared-universe checks.
- Full renderer suite before the six-asteroid integration: 340 pass; two fail on
  Mercury/Venus prepared SHA-256 checks. Their unchanged descriptors differ from
  existing local prepared bytes. The aggregate gate is not green in this checkout.

Raw evidence remains outside Git under `output/world-context-zoom/`. Intermediate
`candidate-bounds` and `candidate-active` runs are not the final implementation.
The failed pre-recording `baseline` attempt is excluded. Artifact SHA-256 hashes:

| Artifact | Baseline | Prepared orbits | Repeat |
| --- | --- | --- | --- |
| Native recorder JSON | `a0e0f962fb5ee8597e8665eda0b8cf6a2d3a6af9c57ed66d83d3c7e02f029f46` | `7d77ef596af5e845b3a722c6b2c2082d76ed0c23498cdb93dd50cf5a562d523d` | `aab08406dae99578633807113d0e393553f17883ab03672853547c6b8d92816f` |
| Chrome trace gzip | `b68c04b7077667656b46f031dc10ad0febd0e5e9dff07c32f68b909181fe8764` | `f8486fdee856279507a66d9a7700523db38d7d4411e65adfacaeac84fba4d286` | `66abf3cdbf2594ae43e145049748813def01fb0234cd83ab2e933d05f7336b52` |
| Simultaneous MP4 | `41f858a94360259adedc4d52483c5fca363d95adf71aa8c8b6b66fb46bdaa94d` | `65f824289fcc56eec52e03e518abefd3f896ac03b9f1c689035a4686ae0affa9` | `de74c3c5ab37bb598bc6319384bc52b2e9e6569c73138b88b72fc62b20623fe4` |
