# (119) Althaea: source and interpretation

Checked 2026-09-09. Selected DAMIT model **323**, version **2011-04-21**. DAMIT, Astronomical Institute of Charles University; Hanuš (2011); model 323, version 2011-04-21.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 58.79 km effective diameter (catalog ±0.62 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Hanuš2011 TableA.1 gives both poles(339,-67)/(181,-61), four dense curves over two apparitions and sparse data from three surveys. The selected solution retains the original source axes; the alternative remains possible.

The unmodified source has 1018 vertices and 2032 triangles. Its signed tetrahedral volume is 0.99999992506276014 source units³; an independent triangle-centroid divergence sum gives 0.99999992506276014. The existing recipe applies one uniform scale of 47.384504671935488 km per source unit so its volume-equivalent diameter is 58.79 km. No unit-volume assumption is made. Radius above a 29.395 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (339°, -67°), with sidereal period 11.4651 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/323) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1186/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš (2011)](https://damit.cuni.cz/projects/damit/references/view/141) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 58.79 ± 0.62 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2011), A&A 530, A134](https://arxiv.org/pdf/1104.4114) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2011 TableA.1 gives both poles(339,-67)/(181,-61), four dense curves over two apparitions and sparse data from three surveys. The selected solution retains the original source axes; the alternative remains possible.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 324, pole ['181', '-61'], https://damit.cuni.cz/projects/damit/asteroid_models/view/324

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 587.9 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
