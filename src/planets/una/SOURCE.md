# (160) Una: source and interpretation

Checked 2026-09-09. Selected DAMIT model **169**, version **2009-05-29**. DAMIT, Astronomical Institute of Charles University; A. Marciniak et al. (2009); model 169, version 2009-05-29.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 77.72 km (catalog ±1.23 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Select Marciniak et al. (2009) convex model 169 (125,-33); alternate 170 (308,-41) remains. The publication concerns light-curve-derived spin/shape. The selected record has no calibrated size and supplies no registered imagery; retain explicitly approximate AKARI scaling.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 0.9999999169473277 source units³; an independent triangle-centroid divergence sum gives 0.9999999169473277. The existing recipe applies one uniform scale of 62.642009067275481 km per source unit so its volume-equivalent diameter is 77.72 km. No unit-volume assumption is made. Radius above a 38.86 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (125°, -33°), with sidereal period 11.0332 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/169) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/453/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [A. Marciniak et al. (2009)](https://damit.cuni.cz/projects/damit/references/view/129) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 77.72 ± 1.23 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.


Select Marciniak et al. (2009) convex model 169 (125,-33); alternate 170 (308,-41) remains. The publication concerns light-curve-derived spin/shape. The selected record has no calibrated size and supplies no registered imagery; retain explicitly approximate AKARI scaling.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 170, pole ['308', '-41'], https://damit.cuni.cz/projects/damit/asteroid_models/view/170

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 777.2 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
