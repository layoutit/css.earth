# (148) Gallia: source and interpretation

Checked 2026-09-09. Selected DAMIT model **4618**, version **2019-10-23**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2020); model 4618, version 2019-10-23.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 80.87 km (catalog ±1.04 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. The 2020 ATLAS model has one archived pole (140,-17). The 2021 ASAS-SN paper reports a revised pole (147,-37), but the selected DAMIT record is still the ATLAS release and no corresponding new counted mesh is present on the surveyed catalog page. Keep the exact archive identity and acknowledge the later pole estimate; neither supplies resolved imagery.

The unmodified source has 572 vertices and 1140 triangles. Its signed tetrahedral volume is 1.0000001993945815 source units³; an independent triangle-centroid divergence sum gives 1.0000001993945815. The existing recipe applies one uniform scale of 65.180890328417462 km per source unit so its volume-equivalent diameter is 80.87 km. No unit-volume assumption is made. Radius above a 40.435 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (140°, -17°), with sidereal period 20.6636 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/4618) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/52991/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2020)](https://damit.cuni.cz/projects/damit/references/view/658) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 80.87 ± 1.04 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2020), ATLAS photometry](https://arxiv.org/pdf/2010.01820) — retained primary publication; see the body-specific selection and calibration above.
- [Hanuš et al. (2021), ASAS-SN photometry](https://arxiv.org/pdf/2107.10027) — retained primary publication; see the body-specific selection and calibration above.

The 2020 ATLAS model has one archived pole (140,-17). The 2021 ASAS-SN paper reports a revised pole (147,-37), but the selected DAMIT record is still the ATLAS release and no corresponding new counted mesh is present on the surveyed catalog page. Keep the exact archive identity and acknowledge the later pole estimate; neither supplies resolved imagery.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: None listed for this target.

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 808.7 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
