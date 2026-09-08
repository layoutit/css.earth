# Flight qualification, 7 September 2026

The expanded native-input runs exposed a replacement-flight delay and a search
ownership bug. Both now have shared lifecycle fixes. These results do not
establish consistently smooth frame delivery or full merge readiness.

## Sustained interaction

Immutable performance build `244d0cb9953e08d6eec1ccbc9db265e51736797d`, Chrome
Canary 155.0.8043.0, 1995 × 1236 CSS pixels, motion animation off. Three independent
documents ran sequentially against the static preview server. The operator
shortened the original six-chain plan after chain three; the other three were
not run. No source/build mutation occurred during their interaction phases.

| Seed | Start | DPR | Selections | Drags | Dataset changes | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 2800682729 | Jupiter | 1 | 30 | 62 | 6 | Passed |
| 2685674292 | Saturn | 2 | 30 | 63 | 6 | Passed |
| 1555659821 | Mercury | 1 | 30 | 57 | 6 | Passed |

Totals: 90 initial selections, 15 additional replacement selections, 182 curved
drags, 300 coarse wheel actions, 30 fine wheel bursts, 18 dataset changes, and
15 deliberate flight interruptions. Arrivals visited 37 distinct bodies. Input
used 58 marker picks, 17 label picks, 12 orbit picks, and 3 sidebar picks.

All three documents retained their universe and input nodes, returned to one
detailed scene after navigation, and recorded no application/transport errors
or reloads. Six orbit probes selected a different body than the harness's
intended chord; each published selection reached its destination. Overlapping
corridors and intervening motion mean this is selection/arrival evidence, not
proof that every intended orbit won hit testing. The actual app input was
prohibited from using `elementsFromPoint` throughout the runs.

Artifacts: `output/playwright/navigation-stress-static-244d0cb9/<seed>/` contains
reports, action coordinates and camera states, traces, diagnostics, screenshots,
and derived metrics. Low-priority analysis of a completed trace briefly overlapped
later chains; these runs are not a controlled before/after performance benchmark.

## Measured issue and fix

During replacement of an activating destination, the router retires that detail.
The departure branch then lacked a scene camera owner and waited for preparation
before starting movement. Observed delays included Jupiter → Europa at 624 ms,
Eris → Iapetus at 809 ms, and Saturn → Daphnis at 539 ms.

Commit `4fa34b72` lets the retained application world publish departure when the
detail owner is absent. It uses the last drawn pose and the existing target-detail
hold, without introducing a second flight or fabricated detail scene. The focused
regression fails on the old implementation and passes with this change; the
38 navigation/router checks pass.

The real-browser regression selects during activation, holds the replacement's
exact prepared bank, and checks both the first-motion mark and actual retained
world transform changes before releasing the bytes. The old production build
failed the 1.2-second blocked-bank check. The corrected build is exercised on
Jupiter → Europa, Pluto → Charon, and Saturn → Daphnis at DPR 1 and 2. All six cases passed with no application errors; first motion
was 22.3–25.7 ms, with changed world transforms and no detail bank available.
These are publication timings, not physical display latency. Results live
in `output/playwright/replacement-qualified-4fa34b72/report.json`.

The stress matrix precedes this final fix; its 90 selections are not claimed as
post-fix coverage. The focused browser replay qualifies the changed branch.

## Remaining limits

The wider stress recording contains dropped-only frame sequences during
sustained drags. In seed `1555659821`, Deimos action 26 has 211 among 474 reported
sequences, Haumea action 253 has 84 among 249, and Phobos action 193 has 52 among
142. Here a sequence is grouped by `(frame_source, frame_sequence)` and counted
only when all its reports say `STATE_DROPPED`. Complete-presentation endpoint
gaps and requestAnimationFrame timing alone are not delivered-frame proof.
A texture-paging experiment worsened Charon's full-presentation p95 from about
17 ms to 28–29 ms and increased downloads; it was removed from the PR.

The broader source/preparation gate remains incomplete: this checkout lacks
pinned inputs and the preparation suite also reports separate assertions.
The production-shaped build and focused renderer/platform/shell/package checks
are useful evidence, not substitutes for that gate. The PR remains a draft.

## Natural three-destination journey

The operator's shorter route ran on the same application build: start at a wide
solar-system view, scroll inward and click Mars, make a small close zoom and drag,
select Venus using sidebar search because it is outside that view, drag Venus,
scroll outward through the Sun overview handoff, click Makemake in the scene,
and drag its surface. No diagnostic camera writes or rapid supersessions were
used. All three destinations and the overview handoff completed, with retained
world/input/document identity and no recorded application or HTTP errors.

Reproduce with `ORIGIN=http://127.0.0.1:4221 node site/test/natural-navigation-browser.mjs`.
The completed run is `output/playwright/natural-835070bb-v2/`; the earlier attempt
required Venus to be visible and failed that harness precondition. Its browser
was still closing during the start of the completed run, so these are diagnostic
observations, not an isolated before/after performance comparison.

Navigation first-motion publication was 24 ms for Mars and about 30 ms for Venus
and Makemake. These mark application publication, not physical display latency.
The previously reported 117 ms Venus departure gap contains six Chromium
`STATE_NO_UPDATE_DESIRED` frames. The main thread continued processing short
frame tasks during that interval; it is not evidence of a renderer stall.

Grouping frame reports by source and sequence found no dropped-only sequence in
these three flights or their close drags. Some sequences contain both partial
and complete presentations, so that result does not establish that every main
thread update was displayed on time. Gaps between complete-presentation endpoints
alone must not be reported as dropped frames: they omit unchanged frames and
the distinction between partial and complete updates. The broader stress results
above remain a separate qualification limit; this shorter journey does not prove
that all navigation is smooth.

The [prepared depth implementation](performance-architecture.md) addresses the
measured compositor bottleneck while preserving original source leaves and
textures. Its matched timings, visual differences, memory observations and
scope limits are recorded separately.


## Prepared depth integration qualification

The depth implementation is generic and preparation-owned. Deimos, Phobos and
Phoebe meet its source and ownership requirements; their geometry, texture
resources and original binding tree recover exactly to `827db935`. Each checked
runtime equals its final transported data. Repeated preparation reproduces the
same bank bytes. Other surface families retain their previous representation.

The full `pnpm test` run after this integration passed 454 package tests, 328
renderer tests, all 776 platform tests, and 229 of 230 shell tests. The shell
failure is `navigation-preparation.test.mjs`, missing the pinned/generated
Daphnis `source/presentation/context.png`; it is also absent in the main checkout.
The earlier six source/runtime mismatch failures were introduced during this
work and corrected, without relaxing source closure. Their successful rerun is
in `output/depth-prototype/test-final.log`. This remains a non-green aggregate,
not an object-ready or merge-ready declaration.

The production-shaped performance build and renderer typecheck pass. The actual
compiled banks were regenerated after the preparation restoration fix and match
the bytes used for the matched compositor measurements. Thirty-six paired views
cover every affected object, both datasets, orbit, coarse LOD, return and resize
at DPR 1/2. Appearance is not pixel-identical; the inspected edge differences and
A/A calibration are recorded in the architecture document rather than hidden
behind a passing tolerance.

The short requested journey—wide system → Mars → Venus → overview → Makemake,
with native drags and wheel input—completed at both DPRs with retained world,
input and document identity, and no application/HTTP errors. Reports are in
`output/playwright/natural-depth-final-{1,2}/`. These are functional regression
runs, not a new isolated performance comparison: DPR 1's trace transport briefly
overlapped the start of DPR 2.

Six replacement-flight cases (Mars → Deimos, Mars → Phobos, Saturn → Phoebe at
DPR 1/2) hold the exact incoming prepared bank. The retained world moves before
release, first-motion marks occur in 17.3–28.3 ms, and all arrive ready with one
scene and no errors. Report: `output/playwright/replacement-depth-final/`.

All three affected packages completed the 13-case browser conformance suite:
initial shell, desktop/mobile, four pre-ready motion/visibility combinations,
DPR 1/2 interaction and density, dataset race/reacquisition/rejection/disposal.
Phobos had an earlier failed DPR 2 repeated-double-click run that selected Mars;
the same baseline probe and the candidate repeat passed. Its failure video is
preserved. Inspection found that resolved background sprites published square
hit boxes including transparent corners. The shared publisher now uses the
projected disc, with a regression against the real context publication and
picking registry. This correction changes hit coverage, not painted appearance.

The conformance census now reads actual texture leaves under the one object
camera, including prepared carriers. It still requires nonempty mounted texture
coverage, finite geometry bounds, one scene and retained identities; it no longer
assumes every painted leaf descends from the camera's reference transform node.

Reports: `output/playwright/depth-conformance-v2/`,
`depth-conformance-phobos-repeat/`, `depth-conformance-phoebe/`; the initial Phobos
failure remains in `depth-conformance-phobos/`. These suite results precede the
final transparent-corner correction; its focused final results are recorded below.


After the transparent-corner correction, the rebuilt server passed Phobos's full
13-case conformance suite again (`depth-conformance-phobos-final/`). The standard
DOM-cleanliness browser check passed Deimos, Phobos and Phoebe at both DPRs,
reporting 21,808 total stage nodes, stable identity and no interaction topology
changes in each case. The final Deimos DPR 2 performance confirmation and its
actual runtime bundle hash are in the architecture document. No merge was run.

The final renderer suite passes all 329 tests, including the new context-picking
regression. Renderer typecheck and the typed source-closure audit pass again after
the last runtime change. Logs: `renderer-final.log`, `typecheck-final.log` and
`closure-final.log` under `output/depth-prototype/`.

## Integration with main `000b67d7`

Main was merged into the PR branch locally, preserving its 38 added bodies,
epoch data and orbit presentation changes. This is not a merge of PR #27 into
main. The resulting registry has 90 objects. Every checked runtime equals its
transported data and every descriptor matches the payload SHA. The three
qualified depth banks retain the same bytes as the matched visual/performance
matrix; new entries are not assumed eligible. A surface must satisfy the face
budget in every group or retain its entire previous layout. The seven newly
added, only partly separable meshes correctly retain their previous layout.

The integration passes all 608 package tests, 16 preparation/activation/layout
checks, and both actual-registry source-closure checks (including independent
camera ownership for every object). The shell suite remains 229/230: navigation
atlas reproduction cannot open the generated/pinned Naiad
`source/presentation/context.png`. Source-image restoration and the full
aggregate gate are not claimed complete. Logs and exact registry hashes are in
`output/depth-prototype/integration-*`.

Phobos's integration replay exposed a second background-picking boundary: a
resolved background body's disc can overlap the visible detailed surface even
when its centre is not occluded. Its failed DPR 1 video remains under
`output/playwright/depth-integration-phobos/`. The shared input owner now consults
its existing surface hit test before accepting a context target during geometry
LOD. Hover and activation share this rule; outside the detailed surface and in
overview, context targets remain navigable. No second hit mesh or body-specific
exception was added. The renderer suite passes all 331 tests, including native
double-click/hover regression coverage, and renderer typecheck passes.

The rebuilt integration passes all 13 Phobos conformance cases, including the
previously failing sequence at DPR 1 and 2 (`depth-integration-phobos-fixed/`).
Styx passes DPR 1/2 on the first integration build and DPR 2 again after the
shared picking correction (`depth-integration-styx-fixed/`). The final typed
loader and Sun source-closure checks pass after the input change. These are
focused final-runtime checks; the earlier full platform suite is not relabeled
as a 90-object aggregate run.

The requested native journey also passes at DPR 2 on `4eb2caa7`: wide system →
Mars, close zoom/drag → Venus, drag → overview → Makemake, then drag. It keeps
world/input/document identity, finishes ready with one scene, and records no
application or HTTP errors (`output/playwright/natural-depth-integration-2/`).
That browser closes before the final isolated Deimos timing confirmation begins.
Its measured result and actual served bundle hash are recorded in the
architecture document. PR #27 stays a draft and the operator retains merge control.
