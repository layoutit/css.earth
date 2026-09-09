# (161) Athor: source and interpretation

Checked 2026-09-09. Selected DAMIT model **461**, version **2012-09-25**. DAMIT, Astronomical Institute of Charles University; Franco et al. (2012); model 461, version 2012-09-25.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 40.84 km (catalog ±0.52 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Select Franco et al. (2012) model 461 (350,-6), retaining 462 (170,4). The archive and linked Minor Planet Bulletin reference support a convex light-curve shape and two poles, with no physical-size calibration. No preference is inferred from model ordering.

The unmodified source has 1008 vertices and 2012 triangles. Its signed tetrahedral volume is 1.000000064037925 source units³; an independent triangle-centroid divergence sum gives 1.000000064037925. The existing recipe applies one uniform scale of 32.916874998373537 km per source unit so its volume-equivalent diameter is 40.84 km. No unit-volume assumption is made. Radius above a 20.42 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (350°, -6°), with sidereal period 7.28009 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/461) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1801/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Franco et al. (2012)](https://damit.cuni.cz/projects/damit/references/view/146) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 40.84 ± 0.52 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.


Select Franco et al. (2012) model 461 (350,-6), retaining 462 (170,4). The archive and linked Minor Planet Bulletin reference support a convex light-curve shape and two poles, with no physical-size calibration. No preference is inferred from model ordering.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 462, pole ['170', '4'], https://damit.cuni.cz/projects/damit/asteroid_models/view/462

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 408.4 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
