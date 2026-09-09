# (105) Artemis: source and interpretation

Checked 2026-09-09. Selected DAMIT model **5939**, version **2022-02-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2021); model 5939, version 2022-02-14.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 123.53 km effective diameter (catalog ±1.5 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Hanuš2021 TableA.2 reports 405 ASAS-SN V-band detections and this single archived pole. It is a coarse photometric inversion, not resolved imagery.

The unmodified source has 1021 vertices and 2038 triangles. Its signed tetrahedral volume is 0.99999994728067509 source units³; an independent triangle-centroid divergence sum gives 0.99999994728067498. The existing recipe applies one uniform scale of 99.564684789488268 km per source unit so its volume-equivalent diameter is 123.53 km. No unit-volume assumption is made. Radius above a 61.765 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (47°, 24°), with sidereal period 37.118 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/5939) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/65053/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2021)](https://damit.cuni.cz/projects/damit/references/view/662) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 123.53 ± 1.5 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2021), A&A 654, A48](https://arxiv.org/pdf/2107.10027) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2021 TableA.2 reports 405 ASAS-SN V-band detections and this single archived pole. It is a coarse photometric inversion, not resolved imagery.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: None listed for this target.

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1235.3 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
