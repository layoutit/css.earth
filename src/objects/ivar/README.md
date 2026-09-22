# (1627) Ivar

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

Checked 2026-09-09. Original [DAMIT model 271](https://damit.cuni.cz/projects/damit/asteroid_models/view/271), version 2016-04-22.

Convex lightcurve model at the archive fixed-shape diameter of 7.4 ±0.2 km.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Recorded four-body results retain their [original build identities](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/non-belt-populations/README.md#evidence-identity).

- Original mesh, scalar and sampled distance checks are in the [qualification record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/qualification.json). These are sampled distances, not an exhaustive Hausdorff bound or source-model accuracy.
- Production browser checks passed at DPR 1 and 2. Settings was hidden, so optional
  Shadows was exercised through a bound control event.
  [Browser record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/browser-validation.json) · [Source restoration](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/source-restoration.json) · [Fresh asset installation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/near-earth-population/fresh-install.json).

## Known problems

- The separate varied-shape fit gives 8.0 km (−0.9/+0.3 km); the adopted fixed-shape error is not total physical uncertainty. The older nonconvex model 272 is only a plausible alternative.
- No registered reflectance texture is available. Grid marks missing imagery; Elevation is shape-derived radius relative to a sphere, not measured geology. Rotation phase is arbitrary.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Original shape, scale, orientation and preparation</summary>

## Shape and physical scale

The calibrated 2016 convex solution is selected; the older nonconvex model 272 is explicitly labelled plausible in the archive and is not a resolved terrain measurement.

The original shape is uniformly scaled to the selected archive diameter. Quoted diameter fit uncertainty does not describe local shape accuracy. No albedo, craters or regolith map is inferred.

Hanuš et al. 2015 Table 4 distinguishes this fixed revised shape fit from the varied-shape ensemble, which gives a wider size range (8.0 km, -0.9/+0.3 km). The archive 7.4 km scale is used consistently with its mesh; the narrow archived error is not total physical uncertainty.

The unchanged original shape contains 1020 vertices and 2036 faces. Signed volume is 212.1747578652795 source units³; an independent centroid/divergence sum gives 212.1747578652795. Its source-volume equivalent diameter is 7.3999996235878962 source units. Uniform scale is 1.0000000508665032 km/source unit, preserving the selected archive's declared 7.4 km size. Neither a unit-volume assumption nor a borrowed ellipsoid is used.

## Orientation

Source pole: ecliptic J2000 (334°,39°). Reference sidereal period: 4.79517 h. Equatorial conversion uses obliquity 23.439291111°. Original +Z axis and +X meridian are retained. Absolute rotational phase is arbitrary; reference-period display rotation is not a YORP propagation model. Heliocentric state is generated through the shared Horizons owner at 2026-09-03; its TDB-as-TT approximation is under 2 ms.

## Preparation

Existing source-meshoptimizer preparation retains source connectivity, reduces within an 800-native-u-face budget, and uses 128 px raster cells. The source-fit allowance is 74 m; source-model accuracy and simplification error remain separate. Shadows starts off.

</details>
