# (2102) Tantalus

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

Checked 2026-09-09. Original [DAMIT model 6205](https://damit.cuni.cz/projects/damit/asteroid_models/view/6205), version 2022-07-13.

Prograde radar/optical reconstruction at a radar-calibrated diameter of 1.45 ±0.2 km.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Recorded four-body results retain their [original build identities](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/non-belt-populations/README.md#evidence-identity).

- Original mesh, scalar and sampled distance checks are in the [qualification record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/qualification.json). These are sampled distances, not an exhaustive Hausdorff bound or source-model accuracy.
- Production browser checks passed at DPR 1 and 2. Settings was hidden, so optional
  Shadows was exercised through a bound control event.
  [Browser record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/browser-validation.json) · [Source restoration](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/source-restoration.json) · [Fresh asset installation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/fresh-install.json).

## Known problems

- The alternative retrograde pole remains unresolved.
- Sampled geometry distance reaches 16.79 m; the 14.5 m transfer cutoff withholds 0.0321% of interior Elevation texels.
- No registered reflectance texture is available. Grid marks missing imagery; Elevation is shape-derived radius relative to a sphere, not measured geology. Rotation phase is arbitrary.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Original shape, scale, orientation and preparation</summary>

## Shape and physical scale

The prograde radar/optical model 6205 is selected because Rożek et al. 2022 find it more consistent with WISE size determination than retrograde 6204. The alternative pole remains unresolved. The convex-only model 6203 is not substituted.

The original shape is uniformly scaled to the selected archive diameter. Quoted diameter fit uncertainty does not describe local shape accuracy. No albedo, craters or regolith map is inferred.

The unchanged original shape contains 1000 vertices and 1996 faces. Signed volume is 1.5962562691861362 source units³; an independent centroid/divergence sum gives 1.5962562691861362. Its source-volume equivalent diameter is 1.4499999854441232 source units. Uniform scale is 1.0000000100385358 km/source unit, preserving the selected archive's declared 1.45 km size. Neither a unit-volume assumption nor a borrowed ellipsoid is used.

## Orientation

Source pole: ecliptic J2000 (36°,30°). Reference sidereal period: 2.39006 h. Equatorial conversion uses obliquity 23.439291111°. Original +Z axis and +X meridian are retained. Absolute rotational phase is arbitrary; reference-period display rotation is not a YORP propagation model. Heliocentric state is generated through the shared Horizons owner at 2026-09-03; its TDB-as-TT approximation is under 2 ms.

## Preparation

Existing source-meshoptimizer preparation retains source connectivity, reduces within an 800-native-u-face budget, and uses 128 px raster cells. The source-fit allowance is 14.5 m; source-model accuracy and simplification error remain separate. Shadows starts off.

The recorded transfer withheld 1,842 of 5,738,316 interior Elevation texels (0.0321%). The 14.5 m meshoptimizer estimate budget and 14.5 m source-transfer cutoff are distinct from the 16.79 m maximum sampled geometry distance. No cutoff was relaxed or missing value extrapolated.

</details>
