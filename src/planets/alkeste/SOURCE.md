# (124) Alkeste: source and interpretation

Checked 2026-09-09. Selected DAMIT model **4511**, version **2019-10-23**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2020); model 4511, version 2019-10-23.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 81.39 km effective diameter (catalog ±0.93 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Ďurech2020 TableA.2 reports203 cyan plus122 orange ATLAS observations and two poles. The table marks period recovery E (ellipsoid search); that is not evidence of high shape accuracy. The archived convex mesh is retained only as a coarse inverse model.

The unmodified source has 562 vertices and 1120 triangles. Its signed tetrahedral volume is 0.99999971892307915 source units³; an independent triangle-centroid divergence sum gives 0.99999971892307915. The existing recipe applies one uniform scale of 65.600018714917894 km per source unit so its volume-equivalent diameter is 81.39 km. No unit-volume assumption is made. Radius above a 40.695 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (136°, 16°), with sidereal period 9.907 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/4511) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/52179/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2020)](https://damit.cuni.cz/projects/damit/references/view/658) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 81.39 ± 0.93 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2020), A&A 643, A59](https://arxiv.org/pdf/2010.01820) — retained primary publication; see the body-specific selection and calibration above.

Ďurech2020 TableA.2 reports203 cyan plus122 orange ATLAS observations and two poles. The table marks period recovery E (ellipsoid search); that is not evidence of high shape accuracy. The archived convex mesh is retained only as a coarse inverse model.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 4512, pole ['313', '11'], https://damit.cuni.cz/projects/damit/asteroid_models/view/4512

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 813.9 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
