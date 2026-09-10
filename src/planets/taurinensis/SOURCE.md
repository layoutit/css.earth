# (512) Taurinensis: source and interpretation

Checked 2026-09-09. Selected DAMIT model **490**, version **2013-02-11**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2013); model 490, version 2013-02-11.

## Shape, scale and orientation

Convex lightcurve reconstruction at approximate thermal scale: 20.87 km effective diameter (catalog ±0.36 km; additional model uncertainty). Grid marks unavailable imagery; pole ambiguity is retained in source notes.

AKARI fitted nonrotating-sphere effective diameter is transferred as a uniform volume-scale approximation to this independently obtained shape model. Quoted catalog error is statistical and omits additional shape, spin and thermal-model uncertainty. No total confidence interval or local terrain accuracy is inferred.

The unmodified source has 1016 vertices and 2028 triangles. Its signed tetrahedral volume is 0.99999983052341523 source units³; an independent triangle-centroid divergence sum gives 0.99999983052341523. The existing recipe applies one uniform scale of 16.821136990424865 km per source unit so its volume-equivalent diameter is 20.87 km. No unit-volume assumption is made. Radius above a 10.435 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (324°, 45°), with sidereal period 5.58203 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/490) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1914/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [AKARI AcuA catalog](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) and [Usui et al. (2011)](https://arxiv.org/abs/1106.1948) — retained original catalog and field definitions. Row number 512, 7 detections. The quoted error is the catalog thermal-model error, not total shape-scale uncertainty.
- [JPL SBDB](https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=512) — retained independent MCA population classification, checked 2026-09-09.
- [Hanuš et al. (2013)](https://damit.cuni.cz/projects/damit/references/view/148) — original model publication record.


JPL SBDB class MCA confirms this body is a Mars-crosser. The original convex lightcurve inversion is not resolved terrain. Only the checked listed source model is used.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: None listed for this target.

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 208.7 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
