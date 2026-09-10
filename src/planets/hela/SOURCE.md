# (699) Hela: source and interpretation

Checked 2026-09-09. Selected DAMIT model **454**, version **2012-07-30**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2012); model 454, version 2012-07-30.

## Shape, scale and orientation

Convex lightcurve reconstruction at approximate thermal scale: 13.39 km effective diameter (catalog ±0.45 km; additional model uncertainty). Grid marks unavailable imagery; pole ambiguity is retained in source notes.

AKARI fitted nonrotating-sphere effective diameter is transferred as a uniform volume-scale approximation to this independently obtained shape model. Quoted catalog error is statistical and omits additional shape, spin and thermal-model uncertainty. No total confidence interval or local terrain accuracy is inferred.

The unmodified source has 1586 vertices and 3168 triangles. Its signed tetrahedral volume is 1.0000000237186308 source units³; an independent triangle-centroid divergence sum gives 1.0000000237186308. The existing recipe applies one uniform scale of 10.792286046814182 km per source unit so its volume-equivalent diameter is 13.39 km. No unit-volume assumption is made. Radius above a 6.695 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (45°, 44°), with sidereal period 3.39623 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/454) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1775/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [AKARI AcuA catalog](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) and [Usui et al. (2011)](https://arxiv.org/abs/1106.1948) — retained original catalog and field definitions. Row number 699, 4 detections. The quoted error is the catalog thermal-model error, not total shape-scale uncertainty.
- [JPL SBDB](https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=699) — retained independent MCA population classification, checked 2026-09-09.
- [Marciniak et al. (2012)](https://damit.cuni.cz/projects/damit/references/view/143) — original model publication record.


JPL SBDB class MCA confirms this body is a Mars-crosser. The original convex lightcurve inversion is not resolved terrain. The selected pole is one of two published solutions; no preference is inferred from its lower archive ID. The competing pole remains unresolved.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 455, pole ['197', '31'], https://damit.cuni.cz/projects/damit/asteroid_models/view/455

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 133.9 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
