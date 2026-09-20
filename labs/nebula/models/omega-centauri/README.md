# Omega Centauri (NGC 5139)

**Blocked at visual qualification; not delivered.** Omega Centauri is registered in
the Lab and uses a published oblate MGE light profile. Bake 1 completed but was
visually rejected. Bake 2 produced neutral geometry, then failed during lens
painting. Bake 3 completed for local inspection after the material roundoff fix;
its unchanged neutral geometry still fails the axis-handoff image gate. A separately
authorized adaptive-layer bake reduces retained slabs from 779 to 459 but also
fails that gate; see the layer-optimization experiment below. No app
promotion, merge, or Omega R2 publication/restoration has been completed.

## Current method

[photometric-mge.json](photometric-mge.json) transcribes the eight projected
Gaussians in D’Souza & Rix (2013), Table 1, with a pinned source PDF and
[physical evidence](physical-evidence.json). The selected conditional model uses
PA 100° east of north, inclination 50°, and distance 5426 ± 47 pc. Its near/far
tilt sign and six-sigma numerical cutoff are authored; they are not measurements.
[The method note](mge-method.md) gives units, deprojection and competing constraints.

The generic photometric compiler separates a smooth MGE envelope from finite
positive image residuals. The current candidate uses an authored envelope fraction
of 0.95, an 8-fit-pixel smoothing scale, and a maximum of 4096 residual features.
Each residual receives one conditional depth and finite XYZ material; each optical
lens supplies coarse envelope chromaticity and component colors on common geometry.
The selected analytic fit retained 4085 features, with total RMSE 0.03825, 5.90%
missing light and 17.79% excess light. These display-fit metrics are not a visual
acceptance or a calibrated photometric validation.

The field represents **integrated starlight**, not resolved member stars. Source
stellar light is preserved, with zero extracted stellar residual and no separate
star catalogue layer. The 512-pixel fit grid and minimum projected sigma of 0.9
fit pixels (5.80 arcsec here) cannot recover native stellar widths or all crowded
core texture. This is neither measured stellar depth nor a dynamical mass model.

## Source images

| Lens | Native publisher image |
| --- | --- |
| [VST/OmegaCAM, eso1119b](https://www.eso.org/public/images/eso1119b/) | Optical G/R/I, 14540 × 14540 pixels, 50.88′ square; light/geometry reference. |
| [WFI, eso0844a](https://www.eso.org/public/images/eso0844a/) | Optical B/V/I, 8040 × 7560 pixels, 31.88′ × 29.99′; second material lens. Some publisher mosaic gaps contain DSS data. |

Native TIFFs, complete AVM metadata and identities are pinned. Angular registration
uses native dimensions. Earlier 8192-pixel WebP preparation is historical; it is not
the current scientific source. ESO credits and reuse terms are retained in the
[observation recipe](observations.json): VST credit is ESO/INAF-VST/OmegaCAM,
with acknowledgement to A. Grado and L. Limatola/INAF-Capodimonte Observatory;
WFI credit is ESO. Both follow the [ESO image-use terms](https://www.eso.org/public/outreach/copyright/).

## Native registration

The [current native receipt](native-registration.json) passes the unchanged field-star
gate with **1,899 automatic VST/WFI correspondences, 633 held-out stars and 0.0972 arcsec
held-out RMS**. All four spatial quadrants are covered; the held-out stars span over 99.7%
of the common image footprint in each direction. This validates relative registration,
not absolute sky coordinates, stellar membership, depth or photometry. The publisher says
some WFI mosaic gaps use DSS data; those regions are not independently attributed detections.

The earlier recipe incorrectly put each AVM reference coordinate at the raster centre.
Both native TIFFs actually carry noncentral reference pixels in a smaller AVM reference
grid. Keeping those complete embedded WCS records fixes the roughly 100-arcsec relative
offset without a fitted calibration or relaxed gate. The source pins, exact AVM values,
gate metrics and failing recentred/corrupted-identity controls are in the receipt.
`verify-registration.mts` checks the embedded metadata against the processing recipe and
replays the fit from the prepared native source cache. A small spatially distributed
native-star fixture tests the same defect without requiring the large images in CI.

[The original pointing check](registration.json) and [DSS trial](dss2-fits-registration-report.json)
are preserved historical results from the incorrect metadata transcription. The former's
0.24-arcsec centre comparison is roughly one native pixel, despite its original sub-pixel
wording. Neither historical receipt qualifies the corrected native inputs.

## Actual results and current blocker

The current inspection uses **459 retained slabs**, with one neutral bank and two
optical lenses. [Front, oblique and both side views](evidence/2026-09-20/README.md)
show the actual retained-DOM compiler renderer. The inspection wrapper is not the
main application or a promoted Lab delivery. The object remains a research subject;
no unfinished application package or new runtime bank is shipped here.

- **Bake 1:** `41d62d…c3e962` completed but was visually rejected for large bright
  clumps from the finite supports.
- **Bake 2:** `412d07…1fa7bdca` stopped at 66% during VST painting; the
  [original receipt](evidence/2026-09-20/bake2-compile.json) records the failure.
  A valid convex color mixture produced `255.00000000000003`. The correction
  rejects nonfinite values before bounding finite roundoff; its regression and
  32,173,980 retained samples per lens pass. This does not qualify the renderer.
- **Bake 3:** `5d934218dcc59475e632d503bea59dfeb3bb156431d8d88d3616830808b23df9`
  completed both lenses in 271.59 seconds for local inspection. The
  [compile receipt](evidence/2026-09-20/bake3-compile.json) and
  [Lab browser report](evidence/2026-09-20/bake3-browser.json) identify that state.
  All 1,040 neutral PNGs and geometry match bake 2, as recorded by the
  [complete identity comparison](evidence/2026-09-20/bake3-identity.json).
  Its failed [handoff measurements](evidence/2026-09-20/legacy-handoffs.json)
  therefore remain applicable. Historical screenshot paths inside that report
  are local archival paths; the four current images are retained beside it.

| Interpolation | X/Z normalized L1 | Y/Z normalized L1 | Fixed limit |
| --- | ---: | ---: | ---: |
| Smooth, original bank | 0.105794 | 0.094072 | 0.04 |
| Nearest, original bank | 0.096259 | 0.082798 | 0.04 |
| Smooth, adaptive bank | 0.124987 | 0.114655 | 0.04 |

These checks ran on the working tree based on
`ef1e8b067f8f7d23d4bf13ea065f02f1dec7f4ad` plus the registration, photometric
compiler, compact replay, coordinate transport and adaptive-layer changes now
published in this branch. That base commit alone is not the tested version.
The [validation record](evidence/2026-09-20/validation.json) pins the tested sources
and records reused checks, local failures and omitted application qualification.

## Adaptive-layer experiment — unaccepted

New compiler bakes plan at most **500 total XYZ slabs** while integrating every
reference depth sample. This experiment reused bake 3's pinned field and both
materials without source acquisition or refitting. Its inspection identity is
`7a4f8781a7d19fafa57f11e65eae6ee24975082d3fcae0c1644cbdd68a5ac549`.
The [bake receipt](evidence/2026-09-20/layer-bake.json) records 461 planned slabs
(147/143/171), 459 retained slabs (146/142/171), and 230.94 seconds for the bake.
That is **41.1% fewer retained planes**, with approximately 5–7% fewer texture bytes.
It is not a corresponding bake-speed claim: depth sampling work is preserved.

The [browser comparison](evidence/2026-09-20/layer-handoffs.json) uses the same
renderer, camera and interpolation for original and optimized banks. Front-view
normalized L1 stays below 0.0065 and luminance changes by about 1.2%. Both optical
lenses and neutral still fail the unchanged 0.04 X/Z and Y/Z image-handoff limit.
The additional X/Y diagnostic is recorded too; its old neutral outlier is not used
as a stable comparison. The planner's displacement estimate is not rendered-quality
acceptance.

The [numerical alignment probe](evidence/2026-09-20/numerical-alignment.json)
fits translation, scale and rotation. It reduces L1 by only 2.6–5%; all twelve
old/new X/Z and Y/Z pairs remain failed. Native relative registration separately
passes at 0.097175 arcsec held-out RMS. These results do not support a simple global
2D misregistration as the explanation; they do not exclude sampling or compositing
defects. [Luminosity-weighted shape moments](evidence/2026-09-20/shape-moments.json)
in the retained envelope domain give approximate principal-axis ratios
1 : 0.98 : 0.83; this is not an observed isophotal shape measurement or side-view
rendering acceptance.

The independent [Crab replay comparison](evidence/2026-09-20/crab-comparison.json)
reduces 542 retained slabs to 391 and verifies all 2,737 texture pins and decoded
alpha/geometry. Twelve of fourteen handoffs pass before and after. The two Spitzer
failures persist and worsen, so this experiment does not promote Crab either.

Main-page delivery, cold compact replay, R2 publication/restoration, source-to-app
browser conformance and visual acceptance remain pending. The actual Lab publication
is still bake 3; the adaptive specimen is a separately identified inspection.

## Historical spherical King-Abel attempt — rejected

[king-abel-profile.json](king-abel-profile.json) and
[king-abel-derivation.mts](king-abel-derivation.mts) preserve the earlier reasoning;
they are **not the selected prior**. That experiment adopted a King (1962) projected
profile, substituted a 4.54 pc three-dimensional dynamical core radius for its
projected core radius, and approximated projected half-light radius as
0.75 × 10.42 = 7.815 pc from a three-dimensional half-mass radius. Solving those
constraints gave rt/rc ≈ 10.221 and rt ≈ 46.4 pc before numerical Abel inversion.
The 201-point table's recorded quadrature convergence established numerical
consistency of that assumed profile, not an observed photometric fit.

Its two radius substitutions and spherical symmetry were insufficiently sourced
for the desired reconstruction. Calling it a published-model consequence did not
make those substitutions measured. Later primary-source intake supplied the MGE
table and a Wilson alternative; [shape evidence](shape-evidence.md) retains the
comparison, radius-dependent flattening and inclination limits.

The original tooling note also described a genuine historical gap: the existing
simulation workflow required a particle-simulation baseline, while shell and
pulsar-wind recipes encoded unrelated physics. That gap motivated the generic
photometric-prior compiler now used above. No fabricated N-body baseline was added.
The current blocker is the measured renderer handoff failure, not that old tooling
gap, missing subject registration, or an absence of attempted bakes.
