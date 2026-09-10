# Tethys detector rasterizer: independent mixed-mode review

Use **1e−6 rad inset on each aperture axis** for the reviewed nine-observation Tethys cohort. This tested guard removed the identified between-pose edge cases. It reduces the nominal narrow-aperture width by 0.8%; it is not a pointing guarantee, calibrated PSF width or proof of continuous exposure support. Iapetus retains its separately qualified 1e−7 rad guard.

Evidence: [independent script](qualify-rasterizer.py), [Tethys machine receipt](tethys-rasterizer-dense-qualification.json), and the [Iapetus comparison](rasterizer-review.md). The receipt pins the actual trial TIFFs, recipe, original input files through the recipe, and production/script versions reviewed.

## Independent source camera

The audit reads the source navigation planes and cached clock, position and rotation tables with the standard library. It independently implements the original ISIS NORMAL and HI-RES IR camera equations, including the HI-RES 62.5 sample boresight and integer swath-offset division. It inverts these camera directions into angular aperture coordinates rather than using production corner-ray containment as the oracle.

The source frame is **10041**, with the released **540.4 × 531.1 × 527.5 km** ellipsoid and east-positive, planetocentric coordinates. Selected independently reconstructed centers agree with the released N coordinates to at most **0.000014216°**. This is a source-coordinate consistency check, not an external spacecraft-pointing or ISS-registration error estimate.

| Source cube | Mode | Supported source pixels reviewed |
| --- | --- | ---: |
| 1807469104_1 | HI-RES | 7 |
| 1807456038_1 | NORMAL | 16 |
| 1807473499_1 | HI-RES | 16 |
| 1818547570_1 | HI-RES | 16 |
| 1561668191_1 | HI-RES | 16 |
| 1660463972_1 | HI-RES | 16 |
| 1719613772_1 | HI-RES | 16 |
| 1719616836_1 | HI-RES | 16 |
| 1606213356_1 | HI-RES | 16 |

One additional selected center was correctly refused by the production camera. Every supported selected pixel was tested at **129 exposure poses**, using actual map-owner locations, angular-boundary probes and an interior witness. HI-RES uses a single narrow aperture over the full exposure; NORMAL keeps both possible orders of its two half-exposures explicit.

## Temporal guard

At zero inset, nine deliberately chosen boundary candidates passed production containment but failed the dense independent angular check. None of **3,678 sampled actual output candidates** failed it. All nine failures arise between the production temporal samples; they occur in NORMAL cube 1807456038_1 and HI-RES cubes 1660463972_1, 1719613772_1 and 1606213356_1. The largest negative dense margin was **−1.2831873e−7 rad**.

An inset of 1e−7 rad still admitted six failing HI-RES boundary probes. Their distance from a coarse boundary can exceed their negative dense margin, so the largest deficit alone is not an adequate guard-selection rule. The already tested **1e−6 rad** inset removed all observed failures while retaining **3,644 of 3,678** sampled original output candidates. The 34 removed candidates become conservative missing coverage or may receive a different independently valid source owner when the map is regenerated.

This is a bounded empirical review. The inset was tested against the stated dense poses and candidate population; it does not establish a continuous-motion maximum, improve absolute pointing, or qualify a physical optical response beyond the nominal aperture policy. Final regenerated outputs still need their own package checks and visual review.

## Lookup completeness

For 36 selected apertures, the audit bypassed the bounding accelerator and queried every center of the actual **1024 × 512** output grid: **18,874,368 queries**, **3,489 supported centers**, and **zero supported centers dropped by the accelerator**. A separate fixed-seed global/local random test performed **136,101 queries** across all 135 supported selected apertures, including **629 supported points**, again with zero dropped.

The Iapetus scan-gap test does not apply to Tethys and is marked inapplicable in its receipt. Tethys support remains detector-based; no adjacent-center quadrilateral is used. These bounding results cover the listed selected apertures and current grid, not all possible observation geometries.

## Resource and absolute-registration boundaries

The run completed in **6.60 seconds**, peak resident memory **259,211,264 bytes (247.2 MiB)**, with numerical thread counts set to one. It changed no product code, original inputs or mapped TIFFs.

Both moons' reconstructed native centers agree with their original N coordinates; that agreement cannot establish alignment to independently controlled ISS imagery. The [JPL Iapetus mosaic description](https://www.jpl.nasa.gov/images/pia18436-color-maps-of-iapetus-2014/) explicitly identifies separate geographic registration and photometric processing, but supplies no VIMS-to-ISS tie points or registration uncertainty. The Tethys source intake's published observation framing remains separate evidence. Neither published camera metadata nor a matching array shape should be represented as a measured absolute alignment bound.

A separate [Iapetus framing check](iss-framing.md) now samples the pinned ISS base at the original VIMS continuum locations and supports the released convention over the tested sign/180°/latitude alternatives. That result is specific to Iapetus and is not a Tethys measurement. Any tighter local translation or error estimate requires actual shared features and must account for different wavelengths, illumination, source filtering and terrain relief. No alignment fit, source rotation or geometry change was performed by this review.
