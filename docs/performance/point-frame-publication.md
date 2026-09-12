# Prepared point frames and one flight publisher

Implementation and browser verification: 2026-09-09–10.

This applies the retained-bank, sparse-publication and explicit-acknowledgement
techniques reviewed in [cssGraphics techniques](cssgraphics-tech.md). It changes
where a view is calculated and when it is published. It preserves the prepared
catalogue, photometry, projection, atlas, opacity policy and detailed object renderer.

## Ownership

The application registers the prepared star bank with its existing world worker
once. The worker selects the prepared hierarchy, projects retained identities,
evaluates their existing photometry and occlusion, and formats their final CSS
transforms. It uses the same captured camera as body annotations and picking.

The main thread retains DOM slots and publishes final values. The first view is
still seeded synchronously so initialization cannot reveal an empty sky. A
discarded response cannot advance the publication baseline: every request names
the last committed frame. The worker sends a complete repair when its preceding
result was not acknowledged.

Changed point IDs, visibility and alpha values use transferred typed arrays.
Transform strings are cloned. Membership is encoded when slots change, then a
small copied buffer is transferred for each request. An unchanged point does not
need another result entry or another transform write. Active and departing
identities are projected together during the existing fade; its deadline and
appearance are preserved.

The retained leaf pool accumulates block membership changes and commits the
final visibility once. Replacing the last leaf in a block no longer removes and
reintroduces the whole block into layout. Empty blocks remain dormant, and no
additional per-point DOM is allocated.

## The flight bypass found during validation

Wheel navigation used the frame worker, but the application called `publish`
directly while a destination's detailed groups activated. The first six-flight
capture exposed 65,130 main-thread point projections after its initial milestone,
including 61,790 during the Mars and Earth flight windows, despite zero such
projections in the separate steady-zoom capture.
These direct publications also invalidated queued worker results.

The coarse flight now uses the same frame queue. `presentAndWait` acknowledges
the complete publication, not worker completion. Before the detail is ready,
its camera update is included in that publication. The flight cannot claim a
checkpoint has been drawn while its world response is still pending.

When detail ownership changes, an abortable publication releases the old wait;
obsolete replies cannot write. The continuation retains the last acknowledged
pose. After an asynchronous commit it plans the next sample immediately, avoiding
an extra admission animation frame that would otherwise halve its cadence.
Stationary readiness holds still sleep on animation frames.

## Validation boundaries

Tests cover exact equality with the previous point drawing values, physical
camera changes, occlusion, fade deadlines, stable retained elements, transferred
buffers, missing delta baselines, and complete recovery after discarded replies.
Queue and navigation tests delay publications across handoff and interruption,
check atomic detail/world adoption, and verify that no obsolete response moves
the interrupted view.

The browser captures use native wheel and pointer input in Chrome Canary,
headlessly, with the application recorder, Chrome trace and timestamped video.
Each capture records source status, the patch, served bundle hashes and clock
alignment. The controlled zoom comparison uses the same 96 wheel packets and
camera route; the navigation journey visits Sun, Mars, Earth and Sun twice in
one document, with cold then naturally cached destinations.

These captures include recording overhead and host contention. Presentation
intervals are not a count of every physical display refresh. The first point-worker
comparison still had a roughly 33 ms p95; offloading projection alone did not
establish smooth 60 Hz rendering. Browser style and layer construction remain
substantial costs.

## Measured result

The comparison below isolates the flight-queue fix after point projection had
already moved into the worker. It does not compare against an older main branch.
The same six-flight journey ran before and after, using native clicks and adaptive
wheel input. The captured endpoints match: Mars at 91,718 km from its center,
Earth at 1,577,190 km, and Sun at 4,241,429 km. Application readiness, camera,
selection and resources are recorded at each milestone.

| Measurement | Before unified publication | Final candidate |
| --- | ---: | ---: |
| Main-thread star projections after initial milestone | 65,130 | 6,680 |
| Median presentation interval | 16.674 ms | 16.665 ms |
| p95 presentation interval | 30.165 ms | 20.672 ms |
| p99 presentation interval | 45.467 ms | 43.768 ms |
| Maximum presentation interval | 114.119 ms | 89.759 ms |
| Trace window | 43.874 s | 42.143 s |

Main-thread projection work decreased 89.74%. The remaining work is eight
bounded synchronous reseeds of 835 points at ownership changes. The final queue
still discarded 119 obsolete responses across the navigation journey; these are
semantic invalidations, not Chrome dropped-frame counts. The architecture does
not eliminate browser work: final style recalculation occupied 3.188 seconds and
layer construction 4.474 seconds across the 42.143-second recording.

The final full-galaxy capture goes from approximately 232 AU to 7.414 billion AU
(117,233 light years) and back twice. That run performs zero main-thread point
projections after initialization and discards zero queued frames. Its p95 is
31.433 ms, with a 107.202 ms maximum, so galaxy navigation is not yet consistently
smooth. No visual simplification was used to obtain these measurements.

All three final capture components are retained together:

- [Before flight unification](../../output/playwright/navigation-consistency/point-worker-navigation/): recorder `67c8adaf-4922-442a-a65f-713686af60b8`, trace `7314eab5`, 1,880 timestamped video frames.
- [Final six-flight navigation](../../output/playwright/navigation-consistency/unified-flight-navigation/): recorder `f27a87f1-1063-4d77-a972-cb9e1d385ab3`, trace `d34c95e5`, 1,814 timestamped video frames.
- [Final galaxy round trips](../../output/playwright/navigation-consistency/unified-flight-galaxy/): recorder `8abb07de-a636-4586-a03e-5509afe519c9`, trace `a884514b`, 408 timestamped video frames.
- [Comparison chart](../../output/performance/point-frame-publication/comparison.png), [chart source](../../output/performance/point-frame-publication/chart.py), and [machine-readable measurements](../../output/performance/point-frame-publication/comparison.json).

Final navigation clock drift is 64 microseconds, and maximum video PTS error is
0.903 ms. Galaxy drift is 74 microseconds with 0.199 ms maximum video PTS error.
Neither capture reports trace data loss or application errors. Both retain the
same world element, input element and document, with exactly one detailed camera.
Settled Mars, Earth, Sun and full-galaxy video frames were visually inspected.
An additional native drag and immediate wheel interruption after selecting Mars
passed: selection changes immediately, cancellation returns control, one camera
remains, and the pose stays stable after delayed replies could arrive.

The earlier controlled wheel comparison also preserves 99.8494% of pixels in a
settled JPEG frame; the fixed sidebar/logo crop is identical. This is an endpoint
check, not proof of complete animation parity.

## Trace processing and qualification

Long captures exceeded V8's single-string limit. The offline loader now streams
gzip and JSON through [stream-json's Assembler](https://github.com/uhop/stream-json/wiki/Assembler),
preserves every event, checks the compressed SHA-256 and decoded byte count, and
rejects malformed or truncated input. Final navigation has 6,468,479 events and
1,235,888,339 decoded bytes; complete processing took 38.928 seconds. This tool
does not enter the application bundle. The largest final main task, 232.55 ms,
is recorder-stop serialization and must not be attributed to flight rendering.

Focused validation passed: 444 renderer tests in 69 files, 58 navigation/router
tests, a further 24 navigation tests after the async-cadence adjustment, 9 trace
tool tests, renderer type checking, renderer compilation, an 814-page site build
and assembly of 406 object packages.

The broader shell suite is not green: 306 of 312 tests passed. Failures include
canonical-density/loader audit findings, missing Earth retained-interaction
evidence, missing Itokawa lens-race inputs, and an explicitly terminated atlas
rebuild test. These are recorded separately from the passing runtime checks;
this document does not establish merge readiness or assert that every broad
failure predates this change.

The candidate is based on `d8d058662f692daf1cbc20a4bc8a4738ba752a30` plus the
captured working patch. Fetched main is `9ee9c453c`; its eight newer commits were
not folded into this matched comparison. Source status, the patch and served
bundle hashes are retained in each capture. The stable local server is
`http://127.0.0.1:4244/sun/`. The shared main checkout was not modified.
