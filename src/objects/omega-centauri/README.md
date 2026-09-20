# Omega Centauri (NGC 5139)

**Application integration candidate; visual acceptance remains blocked.** The
selected Lab result now replays into the shared application volume contract with
459 retained slabs per optical lens. It still fails the fixed axis-handoff image
gate. Cold compact replay, R2 restoration and native arrival/navigation checks
pass. Close-ups now suppress surrounding detailed models and restore them on
zoom-out. Successful navigation does not establish visual acceptance.

## Sources

| Lens | Native image and coverage |
| --- | --- |
| [VST/OmegaCAM, eso1119b](https://www.eso.org/public/images/eso1119b/) | G/R/I display composite; 14540 × 14540 pixels; 50.88′ square. Selected geometry/light reference. |
| [MPG/ESO 2.2-m WFI, eso0844a](https://www.eso.org/public/images/eso0844a/) | B/V/I display composite; 8040 × 7560 pixels; 31.88′ × 29.99′. Same model geometry, different image material. Two mosaic gaps contain publisher-supplied DSS data. |

The [source manifest](source/manifest.json) retains exact image identities, full
credits and ESO's reuse terms. Stellar light is preserved; no separate star layer
counts it twice. Published display colors do not establish natural color or
calibrated luminosity.

The [MGE recipe](source/bake-inputs/references/02-photometric-mge.json) uses the eight
projected Gaussians in [D’Souza & Rix (2013), Table 1](https://doi.org/10.1093/mnras/sts426).
The selected inclination is 50° and photometric major-axis PA 100° east of north.
The [5426 ± 47 pc distance](https://doi.org/10.1093/mnras/stab1474) is the combined
NGC 5139 distance in Baumgardt & Vasiliev (2021), Table 2. This locates the cluster,
not individual stars. Competing fits and the rejected spherical King-Abel
experiment remain in the [physical evidence](source/bake-inputs/references/04-physical-evidence.json).

## Evidence

- The selected result is `7a4f8781a7d19fafa57f11e65eae6ee24975082d3fcae0c1644cbdd68a5ac549`.
  Its [delivery recipe](source/delivery.json) explicitly records
  `app-integration-candidate` and failed visual handoff. The legacy field
  `acceptedLabResult` identifies this selected source; it is not an acceptance
  certificate.
- The 2,277,027-byte [compact input](source/bake-inputs.json.gz), SHA-256
  `869e9ab24b644c4ea7d04cf2d4e2c719445c205b879eaebf13a420c7d7d75eac`,
  retains the emission field, component materials and adaptive sampling.
  [Cold application replay](evidence/2026-09-20/cold-replay.json) reproduced all
  1,377 expected raw resource identities across neutral and two optical banks,
  then matched all 60 prepared delivery files in 218.60 seconds. It started
  without the local cache, Omega prepared files or staging outputs.
- The [object descriptor](object.json) and [prepared inventory](prepared-assets.json)
  identify the current local delivery. Both optical lenses have 459 retained
  planes, 29 packed resources and zero separate stars. The
  [runtime inventory](runtime-assets.json) separately pins the two dataset previews.
  These file checks do not qualify the rendered appearance.
- The generic application discovery functions admit one destination at
  `/sun/?focus=omega-centauri`, classified as a Galactic globular cluster.
  [Controlled-camera browser automation](evidence/2026-09-20/app-inspection.json)
  captured both lenses, front/oblique and both side axes, with seven captures, no
  page errors or failed requests, one mounted scene/camera and no canvas. It applies
  inspection camera poses after mounting; those captures alone do not prove native
  arrival or pass the visual handoff gate.
- The separate [native navigation check](evidence/2026-09-20/native-focus.json)
  verifies automatic arrival on both cold and warm visits at a projected radius
  of **204.5516 pixels** in a 1440 × 1000 viewport, without injected inspection
  poses. Real drag and wheel inputs changed orientation and distance; reselection
  restored the arrival framing. No page errors or failed requests were recorded.
  Only Omega's volume bank mounts at cold arrival; the Milky Way overview is
  hidden. Real wheel input out to 100 framing radii restores the surrounding
  models, and reselection hides them again. The shared presentation fade is
  zero through eight radii and fully restored by 32; camera coordinates and the
  Sun-distance sky contribution are preserved. These checks close the arrival
  and context-visibility defects, not the visual limits below.
- Three [native performance baselines](evidence/2026-09-20/performance-baseline.json)
  reproduced slow dragging. A [page-only visibility control](evidence/2026-09-20/performance-background-control.json)
  reduced the identical 40-step drag from 33.06 to 8.38 seconds by hiding the
  other detailed banks. Chromium used SwiftShader software rendering: these
  measurements isolate background rendering cost, not desktop GPU frame rate.
- Three [actual-policy repeats](evidence/2026-09-20/performance-after.json), with
  no visibility override, took **8.11–8.19 seconds**, versus **32.17–32.70 seconds**
  before the fix. [The comparison](evidence/2026-09-20/performance-comparison.json)
  verifies identical starting and ending camera poses: median drag time fell
  74.79%, and cold DOM residency fell from 29,063 to 18,068 elements. SwiftShader
  remains the measurement environment. [Regression and mutation checks](evidence/2026-09-20/context-regressions.json)
  cover fetching, painting, selected-bank preservation and sky composition.
- [R2 restoration](evidence/2026-09-20/r2-restore.json) fetched and hash-verified all
  64 pinned assets into an empty target; an immediate repeat reused all 64 with
  no downloads. This proves the pinned published bytes, not scientific accuracy.
- The final build, 594 renderer tests and 29 source/provenance tests pass.
  The [broad shell run](evidence/2026-09-20/shell-tests.tap) passes 376 of 399
  tests; 23 fail on other object data, legacy fixtures or test-loader setup.
  Those failures were not independently reproduced on current main. The
  [validation record](evidence/2026-09-20/validation.json) separates this run
  from the passing native-navigation and context regressions.
- [Retained Lab measurements and views](../../../labs/nebula/models/omega-centauri/evidence/2026-09-20/README.md)
  identify the tested candidate. Its neutral X/Z and Y/Z normalized L1 values are
  **0.124987 and 0.114655**, above the fixed 0.04 limit. Both optical lenses also
  fail that image-stability gate. Neutral X/Y additionally exceeds the 0.05
  brightness limit. The optimizer's coarse target result is not a visual certificate.

Local application preparation ran on 2026-09-20 using code at
`862cdbed96bbca43cdf1f13549c94e4ca501add3` plus the uncommitted Omega object package
and scoped provenance selector; native navigation was checked with the subsequent
uncommitted shared focus and context-visibility fixes. The exact input and output inventories above
identify that candidate; the commit alone does not contain its app package. The
[retained validation record](evidence/2026-09-20/validation.json) binds these local
checks and the [native arrival](evidence/2026-09-20/native-arrival.png),
[front](evidence/2026-09-20/front.png),
[oblique](evidence/2026-09-20/oblique.png),
[X-side](evidence/2026-09-20/side-x.png),
[Y-side](evidence/2026-09-20/side-y.png) and
[WFI](evidence/2026-09-20/wfi.png) views to that working-tree state.
[Replay references](source/replay-references.json) resolve every retained research
input through an application-owned copy. [Provenance references](source/provenance-references.json)
pin those copies to the research files at that commit. No current Lab-file reads
are required for compact replay.

The [2026-09-21 merge check](evidence/2026-09-21/merge-validation.json) records
integration with main at `3aebc31094dff8332755b394b88c708b7c3f1062`. A fresh
[native navigation run](evidence/2026-09-21/native-focus.json) preserves the
204.5516-pixel cold/warm framing and close-up/background restoration behavior.
The model, textures and recorded context-owner pins are unchanged; the six views
and performance measurements above remain the explicitly dated earlier evidence.

## Known problems

- Desktop GPU performance has not been measured. The headless visibility control
  shows a substantial background cost, but does not establish a desktop frame rate.
- The shared zoom minimum remains **0.05 framing radii (2.17 pc)**. The wheel
  check reached that limit; it does not establish an acceptable close-up view.
  This is separate from the corrected automatic arrival framing.
- Axis-handoff image stability remains outside the unchanged acceptance limits.
  Earlier Lab inspection also exposed a false grid and an oblique compositor
  rectangle; successful app preparation does not close those renderer findings.
- Near/far tilt and the six-sigma numerical support cutoff are authored. The
  MGE's coefficient uncertainties are unavailable; modern kinematic inclination
  cannot be substituted without checking mathematical admissibility.
- Absolute astrometry starts from publisher AVM. Relative image registration
  does not establish absolute Gaia astrometry or independent WFI detections in
  DSS-filled gaps.
- The 512-pixel fit and minimum 5.80-arcsec projected sigma soften native stellar
  texture. Crowding, saturated cores, seeing and publisher display stretches remain.
  Fitted light features are not a resolved-star catalogue, dynamical mass map or
  N-body simulation.

## Method and earlier trials

A smooth oblate MGE envelope carries broad integrated starlight; finite positive
image residuals receive conditional depths and lens-specific materials. Both
optical lenses use the same geometry. The
[method account](../../../labs/nebula/models/omega-centauri/README.md) explains the
numerical choices and retains earlier trials: bake 1 was rejected for bright
clumps, bake 2 stopped during material painting, and bake 3 completed after the
roundoff correction but retained the failed neutral handoff. Adaptive grouping
reduced the 779 retained slabs to this 459-slab candidate without passing that gate.

The [investigation ledger](investigations.json) records selected sources,
alternatives and unresolved acceptance. Shared preparation and replay commands
belong in the [nebula guide](../../../docs/nebulae/README.md).
