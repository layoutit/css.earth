# (150) Nuwa: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1185**, version **2016-01-04**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2016); model 1185, version 2016-01-04.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 139.65 km (catalog ±2.09 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Select nominal 2016 convex model 1185 (359,25), with 1186 (177,22) retained as an unresolved mirror pole. Hanuš et al. (2016), table of new models, gives 33 dense light curves across five apparitions and sparse data. No calibrated size is in the selected release; AKARI remains an explicit separate thermal-volume approximation.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 0.99999991754790063 source units³; an independent triangle-centroid divergence sum gives 0.99999991754790063. The existing recipe applies one uniform scale of 112.55734128272978 km per source unit so its volume-equivalent diameter is 139.65 km. No unit-volume assumption is made. Radius above a 69.825 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (359°, 25°), with sidereal period 8.13456 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1185) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/4296/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2016)](https://damit.cuni.cz/projects/damit/references/view/161) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 139.65 ± 2.09 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2016), new and updated convex models](https://arxiv.org/pdf/1510.07422) — retained primary publication; see the body-specific selection and calibration above.

Select nominal 2016 convex model 1185 (359,25), with 1186 (177,22) retained as an unresolved mirror pole. Hanuš et al. (2016), table of new models, gives 33 dense light curves across five apparitions and sparse data. No calibrated size is in the selected release; AKARI remains an explicit separate thermal-volume approximation.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 1186, pole ['177', '22'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1186

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1396.5 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
