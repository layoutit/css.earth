# (157) Dejanira: source and interpretation

Checked 2026-09-09. Selected DAMIT model **591**, version **2013-02-19**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2013); model 591, version 2013-02-19.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 22.47 km (catalog ±1.24 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Model 591 (319,-64), version 2013-02-19, is the later archive member and matches the first pole in Hanuš et al. (2013). Model 590 (146,-33) remains an allowed alternative. The two pole directions are substantially separated; no claim of unique attitude is made.

The unmodified source has 560 vertices and 1116 triangles. Its signed tetrahedral volume is 1.0000000151881592 source units³; an independent triangle-centroid divergence sum gives 1.0000000151881592. The existing recipe applies one uniform scale of 18.110729511685488 km per source unit so its volume-equivalent diameter is 22.47 km. No unit-volume assumption is made. Radius above a 11.235 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (319°, -64°), with sidereal period 15.8287 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/591) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/2332/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2013)](https://damit.cuni.cz/projects/damit/references/view/148) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 22.47 ± 1.24 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2013), combined dense and sparse photometry](https://arxiv.org/pdf/1301.6943) — retained primary publication; see the body-specific selection and calibration above.

Model 591 (319,-64), version 2013-02-19, is the later archive member and matches the first pole in Hanuš et al. (2013). Model 590 (146,-33) remains an allowed alternative. The two pole directions are substantially separated; no claim of unique attitude is made.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 590, pole ['146', '-33'], https://damit.cuni.cz/projects/damit/asteroid_models/view/590

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 224.7 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
