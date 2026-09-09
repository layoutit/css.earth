# (120) Lachesis: source and interpretation

Checked 2026-09-09. Selected DAMIT model **943**, version **2016-01-04**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2016); model 943, version 2016-01-04.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 156.53 km effective diameter (catalog ±1.67 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Hanuš2016 reports35 dense curves across four apparitions and467 sparse measurements. Hanuš2021 sparse-data result has period46.541 h versus archive46.55076 h, so the later survey is a comparison, not silently substituted geometry. The scene rotation is illustrative; no precision phase claim is made.

The unmodified source has 1004 vertices and 2004 triangles. Its signed tetrahedral volume is 1.0000001272933809 source units³; an independent triangle-centroid divergence sum gives 1.0000001272933809. The existing recipe applies one uniform scale of 126.16254492788028 km per source unit so its volume-equivalent diameter is 156.53 km. No unit-volume assumption is made. Radius above a 78.265 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (256°, 39°), with sidereal period 46.5508 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/943) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/3549/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2016)](https://damit.cuni.cz/projects/damit/references/view/161) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 156.53 ± 1.67 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2016), A&A 586, A108](https://arxiv.org/pdf/1510.07422) — retained primary publication; see the body-specific selection and calibration above.
- [Hanuš et al. (2021), A&A 654, A48](https://arxiv.org/pdf/2107.10027) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2016 reports35 dense curves across four apparitions and467 sparse measurements. Hanuš2021 sparse-data result has period46.541 h versus archive46.55076 h, so the later survey is a comparison, not silently substituted geometry. The scene rotation is illustrative; no precision phase claim is made.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 944, pole ['82', '55'], https://damit.cuni.cz/projects/damit/asteroid_models/view/944

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1565.3 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
