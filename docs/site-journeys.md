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

Fake time cannot control transport, worker computation, image decoding or native animation timelines. Their timing evidence is saved in `*.raw.json` for inspection and excluded by name from `*.trace.json` and comparison. Completion order among independent requests is not an application guarantee. Real-time base/head runs to pin latency regressions and native scheduling remain for tranche 2. Manifest-control reachability is now recorded during the journey. This part makes no latency guarantee.

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

The [registry](../site/journeys/registry.mts) derives qualified status from current local 40-capture observation receipts in ignored output. A clean checkout has no instrumented qualified defaults. Historical qualification below describes the earlier uninstrumented version and provides no current coverage credit. Profiles include engine, viewport, DPR, touch, reduced motion and color scheme. Chromium/WebKit desktop and Chromium-reduced are launched paths; touch/tablet and lockstep remain experimental.

Flights use the application's public events, as the [iPad journey](../labs/performance/ipad-journey.mts) does, and verify a resident document witness. They are page-dispatched flights. Earth-system uses host Earth; Dione departs from Saturn-system; its navigation journey now uses the native Dione anchor rather than the host-oriented public event. The native journey verifies the visible Dione body card and a resident document. Its ten Chromium captures complete those checks but still vary dataset requests and initiator/cache evidence; it remains unqualified. WebKit native diagnostics still vary: one ResizeObserver arrival error and one successful resident Dione body-card arrival. Interruption waits for visible pending progress. Settings deep links use `settings=1` and verify the served prepared settings. Earth-system also opens settings and checks the live restored shadows checkbox; its fourth Chromium batch still reproduces a texture request count of one versus two.

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

The [manifest ID contract](../site/journeys/manifest-ids.json) preserves all 319 S0 ids and validates each `exercises` entry. `node site/journeys/run.mts --coverage --require` exits **1** when any id lacks a qualified journey/profile pair or reviewed exemption, listing every missing id; complete coverage exits **0**. Current fresh receipts report controls **3/101**, handlers **31/189**, capabilities **3/29**, and combinations **6/159**. Counts report observed controls out of 101, handlers out of 189 and capabilities out of 29; the previous declaration-audited counts are not retained as evidence. Without `--require`, coverage reports the reached and unreached lists. An explicit `--profile` restricts the report to that profile; otherwise qualified pairs across all profiles contribute.

The committed [unreachable list](../site/journeys/unreachable.json) contains only the S0-reviewed physical-iPad import-queue exclusion, with its one-line reason. Unknown ids, duplicate exemptions and ids exercised by any qualified pair are refused. New exemptions require review; lack of a journey is not a reason for exemption. Removing a native action makes its declared control/handler unobserved and turns the journey red in both-engine mutation tests. Stale action recipes and experimental pairs cannot add coverage.

Coverage credits only observed IDs common to every capture of a qualified pair. Trusted native events identify controls using unique, exact static markup fingerprints; tag-only, colliding or unresolved controls receive no credit. Listener invocation stacks resolve through the supplied build’s hidden source maps and S0’s AST owner/event/ordinal identities. Property handlers, observer callbacks and RAF sites remain uncredited until their mechanisms are instrumented. Raw registration evidence is saved beside the trace. Every declared ID must be observed or the journey fails.

`--combinations` reports each representative’s reached and unreached combinations against the preserved 159-entry S0 universe. Credit requires actual transport/startup and DOM or driven-action evidence in a qualified pair; declarations do not count. Direct startup evidence does not establish the in-app startup paths. The full coverage requirement remains red.

| Additional representative | Dataset action | Fresh Chromium evidence | Fresh WebKit evidence |
| --- | --- | --- | --- |
| lmc | VISTA infrared | pending fresh qualification | pending fresh qualification |
| neptune-system | 2017 visible, then 2018 step | 10+30 exact | 10+30 exact |
| beta-pictoris-system | Debris-disc color; require legend | application DOM drift | unattempted |
| asteroid-2001-sn263-system | Reselect sole shape dataset | 10+30 exact | 10+30 exact |
| mars-system | Chlorine, then iron step | surface pixel drift | unattempted |
| observable-universe | Cutaway; require legend | pixel drift after 10 exact | unattempted |
| abell-1689 | Reselect sole optical dataset | 10+30 exact | 10+30 exact |
| centaurus-cluster | Reselect sole members dataset | 10+30 exact | 10+30 exact |
| great-attractor | Reselect sole galaxies dataset | 10+30 exact | 10+30 exact |
| local-group | Reselect sole galaxies dataset | 10+30 exact | 10+30 exact |

Together with Milky Way, Earth-system and Dione above, these are all thirteen S0 representatives. The new journeys are intended to open and close settings, then use a native dataset button; fresh instrumented qualification is measured separately from the earlier LMC result. Single-dataset objects have no alternative to switch to; legends are static panels with no toggle listener.

The four system journeys select their host using its visible native link and require the body card before datasets/settings. Neptune then selects the 2018 step; Mars selects the iron step. These are dataset actions, not SequencePlayer Play actions. Neptune has completed fresh 10+30 qualification in both engines. Beta Pictoris Chromium completes its actions but varies transient world-caption writes during native host selection. It remains experimental; no DOM history or pixels are masked. Mars Chromium completes every action but varies 40 Mars surface pixels during settings snapshots while DOM, geometry and dataset/step endpoints match. Its native paint cause remains unresolved; it receives no credit.

The [qualification command](../.github/scripts/journeys/qualify.mts) runs four ten-capture batches per pair, compares every batch to the first, requires positive comparison output and stops at the first unstable pair. After all four exact batches and boundaries, it saves the observed-ID intersection and current action recipe as a local qualification receipt. Changing the journey action body or recipe invalidates its receipt. Shared helper or observer changes require explicit withdrawal and requalification; historical receipts are not portable evidence.

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
node site/journeys/run.mts --combinations
node site/journeys/run.mts --coverage --require
for JOURNEY_PROFILE in chromium-desktop webkit-desktop; do
  node site/journeys/run.mts --checkout "$BASE_CHECKOUT" --dist "$BASE_CHECKOUT/dist" --out "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/run.mts --checkout "$HEAD_CHECKOUT" --dist "$HEAD_CHECKOUT/dist" --out "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/compare.mts --base "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE/run-1" --head "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE/run-1"
done
```

`--checkout` names the preview owner; otherwise it is inferred from the distribution's ancestors. Exit **0** means equal complete artifacts, **1** means differences or saved journey assertions, **2** means tool/infrastructure error. Previews, contexts and temporary browser roots close on normal/error shutdown; the preview child also closes on parent IPC disconnect.

To add a journey, export a typed `journey` with a unique id, validated `exercises`, any proven issue-order declarations and `run(api)`. Register it as experimental, set the step before actions, use the application navigation/input path and route/motion barriers, then run four ten-capture batches with the qualification command to produce its current local receipt. Build in performance mode to preserve the hidden maps required for listener identity; use a 6144 MB Node heap for this production build.

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
| WebKit-specific fault | Healthy A/B exact in both; fault Chromium exact, WebKit red | Errors; equal-length one-byte startup tripwire |

Saved rebuilt-source recordings were re-compared with the corrected differ. They remain applicable because the source substitutions and retained observers are unchanged. The older WebKit fault recordings could not establish a matching Chromium control because rebuild names/byte classes and versions differed. The new equal-artifact proof independently starts two identical healthy views in each engine, then a third view changing only `0` to `1` in an equal-length tripwire in the real startup module. Hidden maps shift their generated line while preserving original source positions. Healthy repeats and cross-copy comparisons are exact in both engines; Chromium’s fault view is exact green and WebKit’s fault view is errors red. Unchanged prepared files are shared read-only; the tested route HTML, module and map are independent files. No normalizer or detector changes are used.

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
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec playwright install --with-deps chromium webkit
(cd "$BASE_CHECKOUT" && NODE_OPTIONS=--max-old-space-size=6144 pnpm exec astro build --mode performance --outDir dist-journeys)
(cd "$HEAD_CHECKOUT" && NODE_OPTIONS=--max-old-space-size=6144 pnpm exec astro build --mode performance --outDir dist-journeys)
export JOURNEY_OUTPUT="$(mktemp -d "$PWD/output/journeys/ci-XXXXXX")"
pnpm journeys:mutations
node site/journeys/run.mts --combinations
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

Tranche 2 completes unfinished representative qualification and startup-combination coverage, remaining listener mechanisms and control families, real-time latency and perturbation runs, touch/tablet profiles, coast journeys and the physical iPad path. Native HTTP cache fidelity and complete cache/dependency evidence remain limitations.
