# Router context refactor evidence

Baseline: `4969e9edd80437bb231b62a9fd217e3049a0caed` (main). Candidate: `c3f222a5a61d5a7b288e0bbc6a2631b827a6b353`. Jankmonster: `17b263a`, same analyzer and source scope `site/scene` on both sides.

The report counts 537 → 521 syntactic branches, 4 → 0 variation candidates, and 43 → 40 bindings with observed writes. These are source measurements, not reachable-state counts. Three small callbacks now carry the ready context to scene reuse. The independent presentation/destruction/reduced-motion flags remain independent.

[Comparison](jankmonster-comparison.json) · [Pixelmatch settings, input hashes and both tolerances](pixelmatch.json)

| View | Main | Candidate | Diff at 0.1 | Exact diff |
| --- | --- | --- | --- | --- |
| Earth | [input](before-earth.png) | [input](after-earth.png) | [0 pixels](diff-earth.png) | [269 pixels](diff-earth-exact.png) |
| Solar System | [input](before-overview.png) | [input](after-overview.png) | [0 pixels](diff-overview.png) | [0 pixels](diff-overview-exact.png) |

Each view is 1440×900, DPR 1, Chrome 153.0.8010.53, Pixelmatch 7.2.0, includeAA true, default surface labels off and motion off. Textures use the unchanged inventory-addressed published origin. Exact Earth differences are confined to two 14px sidebar icons, at most 3 RGB levels; no pixels are masked. The repository-prescribed 0.1 threshold reports zero in both full images.

[Captures](after-capture.log) · [Navigation flows](navigation-flows.log) · [Settled history results](history-settled.log) · [10 focused checks](focused-tests.log) · [Shell typecheck](typecheck-shell.log)

The first history observation sampled DOM readiness while requests remained pending. The settled-history check waits for router readiness and confirms one mounted scene after back and forward. Persisted-page restoration uses synthetic pagehide/pageshow events; it does not qualify native browser bfcache behavior. Browser flows have no page errors; missing local search thumbnail requests remain outside this refactor. No full suite or performance measurement was run.
