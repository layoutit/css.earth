# (174) Phaedra: source and interpretation

Checked 2026-09-09. Selected DAMIT model **304**, version **2011-02-18**. DAMIT, Astronomical Institute of Charles University; Marciniak (2011); model 304, version 2011-02-18.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 64.08 km (catalog ±0.77 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. The selected Marciniak (2011) archive model 304 has one pole (266,5) and no calibrated size. Retain it as a convex light-curve model, with explicitly approximate thermal scale and no claim of measured craters or unique absolute rotational phase.

The unmodified source has 998 vertices and 1992 triangles. Its signed tetrahedral volume is 0.99999996950715653 source units³; an independent triangle-centroid divergence sum gives 0.99999996950715653. The existing recipe applies one uniform scale of 51.648222731654748 km per source unit so its volume-equivalent diameter is 64.08 km. No unit-volume assumption is made. Radius above a 32.04 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (266°, 5°), with sidereal period 5.75025 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/304) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1091/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak (2011)](https://damit.cuni.cz/projects/damit/references/view/140) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 64.08 ± 0.77 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.


The selected Marciniak (2011) archive model 304 has one pole (266,5) and no calibrated size. Retain it as a convex light-curve model, with explicitly approximate thermal scale and no claim of measured craters or unique absolute rotational phase.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: None listed for this target.

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 640.8 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
