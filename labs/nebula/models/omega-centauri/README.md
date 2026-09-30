# Omega Centauri (NGC 5139)

**Blocked at visual qualification; not delivered.** Omega Centauri is registered in the Lab and uses a published oblate MGE light profile. Its neutral geometry fails the axis-handoff image gate, with and without adaptive layers. It is a research subject: no application package, runtime bank or R2 publication is shipped.

## Current method

[photometric-mge.json](photometric-mge.json) transcribes the eight projected Gaussians in D’Souza & Rix (2013), Table 1, with [physical evidence](physical-evidence.json). The selected model uses PA 100° east of north, inclination 50°, and distance 5426 ± 47 pc. Its near/far tilt sign and six-sigma numerical cutoff are authored, not measured. [The method note](mge-method.md) gives units, deprojection and competing constraints; [shape evidence](shape-evidence.md) compares the MGE table with a Wilson alternative.

The generic photometric compiler separates a smooth MGE envelope from finite positive image residuals, with an authored envelope fraction of 0.95, an 8-fit-pixel smoothing scale and at most 4096 residual features. Each residual gets one conditional depth, and each optical dataset supplies colors on common geometry. The selected fit retained 4085 features, with total RMSE 0.03825, 5.90% missing light and 17.79% excess light. These display-fit metrics are not visual acceptance or calibrated photometry.

The field represents **integrated starlight**, not resolved member stars. The 512-pixel fit grid and minimum projected sigma of 0.9 fit pixels (5.80 arcsec) cannot recover native stellar widths or all crowded core texture. This is neither measured stellar depth nor a dynamical mass model.

## Source images

| Dataset | Native publisher image |
| --- | --- |
| [VST/OmegaCAM, eso1119b](https://www.eso.org/public/images/eso1119b/) | Optical G/R/I, 14540 × 14540 pixels, 50.88′ square; light/geometry reference. |
| [WFI, eso0844a](https://www.eso.org/public/images/eso0844a/) | Optical B/V/I, 8040 × 7560 pixels, 31.88′ × 29.99′; second material dataset. Some publisher mosaic gaps contain DSS data. |

Native TIFFs and their complete AVM metadata are pinned. ESO credits and reuse terms are in the [observation recipe](observations.json): VST credit is ESO/INAF-VST/OmegaCAM, with acknowledgement to A. Grado and L. Limatola/INAF-Capodimonte Observatory; WFI credit is ESO. Both follow the [ESO image-use terms](https://www.eso.org/public/outreach/copyright/).

## Native registration

The [native registration receipt](native-registration.json) passes the field-star gate with **1,899 automatic VST/WFI correspondences, 633 held-out stars and 0.0972 arcsec held-out RMS**, covering all four quadrants. This validates relative registration, not absolute sky coordinates, membership, depth or photometry. Registration uses the complete embedded WCS records, whose reference pixels are not at the raster centre. `verify-registration.mts` checks the metadata against the recipe and replays the fit from the native source cache.

## Current blocker

The inspection uses 459 retained slabs, one neutral bank and two optical datasets, shown by the retained-DOM compiler renderer in a wrapper that is not the main application. Every axis handoff fails the fixed limit:

| Interpolation | X/Z normalized L1 | Y/Z normalized L1 | Fixed limit |
| --- | ---: | ---: | ---: |
| Smooth, original bank | 0.105794 | 0.094072 | 0.04 |
| Nearest, original bank | 0.096259 | 0.082798 | 0.04 |
| Smooth, adaptive bank | 0.124987 | 0.114655 | 0.04 |

The adaptive-layer planner caps a bake at **500 total XYZ slabs** while integrating every reference depth sample. It cut retained slabs from 779 to 459, 41.1% fewer planes, with front-view normalized L1 below 0.0065. A fitted translation, scale and rotation reduces L1 by only 2.6–5%, so a simple global 2D misregistration does not explain the failure; sampling or compositing defects are not excluded.

Main-page delivery, R2 publication and restoration, browser conformance and visual acceptance remain pending.

## Rejected spherical King-Abel prior

[king-abel-profile.json](king-abel-profile.json) and [king-abel-derivation.mts](king-abel-derivation.mts) preserve an earlier King (1962) profile. They are **not the selected prior**: its two radius substitutions and spherical symmetry were insufficiently sourced.
