# Planet cross-section repair and Earth mantle tomography

Earth's mantle now shows **GLAD-M35 r0.1 (2024)** seismic-model values on both
cut planes and the outer mantle shell. Colors encode vertically polarized
shear-wave velocity relative to the area-weighted global mean at the same
depth, with an unshaded ±3% legend. Crust and core remain schematic. The numeric
subset, authoritative metadata, original NetCDF hash and deterministic extractor
are checked in; source definitions and limitations are documented in
[Earth's source record](../src/planets/earth/SOURCE.md#mantle-tomography-source-and-interpretation).

The original 343.8 MB volume is used only for source extraction. Normal offline
preparation reads a 520 KB numeric subset; browsers load prepared WebP textures.
No DOM geometry or camera topology was added for tomography. Six source-value
anchors and six independent full-volume texel anchors verify sign, depth,
latitude, reference mean and final texture sampling. Numeric subset extraction
reproduced byte for byte from the upstream NetCDF. The tests also check missing
depths, exterior registration, the palette and stale-cut rejection.

The earlier eight-planet repair evidence below predates tomography. The final
tomography validation and integrated screenshots are recorded separately so the
old schematic images are not presented as evidence of the new data textures.

Earth's cutaway no longer cancels the shared camera rotation. Selecting Cross section makes a 650 ms north-up entry into the cut, preserving the current zoom; subsequent drag rotates the same retained model as the exterior. The mantle and outer-core polar atlases now remove the same wedge as their shells, so those caps no longer cover the opening.

Earth and Mercury now select complete prepared lit/unlit exterior banks when Shadows changes. Schematic layers retain illustrative shape shading; Earth's scientific mantle colors use the legend without lighting tint. No runtime geometry or imagery generation was added. Saturn's existing cutaway was checked without changing its rendering.

![Earth after a native drag in the production build](evidence/planet-cross-sections/earth-production-drag.png)

## Eight-planet browser sweep

The existing registry-derived conformance harness exercises every authored dataset at a 1440 × 1000 viewport, at DPR 1 and 2. It selects the real controls, drags the rendered geometry, verifies that the original leaves remain connected, checks scene/DOM counts, and rejects browser/network errors. Cross sections additionally require a visible image change when Shadows switches.

| Planet | Datasets at each DPR | Selection and drag | Cross-section Shadows |
| --- | ---: | --- | --- |
| Mercury | 4 | Pass | Pass |
| Venus | 3 | Pass | No cross section |
| Earth | 5 | Pass | Pass |
| Mars | 3 | Pass | No cross section |
| Jupiter | 3 | Pass | No cross section |
| Saturn | 5 | Pass | Pass |
| Uranus | 3 | Pass | No cross section |
| Neptune | 3 | Pass | No cross section |

That is 58 dataset runs, plus eight initial-shell checks. [Measurements](evidence/planet-cross-sections/planet-matrix.json) and [all eight default views](evidence/planet-cross-sections/all-planets.png) are retained. Separate production-build checks used native drag on all three cross sections and verified that their original geometry nodes remained connected: [receipts](evidence/planet-cross-sections/production-drag.json), [Earth entry](evidence/planet-cross-sections/earth-production.png), [Mercury](evidence/planet-cross-sections/mercury-production.png), [Saturn](evidence/planet-cross-sections/saturn-production.png).

To repeat the browser sweep with a development server:

```sh
for planet in mercury venus earth mars jupiter saturn uranus neptune; do
  CSSEARTH_CONFORMANCE_CASES=initial-shell,dataset-interactions,dataset-interactions-dpr-2 \
  CSSEARTH_CONFORMANCE_OUTPUT=output/playwright/cross-sections/$planet \
    node site/test/planet-browser-conformance.mjs http://127.0.0.1:4210 "$planet" || exit $?
done
```

## Preparation, delivery and other checks

- Full Earth and Mercury asset preparation completed. All 300 object envelopes were regenerated, and all 301 Astro pages built successfully with `NODE_OPTIONS=--max-old-space-size=12288`. Production asset assembly verified all eight planets.
- Both preparation and renderer typechecks passed. The focused Earth/asset-parity tests passed (33), as did the new Mercury lighting transaction test. Shared router/lifetime checks passed (35).
- All eight source/runtime asset closure checks passed (24). Seven existing authored-content manifest pins were stale; this change synchronizes them with the already-committed content, without changing those datasets.
- The prepared texture-layout census and runtime-ownership audit also passed for all eight planets: [contract receipt](evidence/planet-cross-sections/contracts.json).
- The 22 changed files were published to immutable content-hash URLs. A fresh install downloaded and verified all 283 Earth/Mercury files, followed by HEAD verification of the 22 changed files. [Delivery receipt](evidence/planet-cross-sections/delivery.json).
- Earth’s total installed image inventory grows by 2,662,796 bytes; Mercury’s by 6,931,370 bytes. These are inventory sizes, not initial-page transfer measurements. Every previously accepted Mercury and Venus image/chart byte is retained.

The aggregate suites are **not green**. The initial planet suite had 326 passes and 23 failures; one camera assertion was updated for the intentional Earth entry and passed in the focused rerun. The other 22 failing test names reproduce on the unchanged `e018ba392` base. The platform suite had 2,059 passes and eight failures: six assertions also reproduce on the base, while two registry-wide audit processes exceeded Node's default heap. These older fixture/retired-feature failures and audit limits are listed in the [baseline receipt](evidence/planet-cross-sections/baseline-failures.json); this PR does not claim aggregate readiness.

[Implementation and prepared-data fingerprints](evidence/planet-cross-sections/fingerprints.json) bind this evidence to the repaired sources. Browser evidence covers desktop Chrome at two densities, not physical mobile hardware.
