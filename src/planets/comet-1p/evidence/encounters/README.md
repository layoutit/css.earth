# Halley encounter mosaic evidence

Validated runtime revision: `4c9ba7bb163aa2b87c8ff4030690513943cb2390`, after integrating main's PR106. That revision predates the later spacecraft/missions integration from main (`310fb173f`). Its source projection, terrain, scene and runtime assets remain byte-identical after that integration; the recorded browser checks describe the earlier shared shell. The merge regenerates provenance in schema 2 and refreshes the spacecraft catalogue pins. The merge also passed [37 focused source, provenance and catalogue tests](merge-tests.log), [the full TypeScript checks](merge-typecheck.log), and [the Halley dataset-switching browser case](merge-conformance.json). Both comparison images were inspected on the published GitHub PR after repairing their embed URLs.

| Check | Result |
| --- | --- |
| [Focused tests](final-focused-tests.log) | 38 passed, including six new Vega decoding, camera, visibility, selection, overlap and reproducibility tests. |
| [Strict TypeScript](final-typecheck.log) | Full repository typecheck passed. |
| [Source verification](source-verification.log) | All 43 source records passed. Seven Vega archive inputs were freshly restored and verified through the normal acquisition recipe. |
| [Runtime ownership](runtime-ownership.json) | Halley and shared static closure passed. This static check does not claim native scheduling or camera-lifetime proof. |
| [Build and assembly](build.log) | Production build passed; all 473 object asset inventories assembled. |
| [Fresh public delivery](delivery.json) | 34 files, 7,372,158 bytes, no reused files; all hashes matched. This is installation size, not page transfer size. |
| [Chrome conformance](conformance.json) | Nine selected cases passed: initial shell, desktop, mobile, both dataset-interaction densities, DPR 1/2, racing loads and reacquisition. |
| [Production cameras and assets](capture-manifest.json) | Three identical saved cameras at DPR 1/2, 12 captures total; loaded body asset bytes matched the corresponding inventory. Shadows off, one scene, no page errors or broken images. |

The conformance harness uses the development inspection APIs. An initial attempt against ordinary production stopped at its diagnostic readiness check because those APIs are deliberately disabled there (`site/diagnostics-policy.mts`). The production captures use public DOM, URL and request evidence and do not need those APIs. Unselected conformance cases and the full repository test suite are not claimed as passes.

## Browser comparisons

| Camera | PR109 | Encounter mosaic |
| --- | --- | --- |
| Original Giotto region | [DPR 1](before-giotto-side-dpr-1.webp) · [DPR 2](before-giotto-side-dpr-2.webp) | [DPR 1](after-giotto-side-dpr-1.webp) · [DPR 2](after-giotto-side-dpr-2.webp) |
| Vega-facing side | [DPR 1](before-vega-side-dpr-1.webp) · [DPR 2](before-vega-side-dpr-2.webp) | [DPR 1](after-vega-side-dpr-1.webp) · [DPR 2](after-vega-side-dpr-2.webp) |
| Further rotation | [DPR 1](before-far-side-dpr-1.webp) · [DPR 2](before-far-side-dpr-2.webp) | [DPR 1](after-far-side-dpr-1.webp) · [DPR 2](after-far-side-dpr-2.webp) |

Every pair uses the same 30 km distance, saved pose matrix, viewport and density. `scene.json` and `terrain.json` are byte-identical to PR109. The shared shell includes the independently merged moon-system change, so background/navigation differences are not attributed to Halley photography. These are coverage comparisons, not pixel-parity claims. WebP files are lossless; decoded RGB was checked equal to the original Chrome PNG, with both hashes retained.

The [capture script](capture.mjs.txt) and [saved cameras](saved-views.json) can be copied to `output/playwright/halley-mosaic/` as `capture.mjs` and `saved-views.json`, then run with `node output/playwright/halley-mosaic/capture.mjs before <baseline-server>` or `after <current-server>`. The script restores the public shared view after dataset selection applies its prepared focus. It does not write private camera state. The [packaging script](package-evidence.mjs.txt) validates paired camera queries, asset hashes, unchanged geometry and lossless image conversion.

## Source registration

[T11190 outline](t11190-outline.webp) and [T11194 outline](t11194-outline.webp) show the fixed projected source-model silhouette in cyan and withheld controls in orange on enlarged archive-image crops. They illustrate the authored registration. The freshly recomputed numerical checks are in [the projection report](../../source/reference/encounter-projection-report.json); silhouette consistency does not independently establish feature coordinates.

Photography: © MPS / Giotto HMC team; Vega 2 TVS team, KFKI processing team, IHW / NASA PDS. Shape: Philip Stooke with pointing by Alain Abergel. The [source terms and full credits](../../NOTICE.md) apply to these image portions too.
