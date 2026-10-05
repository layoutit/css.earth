# Browser journeys

A journey drives a production build and records what the reader sees. Record base and head on the same machine and toolchain, using the merge-base harness and each build's own preview server. Refactors require identical observations; intentional changes produce a reviewable diff. Traces and screenshots remain local in ignored output.

## Comparison contract

| Family | Compared exactly | Raw diagnostics, not compared |
| --- | --- | --- |
| Network | Request multiset: URL, method, resource type, counts, status, failures, cancellation, redirects, available cache/initiator evidence, chunk size class; declared application issue order and proven causal edges | Request issue/response/completion frame measurements, completion steps/order, native latency bounds and frames-to-quiet |
| DOM | Per-subject attach/detach and ordered attribute/style writes, classification, counts, step ownership and retained counts | Frame assigned to each write and IO-dependent cross-subject interleaving |
| Rendering | Declared elements' geometry/styles, exact RGBA PNG pixels, animation identity/playback permission/rate | Native animation current time |
| Content | Shell text, title, URL, history length/state values, focus and root data attributes | None |
| Errors | Page errors, rejections, console errors/warnings, worker errors, blocked foreign requests and journey assertions | None |

Fake time cannot control transport, worker computation, image decoding or native animation timelines. Their timing evidence is saved in `*.raw.json` for inspection and excluded by name from `*.trace.json` and comparison. Completion order among independent requests is not an application guarantee. Part 2 adds real-time base/head runs to pin latency regressions and native scheduling, plus instrumentation for actual manifest-control reachability. This part makes no latency guarantee.

Requests issued concurrently compare as counted multisets. Application-ordered issuance remains exact: Milky Way declares transport-before-entry, and the runner declares completed `/world/anywhere.json` before router import. It does not invent a transport-completion dependency between concurrent startup fetches. Transient DOM attach/detach remains visible even if the endpoint is unchanged.

PNG comparison uses pixelmatch threshold **0**, antialiasing included, plus exact RGBA comparison. There are no masks; alpha-only changes and color beneath transparency remain red. The declared rendering elements are the scene, input surface, footer, sidebar/settings/information panels and navigation markers/labels.

## Clock, barriers and limits

Install Playwright's clock before navigation at a fixed date, then pause at a fixed target one second later. Advance one 16 ms application frame at a time. While native requests or worker work are pending, wait on real tasks before advancing fake time. Worker replies are held and released by worker/request identity; idle callbacks receive a synthetic 16 ms budget.

A barrier requires the expected route, `data-ready=true`, loaded fonts, no motion, requests, worker jobs or idle callbacks, and sixteen unchanged frames. Decode only complete, already-requested document images and fonts, then require sixteen more quiet frames. IO/barrier timeout is 120 seconds; decode timeout is 30 seconds. Real IO can move an event between fake frames, so frame numbers and frames-to-quiet are diagnostics.

`--repeat 2` requires exact traces and pixels. Qualification requires ten identical captures and thirty further captures, including batch boundaries. A pair that drifts remains experimental; `--gate` rejects it. Defaults select only qualified pairs. A repeated saved journey assertion still exits 1, with focused content, PNG and a partial trace.

| Observer | Known effect |
| --- | --- |
| Network guard | Blocks non-loopback traffic. Playwright routing disables HTTP cache, so revisit journeys do not qualify native warm-cache behavior. Service workers are blocked; local `scenes/` is required. |
| Worker scheduler | Replaces native reply arrival order with deterministic release. Real-time runs must test native ordering separately. |
| Decode | Does not create background-image requests or activate lazy images. GPU/background-image presentation completion is not proved. |
| Screenshot | Disables animations during capture, then restores paused permission/pose. It does not prove an unperturbed native animation timeline. |
| Wheel | Acknowledges native delivery and aligns its timestamp with fake RAF time; native real-time input needs a separate run. |

ResizeObserver delivery and worker/decoder/native IO scheduling remain outside fake-clock control. A quiet endpoint does not prove that no later work can occur.

Named normalization:

- Unique built chunk hash suffixes normalize at comparison. Build-wide ambiguous names retain full URLs; response byte-size classes remain exact. Raw bytes are preserved. Distinct assets and repeated counts cannot collapse.
- `concurrent-module-first-importer` permits only one caller from the build-derived finite set; unexpected callers and counts remain red. WebKit does not expose CDP initiator/cache-source equivalents.
- `html-parser-text-chunks` permits bounded streaming style/script/noscript text chunks while preserving final text and membership. Scripted setters remain exact; arbitrary text API coverage is not claimed.
- `history-entry-random-prefix` aliases only a validated random prefix. Entry serials, distinct-session relationships and every other history value remain exact.

Indistinguishable nodes receive occurrence identities in observation order; swapping indistinguishable occurrences can hide identity changes or cause drift.

## Journeys and measured qualification

The [registry](../site/journeys/registry.mts) carries every journey/profile status. Profiles include engine, viewport, DPR, touch, reduced motion and color scheme. Chromium/WebKit desktop and Chromium-reduced are launched paths; touch/tablet and lockstep remain experimental.

Flights use the application's public events, as the [iPad journey](../labs/performance/ipad-journey.mts) does, and verify a resident document witness. They are page-dispatched flights. Earth-system uses host Earth; Dione departs from Saturn-system. Interruption waits for visible pending progress. Settings deep links use `settings=1` and verify the served prepared settings.

| Journey | Chromium desktop | WebKit desktop |
| --- | --- | --- |
| milky-way | 10+30 exact | 10+30 exact |
| earth-system | 10+30 exact | 10+30 exact |
| dione | 10+30 exact | 10+30 exact |
| milky-way-deep-link | 10+30 exact | 10+30 exact |
| earth-system-deep-link | experimental | 10+30 exact |
| dione-deep-link | 10+30 exact | 10+30 exact |
| dione-navigation | experimental | experimental |
| dione-interrupted | 10+30 exact | 10+30 exact |
| dione-drag | 10+30 exact | 10+30 exact |
| dione-keyboard | 10+30 exact | 10+30 exact |

Chromium Earth-system settings: five request-count differences in ten captures; texture consumers issue one versus two requests. Chromium Dione navigation: ten saved captures compare exactly after excluding global interleaving, but fifteen further captures vary network requests/counts/initiators/cache evidence (full histogram in corrected-results.json). WebKit Dione navigation: route/readiness assertions and actual content/rendering changes; remains experimental. Interruption passed in both engines.

Passing batches captured under the stricter global-order comparison remain valid after removing only that nondeterministic field; no recording, clock, geometry or pixel contract changed. WebKit Dione settings was re-compared ten times and captured thirty further times under the corrected contract. All batch boundaries were compared.


Milky Way/Earth transitions, history, wheel and native warm cache are experimental. Application DOM/subpixel differences and WebKit viewport/ResizeObserver failures are not masked or repaired by this tooling.

Journeys and their harness live under `site/journeys/`: [architecture rules](../.github/scripts/architecture/rules.mts) prohibit imports across site/labs/CI trees, including types. Copy/build/proof commands live under `.github/scripts/journeys/` and use subprocess boundaries. No architecture baseline increase is needed. Browser journeys have a separate command; synthetic tests use the existing unit globs.

The [manifest ID contract](../site/journeys/manifest-ids.json) preserves all 319 S0 ids and validates each `exercises` entry. `node site/journeys/run.mts --coverage --require` exits **1** when any id lacks a qualified journey/profile pair or reviewed exemption, listing every missing id; complete coverage exits **0**. Counts print as `controls driven 2/101 | handlers 10/189 | capabilities 8/29 | exempt 1`. Without `--require`, coverage reports the reached and unreached lists. An explicit `--profile` restricts the report to that profile; otherwise qualified pairs across all profiles contribute.

The committed [unreachable list](../site/journeys/unreachable.json) contains only the S0-reviewed physical-iPad import-queue exclusion, with its one-line reason. Unknown ids, duplicate exemptions and ids exercised by any qualified pair are refused. New exemptions require review; lack of a journey is not a reason for exemption. Deleting an exercise or removing qualification turns the coverage requirement red in mutation tests.

Coverage credits source-audited `exercises` declarations, not instrumented handler firing. The gate intentionally stays red until tranche 2 supplies the missing input and control families. Registering an experimental journey does not add coverage. The S0 representative set covers 159 capability/startup combinations in principle; direct-load qualification alone does not prove the in-app startup paths.

| Additional representative | Dataset action | Chromium desktop | WebKit desktop |
| --- | --- | --- | --- |
| lmc | VISTA infrared | 10+30 exact | 10+30 exact |
| neptune-system | 2017 visible, then 2018 step | experimental | experimental |
| beta-pictoris-system | Debris-disc color; require legend | experimental | experimental |
| asteroid-2001-sn263-system | Reselect sole shape dataset | experimental | experimental |
| mars-system | Chlorine, then iron step | experimental | experimental |
| observable-universe | Cutaway; require legend | experimental | experimental |
| abell-1689 | Reselect sole optical dataset | experimental | experimental |
| centaurus-cluster | Reselect sole members dataset | experimental | experimental |
| great-attractor | Reselect sole galaxies dataset | experimental | experimental |
| local-group | Reselect sole galaxies dataset | experimental | experimental |

Together with Milky Way, Earth-system and Dione above, these are all thirteen S0 representatives. The new journeys are intended to open and close settings, then use a native dataset button; only LMC has completed qualification. Single-dataset objects have no alternative to switch to; legends are static panels with no toggle listener.

Neptune and Mars declare sequence steps. Neptune's attempt fails before selection: the system route shows the system card, while host dataset controls belong to its body view and are not visible. The journey needs native host selection before using datasets. The remaining nine new representatives stay experimental and unqualified.

The [qualification command](../.github/scripts/journeys/qualify.mts) runs four ten-capture batches per pair, compares every batch to the first, requires positive comparison output and stops at the first unstable pair. It never changes registry qualification automatically.

## Run base versus head locally

Set the three checkout variables to restored checkouts. Use the merge-base harness and matching dependencies/browser binaries. The complete block records qualified defaults; add an explicit `--journey` without `--gate` only to diagnose an experimental pair.

```sh
set -eu
export HARNESS_CHECKOUT="/path/to/restored/harness-checkout"
export BASE_CHECKOUT="/path/to/restored/base-checkout"
export HEAD_CHECKOUT="/path/to/restored/head-checkout"
cd "$HARNESS_CHECKOUT"
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
export ASTRO_TELEMETRY_DISABLED=1 TELEMETRY_DISABLED=1
export TMPDIR="$PWD/output/tmp"
mkdir -p "$TMPDIR" output/journeys
export JOURNEY_OUTPUT="$(mktemp -d "$PWD/output/journeys/compare-XXXXXX")"
node --test site/journeys/harness/*.test.mts site/journeys/registry.test.mts .github/scripts/journeys/breakages/*.test.mts
pnpm journeys:mutations
node site/journeys/run.mts --coverage --require
for JOURNEY_PROFILE in chromium-desktop webkit-desktop; do
  node site/journeys/run.mts --checkout "$BASE_CHECKOUT" --dist "$BASE_CHECKOUT/dist" --out "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/run.mts --checkout "$HEAD_CHECKOUT" --dist "$HEAD_CHECKOUT/dist" --out "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/compare.mts --base "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE/run-1" --head "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE/run-1"
done
```

`--checkout` names the preview owner; otherwise it is inferred from the distribution's ancestors. Exit **0** means equal complete artifacts, **1** means differences or saved journey assertions, **2** means tool/infrastructure error. Previews, contexts and temporary browser roots close on normal/error shutdown; the preview child also closes on parent IPC disconnect.

To add a journey, export a typed `journey` with a unique id, validated `exercises`, any proven issue-order declarations and `run(api)`. Register it as experimental, set the step before actions, use the application navigation/input path and route/motion barriers, then qualify before changing status.

## Detector and source proofs

| Observation | Independent browser mutations | Engines |
| --- | --- | --- |
| Network | Count, status, failure, cancellation, redirect, issue order; unexpected initiator | Both; initiator Chromium only |
| DOM | Transient membership, classification, attributes, scripted parser text | Both |
| Rendering | Geometry, exact pixels, playback permission, input timestamp | Both |
| Content | Text, title, URL/history values, root data | Both |
| Errors | Page error, rejection, console error/warning, worker error | Both |

The full browser lane passes 65 tests in 200 seconds, including all 49 focused recorder cases with stable controls, family-detector deletions in both engines, native-playback/timestamp deletions, worker scheduling and foreign-request safety. Synthetic units pass 86 tests; six browser-only tests are skipped there. Individual-field deletion coverage beyond the named checks remains incomplete.

Tests require an equal unperturbed control and the declared targeted family set. Deleting each family detector must make the focused browser test fail in both engines. Units also defend step identity, per-subject lifecycle order, chunk collisions/counts/status/names, exact alpha/color pixels and declared issuance. Timing exclusions are tested independently and preserve raw traces.

[Source substitutions](../.github/scripts/journeys/breakages/README.md) apply only to validated disposable sibling copies. A build is complete only with exit 0 and nonempty route HTML. The verifier requires comparison exit 1 and every expected family.

| Source breakage | Stable control / broken comparison | Required signal |
| --- | --- | --- |
| Pure issue reversal | 0 / 1, both engines | Network and DOM; deleting declared order erases the isolated network signal |
| Dropped listener | 0 / 1, both engines | Errors and content; assertion retains partial trace and PNG |
| Changed transform | 0 / 1, Chromium | DOM and rendering |
| Duplicate fetch | 0 / 1, both engines | Network count |
| Transient detach | 0 / 1, both engines | DOM lifecycle |
| Reduced-motion branch | 0 / 1, Chromium reduced | Native playback permission |
| WebKit-specific fault | 0 / 1, WebKit | Errors; Chromium negative control incomplete |

Saved rebuilt-source recordings were re-compared with the corrected differ. They remain applicable because the source substitutions and retained observers are unchanged. The WebKit fault’s Chromium negative control differs in chunk size class. Compact rebuild attempts removed that difference, but could not establish a matching control: older recordings have a different focus-text observer and the supplied distribution differs from rebuilt source in version labels, source links and pixels. No values or pixels were exempted. The original replayable fault spec is retained; its full negative-control proof remains incomplete.

The WebKit fault is a synthetic engine-specific startup exception, not an existing feature branch. Reduced-motion source evidence exercises CV Mon's native playback permission.

## Integration steps and measured cost

The orchestrator owns workflow wiring; no workflow is added here. Build full production distributions after restoring their inputs. The following job recipe is for integration, not an instruction to publish. Browser installation and restoration costs are unmeasured locally.

```sh
set -eu
export HARNESS_CHECKOUT="/path/to/restored/harness-checkout"
export BASE_CHECKOUT="/path/to/restored/base-checkout"
export HEAD_CHECKOUT="/path/to/restored/head-checkout"
cd "$HARNESS_CHECKOUT"
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
export ASTRO_TELEMETRY_DISABLED=1 TELEMETRY_DISABLED=1
export TMPDIR="$PWD/output/tmp"
mkdir -p "$TMPDIR" output/journeys
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium webkit
(cd "$BASE_CHECKOUT" && NODE_OPTIONS=--max-old-space-size=6144 pnpm exec astro build --outDir dist-journeys)
(cd "$HEAD_CHECKOUT" && NODE_OPTIONS=--max-old-space-size=6144 pnpm exec astro build --outDir dist-journeys)
export JOURNEY_OUTPUT="$(mktemp -d "$PWD/output/journeys/ci-XXXXXX")"
pnpm journeys:mutations
node site/journeys/run.mts --coverage --require
for JOURNEY_PROFILE in chromium-desktop webkit-desktop; do
  node site/journeys/run.mts --checkout "$BASE_CHECKOUT" --dist "$BASE_CHECKOUT/dist-journeys" --out "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/run.mts --checkout "$HEAD_CHECKOUT" --dist "$HEAD_CHECKOUT/dist-journeys" --out "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/compare.mts --base "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE/run-1" --head "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE/run-1"
done
```

| Stage | Measured local cost |
| --- | --- |
| Direct journey, one capture | Approximately 2–7 seconds, depending on engine/object |
| Dione flight, one capture | Approximately 21–23 seconds |
| Recorder mutations, 49 focused cases | 145 seconds |
| Complete browser mutation lane, 65 tests | 200 seconds |
| Full production build, preserved source proofs | 265–357 seconds per build |
| Direct qualification, 10+30 per object | Approximately 93–270 seconds per engine/object |
| Compare one direct pair | Approximately 0.3–0.8 seconds |

These are local measurements, not CI guarantees. Browser installation, input restoration and hosted runners remain unmeasured.

Part 2 completes representative qualification and startup-combination coverage, instrumented manifest-control reachability, real-time latency and perturbation runs, touch/tablet profiles, coast journeys and the physical iPad path. Native HTTP cache fidelity and complete cache/dependency evidence remain limitations.
