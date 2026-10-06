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

`--repeat 2` requires exact traces and pixels. Qualification requires ten identical captures and thirty further captures, including batch boundaries. A drifting run fails and earns no qualification receipt. Tracked status changes require an explicit reviewed declaration; `--gate` refuses experimental entries. Defaults select only qualified pairs. A repeated saved journey assertion still exits 1, with focused content, PNG and a partial trace.

| Observer | Known effect |
| --- | --- |
| Network guard | Blocks non-loopback traffic. Default Playwright routing disables HTTP cache; native warm-cache journeys use the verified proxy mode below. Service workers are blocked; local `scenes/` is required. |
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

The [registry](../site/journeys/registry.mts) reads tracked [qualification declarations](../site/journeys/manifest-qualification.mts). A qualified entry must name its date-free measurement contract: forty captures, engine identities, four ten-capture batches, three compared boundaries, exact traces, RGBA pixels and observed IDs. A fresh checkout selects those pairs without receipts. Experimental pairs need an explicit selection and cannot enter `--gate`.

The [qualification command](../.github/scripts/journeys/qualify.mts) runs the four batches, compares every boundary, requires positive completion signals and checks all forty actual traces for profile identity, declared observations and errors. Its ignored local receipt records the current action recipe, known variations and common observed IDs. A declaration records the reviewed status; a receipt records local measurement. After measuring a new pair, explicitly update its tracked declaration with the measurement contract. Observer/helper changes require fresh qualification; an old receipt is not evidence for a changed harness.

The [CI lane](../.github/scripts/journeys/gate.mts) runs declared-qualified pairs in the requested profiles, then credits only observed IDs common to that lane's captures. It aggregates the engine runs before checking the full manifest. It reads no local qualification receipt. Removing an action makes its declared control or handler unobserved and fails the run, including in a fresh checkout. Removing its declaration too leaves the manifest ID missing and fails coverage.

The [manifest](../site/journeys/manifest-ids.json) preserves 101 controls, 189 handlers and 29 capabilities. Local `--coverage` reports current receipt-backed observations; `--coverage --require` fails if any ID lacks evidence or a reviewed exemption. `--evidence` instead reads a current lane's observations. `--coverage --require --dist ... --out ... --gate` records and gates one profile directly. Without an explicit profile, reports aggregate qualified profiles.

Coverage credits trusted native control activation with unique exact static markup fingerprints. Tag-only, colliding or unresolved controls get no credit. Invoked listener and RAF registration stacks resolve through production hidden source maps and stable AST owner/event/ordinal identities. Registration alone is insufficient; a cancelled RAF gets no credit. Raw invocation evidence stays beside the trace. Property handlers, observer callbacks and worker-global bindings still need their own mechanism attribution.

The [unreachable file](../site/journeys/unreachable.json) separates `reviewed` exclusions from source-backed `proposed` dispositions. Only reviewed entries affect the gate. Every proposal names its reason and exact evidence; the owner must approve it by moving it to reviewed. The physical-iPad import-queue exclusion is reviewed. The hidden diagnostic recorder, production-host-only error-report bootstrap and loading-world disposal abort are proposals, with no exemption credit. Unknown reviewed IDs, duplicate dispositions and qualified/exempt overlap fail.

`--combinations` reports the thirteen representatives against the preserved 159 capability/startup combinations. It accepts current-lane evidence too. Credit requires actual transport/startup plus resident or driven-action witnesses; neither object declarations nor a direct-load witness establish in-app startup combinations. Post-selection facts and destination startup ownership still need stronger witnesses.

Current local measurement: **controls 2/101, handlers 31/189, capabilities 2/29, combinations 4/159**. Neptune and 2001 SN263 have current forty-capture receipts in both desktop engines. Other declared representatives require fresh receipts after harness changes; declaration alone earns no coverage. The full coverage gate remains incomplete.

## Capability witnesses

Journeys call `api.capabilityWitness(kind)` after the relevant native action. Witnesses read harness-owned observations and live state; callers cannot submit arbitrary evidence.

| Kind | Required evidence |
| --- | --- |
| DPR | Configured profile DPR, matching native `devicePixelRatio`, visible resident rendering geometry and surface dimensions |
| responsive | Trusted native resize delivery, changed viewport, resulting resident layout |
| reducedMotion | Matching media query and CV Mon prepared animation playback permission, sampled before and after a preference transition |
| tabFocus | Trusted Tab delivery followed by changed visible `:focus-visible` focus with a measured nonzero, nontransparent outline |
| touch / penPointer | Trusted browser-delivered pointer of the requested kind; touch also requires a touch profile |
| visibility | Trusted real hidden-to-visible `visibilitychange` sequence through native tab activation |
| worker | One application worker's URL, that same worker's completed native reply, zero jobs and held replies |
| coldWarmCache | Same-context cold load and revisit, same successful resource fetched cold then served from a native cache |
| coast | Application coasting followed by current rest, with actual changed writes during the coast |

Profiles include desktop DPR 1 and DPR 2 in both engines, Chromium mobile/tablet and equivalent WebKit DPR 2 touch profiles. Qualification accepts any registered profile and keeps its identity in the receipt. Native pen protocol input is available in Chromium; Playwright exposes no equivalent WebKit pen or multi-touch protocol API.

Cache-preserving captures use a verified Chromium browser-owned loopback HTTP proxy, with all foreign HTTP, CONNECT and upgrade transport refused before forwarding. Routing is disabled in this mode so native HTTP cache works. Warm-cache journeys select it automatically; `--cache-preserving` selects it explicitly for other recipes. Chromium CDP must report a memory/disk cache hit for a resource fetched on the cold load. WebKit has no exposed native-hit metadata and is refused for this qualification mode.

The headed `chromium-desktop-visibility` profile provides a real visibility path. It attaches with Playwright's public `connectOverCDP({ noDefaults: true })`, which omits focus emulation, and runs one explicit journey per fresh browser. `api.visibilityTransition(hiddenCallback?)` activates another native tab, waits for actual hidden state, optionally inspects hidden playback, activates the journey tab again and validates the trusted transition. The browser profile stays under output, and its verified loopback proxy also blocks service-worker scripts before forwarding.

Headless Chromium, ordinary focus-emulated contexts and WebKit did not produce a real transition in these tests. Frozen/active lifecycle commands alone did not change visibility. These modes remain unsupported; no property replacement or synthetic visibility event is used.

The recorder attributes the four documented coast exceptions and six lab write patterns only to matching writes with their actual subject, property and application coasting state. It flushes pending mutations before motion state changes and requires completed rest. Selecting Earth, an orbit, a sky or a star bank alone earns no exception credit. Raw witness evidence is retained in `capabilities.raw.json`.

## Known application variation

[Tracked variations](../site/journeys/harness/known-variations.mts) name `{ id, step, measure, allowed, reason }`. Each measure is an exact family/subject-or-URL/field identity. There are no wildcard subjects, ranges, thresholds or pixel masks. Comparison permits only a value in that declared finite set; a changed neighbor or an unseen value fails. The declaration is recorded in the trace, while its actual observed value remains in the raw recording. A different declaration cannot be smuggled in through a trace.

Earth's settings deep link permits request count 1/2 for five individually named texture URLs. Every other request field remains exact. Beta Pictoris native host selection permits the two observed full ordered Naledi caption histories and their counts 7/8, as separate exact measures. These sets come from locked captures; fresh forty-capture qualification is still required before status promotion.

Wheel jitter affects ruler writes, altitude text and endpoint pixels; it has no supported bounded rendering set and remains experimental. Mars/Observable Universe paint drift, Dione transport/arrival errors and WebKit worker publication drift also remain experimental. Application fixes are outside the harness's ownership.

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
for JOURNEY_PROFILE in chromium-desktop webkit-desktop; do
  node site/journeys/run.mts --checkout "$BASE_CHECKOUT" --dist "$BASE_CHECKOUT/dist" --out "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/run.mts --checkout "$HEAD_CHECKOUT" --dist "$HEAD_CHECKOUT/dist" --out "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/compare.mts --base "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE/run-1" --head "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE/run-1"
done
```

`--checkout` names the preview owner; otherwise it is inferred from the distribution's ancestors. Exit **0** means equal complete artifacts, **1** means differences or saved journey assertions, **2** means tool/infrastructure error. Previews, contexts and temporary browser roots close on normal/error shutdown; the preview child also closes on parent IPC disconnect.

To add a journey, export a typed `journey` with a unique id, validated `exercises`, any proven issue-order declarations and `run(api)`. Register it as experimental, set the step before actions, use native input and route/motion barriers, then run four ten-capture batches with the qualification command. Review its local receipt before adding the tracked qualified declaration. Build in performance mode to preserve the hidden maps required for listener identity; use a 6144 MB Node heap for this production build.

## Detector and source proofs

| Observation | Independent browser mutations | Engines |
| --- | --- | --- |
| Network | Count, status, failure, cancellation, redirect, issue order; unexpected initiator | Both; initiator Chromium only |
| DOM | Transient membership, classification, attributes, scripted parser text | Both |
| Rendering | Geometry, exact pixels, playback permission, input timestamp | Both |
| Content | Text, title, URL/history values, root data | Both |
| Errors | Page error, rejection, console error/warning, worker error | Both |

The browser mutation lane checks stable controls, family-detector deletions in both engines, native playback/timestamp deletion, worker scheduling and foreign-request safety. Native reachability tests delete driven actions and RAF scheduling; capability tests reject missing native delivery and forged input. Individual-field deletion coverage beyond these named checks remains incomplete.

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

The equal-artifact engine proof starts two identical healthy views in each engine, then changes one byte in an equal-length tripwire inside the real startup module. Hidden maps preserve original source positions. Healthy repeats and cross-copy comparisons are exact in both engines; the fault is Chromium green and WebKit errors red. Unchanged prepared files are shared read-only; the tested route HTML, module and map are independent files.

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
(cd "$BASE_CHECKOUT" && NODE_OPTIONS=--max-old-space-size=6144 pnpm exec astro build --config site/astro.config.mts --mode performance --outDir dist-journeys)
(cd "$HEAD_CHECKOUT" && NODE_OPTIONS=--max-old-space-size=6144 pnpm exec astro build --config site/astro.config.mts --mode performance --outDir dist-journeys)
export JOURNEY_OUTPUT="$(mktemp -d "$PWD/output/journeys/ci-XXXXXX")"
pnpm journeys:mutations
for JOURNEY_PROFILE in chromium-desktop webkit-desktop; do
  node site/journeys/run.mts --checkout "$BASE_CHECKOUT" --dist "$BASE_CHECKOUT/dist-journeys" --out "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/run.mts --checkout "$HEAD_CHECKOUT" --dist "$HEAD_CHECKOUT/dist-journeys" --out "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE" --profile "$JOURNEY_PROFILE" --gate --repeat 2
  node site/journeys/compare.mts --base "$JOURNEY_OUTPUT/base/$JOURNEY_PROFILE/run-1" --head "$JOURNEY_OUTPUT/head/$JOURNEY_PROFILE/run-1"
done
node .github/scripts/journeys/gate.mts --checkout "$HEAD_CHECKOUT" --dist "$HEAD_CHECKOUT/dist-journeys" --out "$JOURNEY_OUTPUT/current-lane"
```

| Stage | Measured local cost |
| --- | --- |
| Direct journey, one capture | Approximately 2–7 seconds, depending on engine/object |
| Dione flight, one capture | Approximately 21–23 seconds |
| Recorder mutations, 49 focused cases | Approximately 147 seconds |
| Complete browser mutation lane, 77 tests | Approximately 247 seconds |
| Full production build, preserved source proofs | 265–357 seconds per build |
| Direct qualification, 10+30 per object | Approximately 93–270 seconds per engine/object |
| Multi-step Neptune qualification, 10+30 | Approximately 13 minutes per desktop engine |
| Compare one direct pair | Approximately 0.3–0.8 seconds |

These are local measurements, not CI guarantees. Browser installation, input restoration and hosted runners remain unmeasured.

Remaining work includes uncovered control/listener mechanisms and startup combinations, real-time latency/native scheduling, headless/WebKit visibility, WebKit cache evidence and the physical iPad path.
