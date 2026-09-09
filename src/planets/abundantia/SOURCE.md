# (151) Abundantia: source and interpretation

Checked 2026-09-09. Selected DAMIT model **4625**, version **2019-10-23**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2020); model 4625, version 2019-10-23.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 42.18 km (catalog ±0.49 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Select one of the two complete 2020 ATLAS convex models, 4625 (188,32). The counterpart 4626 (3,16) remains possible. The independent 2021 ASAS-SN pole (187,21) supports the same broad family but is not the selected mesh or an exact attitude validation.

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 1.0000000471213351 source units³; an independent triangle-centroid divergence sum gives 1.0000000471213351. The existing recipe applies one uniform scale of 33.996909776214096 km per source unit so its volume-equivalent diameter is 42.18 km. No unit-volume assumption is made. Radius above a 21.09 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (188°, 32°), with sidereal period 9.8643 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/4625) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/53045/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2020)](https://damit.cuni.cz/projects/damit/references/view/658) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 42.18 ± 0.49 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2020), ATLAS photometry](https://arxiv.org/pdf/2010.01820) — retained primary publication; see the body-specific selection and calibration above.
- [Hanuš et al. (2021), ASAS-SN photometry](https://arxiv.org/pdf/2107.10027) — retained primary publication; see the body-specific selection and calibration above.

Select one of the two complete 2020 ATLAS convex models, 4625 (188,32). The counterpart 4626 (3,16) remains possible. The independent 2021 ASAS-SN pole (187,21) supports the same broad family but is not the selected mesh or an exact attitude validation.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 4626, pole ['3', '16'], https://damit.cuni.cz/projects/damit/asteroid_models/view/4626

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 421.8 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
