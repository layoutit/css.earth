# B9 qualification

Integrated base: `80e19c51349f713c9a9a64b8ef1cbb78917f0fc7`.
The earlier `bd265cf3` captures are historical review evidence. Final integrated
capture labels use `b9-main`; their original reports retain their capture-time
paths and `CAPTURED_UNREVIEWED` status. Human acceptance is recorded separately.

## Scope and source proof

- Three existing moons, two new scientific surfaces each: Tethys, Iapetus and
  Phoebe receive measured-channel infrared and continuum-relative ice absorption.
- The final source packages contain 78 original/derived/evidence files (23,870,126
  bytes), pinned in each body manifest. They include 13 calibrated/navigation/raw
  observation groups and 21 TIFF products with exact native-pixel ownership.
- A new empty-directory replay seeded only original pinned dependencies and
  reproduced all 21 TIFFs byte for byte. It completed in 20.70 seconds; the bounded
  process-tree peak was 513,654,784 bytes. Original packages and helper pins stayed
  unchanged. [Reproduction procedure](reproduce-sources.py).
- Independent detector-quality, exposure-aperture, coordinate and mesh checks
  are linked from the [source review](README.md#source-and-independent-review).
  Phoebe's final 1440×720 map passed all 13,325 supported directions against all
  3,500 existing faces and 19,866 independently sampled physical-support checks.
- The prepared scene bytes, retained runtime tree and camera match the integrated
  main baseline for all three bodies. All 123 existing runtime images retain their
  exact bytes. B9 changes no shared renderer, shell, camera or navigation code.

## Runtime cost

| Body | New image files | New image bytes | Runtime JSON increase |
| --- | ---: | ---: | ---: |
| Tethys | 7 | 334,302 | 8,458 bytes |
| Iapetus | 7 | 67,060 | 9,650 bytes |
| Phoebe | 7 | 1,955,458 | 19,070 bytes |
| Total | 21 | 2,356,820 | 37,178 bytes |

The complete three-body image inventory has 144 files and 136,830,248 bytes,
including unchanged existing datasets. This is an inventory measure, not a
first-load transfer benchmark. Numeric source cubes/TIFFs are preparation inputs.

## Qualification status

| Check | Result |
| --- | --- |
| Numerical converters | 29 tests pass. |
| Scientific raster, quality, focus and profile tests | 27 tests pass; three missing non-B9 profiles restored from exact main before rerun. |
| Existing selected-moon tests | All nine pass. |
| Package tests | All 762 pass, serial workers. |
| Component builds | Packages, renderer and preparation tools pass. |
| Mounted visuals | All 36 cases pass; final visual acceptance on all three bodies. |
| Existing shared interaction conformance | 21 selected cases pass; 24 other cases explicitly skipped. |

Passing selected checks does not establish whole-registry readiness. The PR is
kept in draft because these broader gates remain open:

| Aggregate gate | Actual result in this checkout |
| --- | --- |
| Renderer | 352 tests pass, 17 fail; 16 files fail including missing fixture imports. |
| Platform | 419 pass, 1,349 fail, largely missing non-B9 source/prepared/catalogue inputs. Also includes stale non-B9 transport pins and upstream-manifest assertions; failures are not all proven baseline defects. |
| Shell | 251 pass, 34 fail, including missing registry fixtures and aggregate assertions. |
| Production | Compilation completes; static rendering stops at missing Polymele `prepared/object.json`. Earlier missing legacy comet CSS was restored from exact main. Full build/assembly remains unqualified. |

The aggregate suites were run separately with serialized workers. `astro build`
ran after component builds; this does not establish the complete `pnpm build`
lifecycle or assembly. The [raw checks](evidence/checks/) preserve failures as
well as successes. [Interaction evidence](evidence/conformance-summary.json).

The source/runtime/image package closure passes for all three bodies. The shared
ownership audit is blocked by the exact same static-registry/dynamic-loader
violations on integrated main; the verification helper compares the complete
violation lists against that base. This is recorded as
`SELECTED_PACKAGES_PASS_SHARED_AUDIT_BLOCKED_ON_BASELINE`, not a passing shared
audit. Missing sparse-checkout metadata was restored from exact main before the
successful selected-package rerun.

Image delivery and the final material replay receipt are recorded with the final PR evidence.

## Interpretation and visual limits

These are partial, uncorrected observations. Absorption strength is not ice
abundance. Illumination, geometry, grain size, noise and archive filtering remain.
Tethys's independent USGS brightness comparison is non-diagnostic for absolute
alignment; Iapetus supports gross framing only. Phoebe retains coarse fitted
regional placement and only 41 native source pixels; the second observation is
withheld after failed untouched holdouts. Output-grid density is not native
resolution, and weighted angular coverage is not physical mesh area.

The existing photographic packing/WebP path can soften infrared mask boundaries.
Lossless native values and owner rasters retain their exact missing-data policy.
Existing coarse terrain and directional-lighting facets remain visible. Capture
checks exercise the existing shadow input binding; they do not prove the hidden
public Settings button is reachable. No compositor FPS, general performance,
native-renderer parity or deployment claim is made.

Substantial jobs run serially. Failed captures, incomplete sparse-checkout runs
and the earlier combined Iapetus DPR2 memory-guard stop are excluded from final
passing evidence. The refreshed captures use one lens per process.
