# (166) Rhodope: source and interpretation

Checked 2026-09-09. Selected DAMIT model **619**, version **2013-02-11**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2013); model 619, version 2013-02-11.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 53.26 km (catalog ±0.62 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Select Hanuš et al. (2013) convex model 619 (173,-3), with 620 (345,-22) retained. Both appear in the paper table; no unique pole is established. The selected source has no spatially resolved surface product or calibrated size.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.0000000343312261 source units³; an independent triangle-centroid divergence sum gives 1.0000000343312261. The existing recipe applies one uniform scale of 42.927345244209128 km per source unit so its volume-equivalent diameter is 53.26 km. No unit-volume assumption is made. Radius above a 26.63 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (173°, -3°), with sidereal period 4.7148 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/619) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/2444/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2013)](https://damit.cuni.cz/projects/damit/references/view/148) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 53.26 ± 0.62 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2013), combined dense and sparse photometry](https://arxiv.org/pdf/1301.6943) — retained primary publication; see the body-specific selection and calibration above.

Select Hanuš et al. (2013) convex model 619 (173,-3), with 620 (345,-22) retained. Both appear in the paper table; no unique pole is established. The selected source has no spatially resolved surface product or calibrated size.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 620, pole ['345', '-22'], https://damit.cuni.cz/projects/damit/asteroid_models/view/620

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 532.6 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
