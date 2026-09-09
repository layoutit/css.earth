# (172) Baucis: source and interpretation

Checked 2026-09-09. Selected DAMIT model **4695**, version **2019-10-23**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2020); model 4695, version 2019-10-23.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 66.89 km (catalog ±0.82 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Select one complete 2020 ATLAS convex solution, 4695 (203,-52), keeping 4696 (6,-34). Both poles appear in the publication table; no rejected alternative is listed. The selected model is photometric, not a resolved image reconstruction.

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 1.0000004253036394 source units³; an independent triangle-centroid divergence sum gives 1.0000004253036394. The existing recipe applies one uniform scale of 53.913063258941236 km per source unit so its volume-equivalent diameter is 66.89 km. No unit-volume assumption is made. Radius above a 33.445 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (203°, -52°), with sidereal period 27.41 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/4695) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/53579/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2020)](https://damit.cuni.cz/projects/damit/references/view/658) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 66.89 ± 0.82 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2020), ATLAS photometry](https://arxiv.org/pdf/2010.01820) — retained primary publication; see the body-specific selection and calibration above.

Select one complete 2020 ATLAS convex solution, 4695 (203,-52), keeping 4696 (6,-34). Both poles appear in the publication table; no rejected alternative is listed. The selected model is photometric, not a resolved image reconstruction.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 4696, pole ['6', '-34'], https://damit.cuni.cz/projects/damit/asteroid_models/view/4696

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 668.9 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
