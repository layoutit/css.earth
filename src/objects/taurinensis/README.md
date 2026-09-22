# (512) Taurinensis

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

Checked 2026-09-09. Selected DAMIT model [490](https://damit.cuni.cz/projects/damit/asteroid_models/view/490), version **2013-02-11**.

Convex lightcurve shape, uniformly scaled to the AKARI effective diameter of 20.87 ±0.36 km.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Recorded five-body results retain their [original build identities](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/non-belt-populations/README.md#evidence-identity).

- Source, scalar and sampled surface-fit checks passed. [Validation report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/mars-crossing-population/VALIDATION.md) · [Source fit](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/mars-crossing-population/evidence/taurinensis-surface-fit.json) · [Source/result view](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/mars-crossing-population/evidence/taurinensis-source-result.png).
- Production browser checks passed at DPR 1 and 2. The optional Shadows test used
  a bound control event because Settings was hidden; it did not test opening Settings.
  [Browser record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/mars-crossing-population/browser-validation.json).

## Known problems

- The scale transfer is approximate. Catalog error omits additional shape, spin and thermal-model uncertainty; sampled simplification error does not establish terrain accuracy.
- No registered surface imagery is available. Grid marks the gap; Elevation is shape-derived radius relative to a sphere, not gravitational height. Rotation phase is arbitrary.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Original shape, scale, orientation and preparation</summary>

## Shape, scale and orientation

AKARI fitted nonrotating-sphere effective diameter is transferred as a uniform volume-scale approximation to this independently obtained shape model. Quoted catalog error is statistical and omits additional shape, spin and thermal-model uncertainty. No total confidence interval or local terrain accuracy is inferred.

The unmodified source has 1016 vertices and 2028 triangles. Its signed tetrahedral volume is 0.99999983052341523 source units³; an independent triangle-centroid divergence sum gives 0.99999983052341523. The existing recipe applies one uniform scale of 16.821136990424865 km per source unit so its volume-equivalent diameter is 20.87 km. No unit-volume assumption is made. Radius above a 10.435 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (324°, 45°), with sidereal period 5.58203 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 208.7 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
