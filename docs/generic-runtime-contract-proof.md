# Generic runtime contract proof

All eleven registered objects now use `createRetainedCubicSkyOrbit`, the existing
shared controller used by Saturn. Mercury, Venus, and Mars no longer implement
private camera state, wheel/drag controls, responsive fitting, or camera cleanup.
Their remaining bindings publish object-owned prepared materials and diagnostics.
This completes the controller migration within PR #2.

## Contract and ownership

| Responsibility | One shared owner | Object-supplied data or behavior |
| --- | --- | --- |
| Registration and loading | `OBJECTS`, `objectAdapter.load` | ID, route, content, scene loader |
| Shell and controls | `PlanetShell`, shell client | Actual optional lens/settings content |
| Mount readiness, playback permission, fatal cleanup | Scene router, scene lifetime | `ready`, `pause`, `resume`, `destroy`; native animation handles |
| Image decoding and control races | Prepared image store, latest selection | Prepared URLs, material residency policy, publication callback |
| Camera state, input, zoom limits, fitting, orientation, cleanup | `createRetainedCubicSkyOrbit` | Prepared camera/sky/sun plans, mounted retained handles, material hooks |
| Camera projection | `createPreparedCameraPublisher`, called by the shared controller | Prepared perspective and scene scale |

The shared controller exports `state`, `setState`, `refresh`, `invalidate`,
`destroy`, `stats`, `skyState`, `initialResponsiveZoom`, and `mobilePageFlow`.
`invalidate` contains native cache callback failures through the common fatal
owner. Synchronous `setState`/`refresh` report failure and rethrow, preventing a
failed publication from continuing a successful commit path. Disposal makes
late callbacks inert. Object-specific material diagnostics may extend
`skyState`; they do not own camera input or state transitions.

Venus now supplies `sceneScale: 0.038` in its prepared camera. Deleting that field
from the regenerated scene produces data identical to `be3ddf6`. No other Venus
prepared content, source inputs, or image assets changed in this migration.

## Executable evidence

1. **Source ownership:** `tools/generic-orbit-contract.mjs` derives packages from
   `OBJECTS`, parses every runtime module, and requires exactly one construction
   of the common controller per package. It rejects the private input, camera
   publication, orientation, fitting, and listener paths removed here. The shared
   controller's nine-module local import closure contains no object-package
   imports. This is a practical AST regression check, not a formal proof against
   arbitrary obfuscated code.
2. **Actual registered mounts:** `site/test/generic-orbit-browser.mjs` instruments
   the entry to the real shared constructor in installed Chrome. All 11 IDs at
   DPR 1 and 2 each constructed it exactly once, with the actual mounted camera
   and scene elements, and exactly one retained camera in the document.
3. **An ID the application does not know:** the same browser test checks that
   `unregistered-contract-probe` is absent from `OBJECTS`, then loads a fixture
   through the actual `objectAdapter.load` with an injected test record and
   validates the actual scene lifecycle. At DPR 1 and 2, real pointer and wheel
   input, zoom clamps, mobile wheel policy, resize, retained identity, constant
   perspective, teardown, and late-call inertness passed. The fixture contains
   authored static diagnostic leaves and reuses prepared sky data; it is not a
   shipped object or a source-accuracy claim.
4. **Checks that fail when the contract is broken:** the source check rejects
   the previous PR head `be3ddf65d781bf08552afa35e0343cf7d0895299` because Mercury
   directly owns camera publication. Tests also reject aliased private controls,
   namespace private controls, direct wheel/resize listeners, and a registered
   object that stops constructing the common controller. Injecting a hardcoded
   whitelist of current `OBJECTS` IDs into the actual browser constructor makes
   the unregistered fixture fail with `mutation: hardcoded object registry`.
5. **Failure behavior of the migrated bindings:** 24 tests compose the actual
   Mercury/Mars/Venus material binding functions with the actual shared orbit
   constructor and a minimal native-boundary fixture. Wheel, drag, resize, cache
   invalidation, refresh, state publication, media-change, and initial failures
   exercise once-only cleanup and late-callback suppression. The existing shared
   controller lifetime tests remain in force.
6. **The package contract also accepts new content:** the existing
   `site/test/object-package-contract.test.mjs` builds a `local-body` package
   with locally authored, non-NASA inputs, validates it, then verifies that
   corrupted prepared bytes and undeclared source files are rejected.
   `site/test/scene-contract.test.mjs` and `load-browser-profile.test.mjs`
   accept empty optional object controls while still requiring the shared shell
   and Motion control. These tests passed in the complete 629-test run.

The browser proof is the first gate in `pnpm test:browser`. It is followed by
all-object projection tests: 22 object/DPR cases with seven captured states each,
including rotation, both zoom limits, real drag and wheel, constant perspective,
zero scene-depth translation, and retained DOM identity.

## Validation on 2026-09-04

- `pnpm acquire:planets -- --verify-only`: passed for all 11 objects.
- `pnpm test`: 629 tests passed, zero failures.
- `pnpm build`: passed.
- `pnpm test:browser http://127.0.0.1:4230`: passed as one complete run,
  including 143 conformance cases, 22 playback cases, six compound-selection
  cases, all eleven real back/forward restorations, and all object smoke tests.
- Additional Mercury, Venus, and Mars smoke runs: passed. Mercury covered 525
  camera poses; Venus exercised pitches beyond both reference endpoints.

Installed Chrome: `152.0.7977.76`. The proof uses DPR 1 and 2. Local logs, complete
constructor traces, input states, source hashes, negative-control reports, and
154 projection screenshots are retained under
`output/playwright/pr2-generic-contract-20260904/`. A compact checked-in evidence
record is checked in as [generic-runtime-contract-evidence.json](generic-runtime-contract-evidence.json).

![All eleven objects using the shared controller at DPR 2](images/prepared-camera-all-objects.png)

All 44 saved DPR-2 scene comparisons (11 objects × default, rotated, minimum,
maximum) were inspected against the preceding projection-repair captures.
With Pixelmatch's existing 0.1 threshold, 43 had zero changed pixels; Earth's
rotated view had 348 changed pixels of 3,932,400. These are diagnostic saved-frame
comparisons of a fixed viewport crop (x 620, y 0, 2260 × 1740 pixels), not a
qualified strict baseline.
The preview's input image hashes are retained beside the reports.

The legacy standalone Mercury performance test failed its 540-element initial
DOM budget. A controlled browser substitution of the previous Mercury client
and the current client measured **1,814 stage elements and 900 retained leaves
on both**. This migration does not meet that older performance budget and makes
no performance improvement claim. Its thresholds remain unchanged.

This evidence establishes shared ownership and exercised behavior, including an
unregistered ID. It does not establish native-renderer parity or extend the
historical accepted Earth comparison into a new strict pixel audit. The earlier
strict baseline qualification failure remains documented in the
[implementation record](shared-runtime-implementation.md).

## Reproduce

From the PR checkout, start its server on a dedicated unused port, then run:

```sh
node --test site/test/generic-orbit-contract.test.mjs site/test/object-orbit-failure.test.mjs
CSSEARTH_CONTRACT_OUTPUT=output/generic-proof \
  node site/test/generic-orbit-browser.mjs http://127.0.0.1:4230
# Expected nonzero exit, specifically "mutation: hardcoded object registry":
CSSEARTH_CONTRACT_OUTPUT=output/generic-negative \
  node site/test/generic-orbit-browser.mjs http://127.0.0.1:4230 --reject-unknown
pnpm acquire:planets -- --verify-only
pnpm test
pnpm build
pnpm test:browser http://127.0.0.1:4230
```
