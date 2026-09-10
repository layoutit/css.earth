# Selam

Selam is the first contact-binary moon discovered around an asteroid. Lucy revealed its two touching lobes while passing Dinkinesh in November 2023.

## Representation

Two touching ellipsoids reproduce the lobe dimensions inferred from Lucy images: 240 × 200 × 200 m and 280 × 220 × 210 m, each uncertain by about 10%. This is a smooth shape envelope; the neck, craters and surface imagery are unresolved in this representation.

Approximate orbital placement. The 3.11 km separation and 52.67-hour period are measured; circular equatorial motion and synchronous orientation are approximations. The present orbital phase is illustrative.

The shared missing-imagery grid covers the surface. The body uses the existing generic object adapter, one shared world camera and retained PolyCSS geometry. The selector detail is **Lucy**.

## Scientific sources

- [Levison et al. (2024)](https://doi.org/10.1038/s41586-024-07378-0): Lobe dimensions, separation and mutual period.
- [Bierhaus et al. (2025)](https://doi.org/10.3847/PSJ/ae1968): Later geology and limits of the Selam shape evidence.

[Measurements and source selection](source/measurements.json) · [Exact source pins](source/manifest.json) · [Reuse terms](NOTICE.md).

The two lobes touch at one point. Equal density defines the model origin; this is not a measured center of mass or a recovered neck mesh. Neither the contributed Celestia texture nor the earlier uncontrolled camera fit is used.

## Orbital placement

[Source parameters](source/orbit/published-parameters.json) separate published constraints from assumptions. The illustration places zero mean anomaly at JD 2461286.5 TT (3 September 2026), rather than extrapolating an uncertain encounter phase. A dashed orbit and circular selected marker distinguish this approximation. No uncertainty region, confidence interval or exact current phase is claimed. The fixed-epoch loader rejects other epochs.

## Preparation

[Reproduction instructions](../../../tools/objects/source-authoring/galileo-lucy/README.md). The canonical prepared mesh contains 1024 triangles, independent of device DPR. Sources, conversion and reduction happen before runtime.
