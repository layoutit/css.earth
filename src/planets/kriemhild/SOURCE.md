# (242) Kriemhild: source and interpretation

Checked 2026-09-09. Selected DAMIT model **621**, version **2013-02-11**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2013); model 621, version 2013-02-11.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 45.14 km effective diameter (catalog ±0.51 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. Both pole solutions remain possible. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Published convex inversion from Hanuš et al. (2013). The selected archive solution is retained as a reproducible coarse model. An alternative pole remains possible; no unique orientation is claimed. The release supplies no registered global surface imagery or measured local terrain. AKARI thermal effective diameter provides only an explicit volume-scale approximation.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.0000000210565527 source units³; an independent triangle-centroid divergence sum gives 1.0000000210565527. The existing recipe applies one uniform scale of 36.382658146787271 km per source unit so its volume-equivalent diameter is 45.14 km. No unit-volume assumption is made. Radius above a 22.57 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (284°, -15°), with sidereal period 4.54518 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/621) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/2452/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2013)](https://damit.cuni.cz/projects/damit/references/view/148) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 45.14 ± 0.51 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2013), A&A 551, A67](https://arxiv.org/pdf/1301.6943) — retained primary publication; see the body-specific selection and calibration above.

Published convex inversion from Hanuš et al. (2013). The selected archive solution is retained as a reproducible coarse model. An alternative pole remains possible; no unique orientation is claimed. The release supplies no registered global surface imagery or measured local terrain. AKARI thermal effective diameter provides only an explicit volume-scale approximation.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 622, pole ['100', '-40'], https://damit.cuni.cz/projects/damit/asteroid_models/view/622

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 451.4 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
