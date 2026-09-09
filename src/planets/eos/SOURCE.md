# (221) Eos: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1743**, version **2017-03-31**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2018); model 1743, version 2017-03-31.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 107.74 km effective diameter (catalog ±1.51 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. The grid marks unavailable imagery; rotational phase is illustrative.

Hanuš2018 Eos-family study TableB.1 reports27 dense lightcurves across six apparitions and304 sparse measurements, model quality3. Both poles remain; model1743 is selected without rejecting1744. That paper’s91.2±2.2 km column is WISE radiometry rather than a shape calibration; it is retained as a competing thermal estimate against AKARI107.74±1.51 km. The disagreement is an additional systematic limit, not grounds for averaging the catalogs. The thermal scale is approximate. Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.00000002482977 source units³; an independent triangle-centroid divergence sum gives 1.0000000248297698. The existing recipe applies one uniform scale of 86.838005844144647 km per source unit so its volume-equivalent diameter is 107.74 km. No unit-volume assumption is made. Radius above a 53.87 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (289°, -23°), with sidereal period 10.4421 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1743) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/5968/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2018)](https://damit.cuni.cz/projects/damit/references/view/167) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 107.74 ± 1.51 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2018), Icarus 299, 84–96](https://arxiv.org/pdf/1707.05507) — retained primary publication; see the body-specific selection and calibration above.
- [Usui et al. (2011), PASJ 63, 1117–1138](https://arxiv.org/pdf/1106.1948) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2018 Eos-family study TableB.1 reports27 dense lightcurves across six apparitions and304 sparse measurements, model quality3. Both poles remain; model1743 is selected without rejecting1744. That paper’s91.2±2.2 km column is WISE radiometry rather than a shape calibration; it is retained as a competing thermal estimate against AKARI107.74±1.51 km. The disagreement is an additional systematic limit, not grounds for averaging the catalogs.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 1744, pole ['119', '-37'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1744

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1077.4 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
