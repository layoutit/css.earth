# Generic runtime contract proof

The current strict source audits pass for all eleven registered objects: every
client binds the same v2 runtime, and each package supplies data to one shared
scene builder, material publisher, demand interpreter, camera and selection owner.
No private runtime executor or shared object-ID dispatch is present in the audited
closure. No new object or route was added to establish this result.

Final native-browser ownership, aggregate gates, full visual comparison and
payload/performance qualification are **PENDING** for the final integrated source.
The source audit itself reports native ownership as **UNPROVEN**. PR readiness
must not be inferred from this source result or the earlier focused checks.

## Current executable source evidence

| Claim | Evidence | Current result and limit |
| --- | --- | --- |
| Every registered object uses the same runtime | [`check-object-runtime-ownership.mjs`](../tools/check-object-runtime-ownership.mjs) follows the real `OBJECTS` client closures and actual control exports | All 11 use `cssearth-object-runtime@2`; one factory call per client; no private owners or orphan executors. |
| Shared runtime does not dispatch by object ID | The same audit checks the reachable shared closure and camera factory sites | Zero shared violations; one camera factory site in the common cubic-sky runtime. |
| Presentations and controls are data | [`check-prepared-presentation.mjs`](../tools/check-prepared-presentation.mjs) parses generated literal exports, validates thin definitions and actual control content, then applies the strict schema | All 11 pass; evidence is `validated-source-data`, with `observedOwners: null`. |
| Negative ownership and schema fixtures fail as intended | `tools/check-object-runtime-ownership.test.mjs` and `tools/check-prepared-presentation.test.mjs` | 41 focused tests pass in the review snapshot. |
| Actual native owners and lifetime match the contract | Final real-Chrome instrumentation at DPR 1 and 2 | **PENDING**. Static imports do not observe native cameras, scheduling, writes or resource lifetime. |

The audits record source hashes; the final delivery receipt must bind fresh reports
to the final source below. Their AST and schema checks are practical regression
barriers, not formal proofs against arbitrary JavaScript obfuscation.

The [architecture inventory](shared-runtime-architecture-proposal.md) lists the
remaining adapter data differences. The invariant is shared execution: different
frame banks, projection parameters, demand policies or optional page records do
not supply package callbacks. [`prepared-presentation.mjs`](../src/platform/prepared-presentation.mjs)
mounts all node records; [`prepared-material.mjs`](../src/platform/prepared-material.mjs)
publishes all material tracks.

## Focused evidence retained during implementation

| Scope | Observed result | What it establishes |
| --- | --- | --- |
| Saturn selection, shared mount and package checks | 64 tests passed | Exclusive cross-section and committed-state preservation, prepared data and focused shared-runtime behavior. |
| Parameterized ellipsoid helper | Five tests passed, including 900 independent analytic support cases | Radius, view, aspect, coverage and precision inputs work through a shared projection helper without DOM reads. |
| Native ellipsoid projection reference | All 96 camera/roll transforms match the [source-bound fixture](../src/planets/saturn/test/fixtures/ellipsoid-projection-reference.json) exactly | Raw transform preservation against the independently captured reference; not a full rendered-frame comparison. |
| Uranus/Neptune lens-control payload | 31 focused tests passed; actual old/new control objects are deeply equal; repeated control generation is byte-identical | Exact UI content and removal of the two large `preparedLenses.mjs` modules from production client closures. |
| Earlier Mars, Uranus and Neptune material migrations | Their retained receipts contain 4,608, 13,824 and 13,824 independent material-state cases respectively | Scoped material-state comparisons at those recorded sources; no qualification of later atmosphere or payload changes. |

These checks cover different snapshots and are not a substitute for one final
aggregate run. The shared atmosphere source now accepts Earth's Rayleigh/Mie
profile and Mars's calibrated isotropic profile. Mars's two directional ranges
use `frameOffset`, and both objects use the same material publisher. Regeneration,
source acquisition verification and final atmosphere visuals remain pending.

## Strict visual failures still open

The original failed readbacks remain under
`output/presentation-generalization/260905-001/`. No tolerance, mask or favorable
phase selection has turned them into passes.

| Retained receipt | Original unresolved difference | Status |
| --- | --- | --- |
| `B9/qualification-open.json` — Mars | Six desktop DPR 1 speed-3 scene frames; 70,093 changed pixels, maximum channel delta 2 | **OPEN**; subsequent matching diagnostic pairs do not establish the original cause. |
| `B11/qualification-open.json` — Uranus | Six desktop DPR 1 Shadows scene frames; 46,543 changed pixels per frame, maximum delta 1 | **OPEN**; later exact fresh-mount pairs do not explain the original failure. |
| `B12/qualification-open.json` — Neptune | Six mobile DPR 1 shell frames; 2,313 changed pixels per frame, maximum delta 1 | **OPEN**; the original candidate values were outside the reference variation. |

Those receipts have `strictPass: false` and do not qualify the final source.
Intentional changes, including Saturn's exclusive cross-section and the atmosphere
work, need their own current behavior and visual evidence. The final comparison
must retain every ordered readback and identify intentional changes separately.
No current all-frame pixel-parity or performance-improvement claim is made.

## Final delivery receipt

Populate this table only from the completed combined run. Until then, these fields
are **PENDING**, including where an earlier source passed a similar gate.

| Required receipt | Final result |
| --- | --- |
| Final PR #2 commit and exact source manifest/hash | **PENDING** |
| Fresh strict ownership and prepared-presentation reports bound to that source | **PENDING** |
| Prepared-output reproducibility, loaded asset hashes and source/provenance identity | **PENDING** |
| `pnpm acquire:planets -- --verify-only` | **PENDING** |
| `pnpm test` | **PENDING** |
| `pnpm build` | **PENDING** |
| `pnpm test:browser`, all registered objects in real Chrome at DPR 1 and 2 | **PENDING** |
| Native owner, retained identity, cancellation, remount and resource-lifetime observations | **PENDING** |
| Exact reference/candidate source, response bytes, browser/GPU and unchanged harness identity | **PENDING** |
| Full ordered matched visual comparison, including atmosphere and Saturn selection corrections | **PENDING** |
| Production closure, compressed payload, transfer and unchanged performance budgets | **PENDING** |
| Final PR #2 review summary with any remaining failed qualifications | **PENDING** |

The two source reports can be reproduced with:

```sh
node tools/check-object-runtime-ownership.mjs --all
node tools/check-prepared-presentation.mjs --all
```

A ready-to-merge claim requires the final receipts and an explicit account of any
remaining failures. See [the implementation record](shared-runtime-implementation.md)
for the code changes and preparation boundary.
