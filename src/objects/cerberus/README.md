# (1865) Cerberus

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

Checked 2026-09-09. Original [DAMIT model 456](https://damit.cuni.cz/projects/damit/asteroid_models/view/456), version 2016-04-22.

Convex lightcurve model at the uncertain 1.2 km archive diameter.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Recorded four-body results retain their [original build identities](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/non-belt-populations/README.md#evidence-identity).

- Original mesh, scalar and sampled distance checks are in the [qualification record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/qualification.json). These are sampled distances, not an exhaustive Hausdorff bound or source-model accuracy.
- Production browser checks passed at DPR 1 and 2. Settings was hidden, so optional
  Shadows was exercised through a bound control event.
  [Browser record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/browser-validation.json) · [Source restoration](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/source-restoration.json) · [Fresh asset installation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/fresh-install.json).

## Known problems

- The published thermophysical fit is poor and its diameter uncertainty is unconstrained; the missing error value does not mean zero uncertainty.
- No registered reflectance texture is available. Grid marks missing imagery; Elevation is shape-derived radius relative to a sphere, not measured geology. Rotation phase is arbitrary.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Original shape, scale, orientation and preparation</summary>

## Shape and physical scale

The archived model gives D 1.2 km with no diameter uncertainty. Unknown uncertainty is retained as null; neither zero uncertainty nor a precise surface reconstruction is claimed.

The original shape is uniformly scaled to the selected archive diameter. Quoted diameter fit uncertainty does not describe local shape accuracy. No albedo, craters or regolith map is inferred.

Hanuš et al. 2015 section 4.2 explicitly report a poor thermophysical fit for Cerberus and omit its uncertainties. The DAMIT calibrated flag is retained as archive metadata, not treated as strong physical-size validation.

The unchanged original shape contains 1022 vertices and 2040 faces. Signed volume is 0.90477836020095082 source units³; an independent centroid/divergence sum gives 0.90477836020095082. Its source-volume equivalent diameter is 1.1999998567459849 source units. Uniform scale is 1.0000001193783601 km/source unit, preserving the selected archive's declared 1.2 km size. Neither a unit-volume assumption nor a borrowed ellipsoid is used.

## Orientation

Source pole: ecliptic J2000 (311°,-78°). Reference sidereal period: 6.80329 h. Equatorial conversion uses obliquity 23.439291111°. Original +Z axis and +X meridian are retained. Absolute rotational phase is arbitrary; reference-period display rotation is not a YORP propagation model. Heliocentric state is generated through the shared Horizons owner at 2026-09-03; its TDB-as-TT approximation is under 2 ms.

## Preparation

Existing source-meshoptimizer preparation retains source connectivity, reduces within an 800-native-u-face budget, and uses 128 px raster cells. The source-fit allowance is 12 m; source-model accuracy and simplification error remain separate. Shadows starts off.

</details>
