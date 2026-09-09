# (134) Sophrosyne: source and interpretation

Checked 2026-09-09. Selected DAMIT model **5976**, version **2022-02-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2021); model 5976, version 2022-02-14.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 100.42 km effective diameter (catalog ±1.33 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Hanuš2021 TableA.2 reports293 ASAS-SN observations and both poles(100,35)/(276,7). The paper catalog diameter112.2 km is not a calibrated volume for this shape; AKARI100.42 km is consistently retained as an explicit alternative thermal-scale approximation.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.0000000688872217 source units³; an independent triangle-centroid divergence sum gives 1.0000000688872219. The existing recipe applies one uniform scale of 80.938114152633048 km per source unit so its volume-equivalent diameter is 100.42 km. No unit-volume assumption is made. Radius above a 50.21 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (100°, 35°), with sidereal period 17.1893 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/5976) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/65258/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2021)](https://damit.cuni.cz/projects/damit/references/view/662) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 100.42 ± 1.33 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2021), A&A 654, A48](https://arxiv.org/pdf/2107.10027) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2021 TableA.2 reports293 ASAS-SN observations and both poles(100,35)/(276,7). The paper catalog diameter112.2 km is not a calibrated volume for this shape; AKARI100.42 km is consistently retained as an explicit alternative thermal-scale approximation.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 5977, pole ['276', '7'], https://damit.cuni.cz/projects/damit/asteroid_models/view/5977

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1004.2 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
