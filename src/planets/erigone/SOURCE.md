# (163) Erigone: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1399**, version **2017-05-11**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2018), Ďurech et al. (2016); model 1399, version 2017-05-11.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 72.14 km (catalog ±0.95 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. An alternative pole remains possible. The grid marks unavailable imagery.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Select BlueEye600 model 1399 (191,-75), supported by Ďurech et al. (2018), Table 1, with five dense light curves, two apparitions, and Lowell sparse data. Alternative 1783 (359,-74) remains; publication nominal second pole is (358,-73). An occultation event or special background star is not itself a global shape calibration.

The unmodified source has 1005 vertices and 2006 triangles. Its signed tetrahedral volume is 1.0000000484983402 source units³; an independent triangle-centroid divergence sum gives 1.0000000484983402. The existing recipe applies one uniform scale of 58.14454884140271 km per source unit so its volume-equivalent diameter is 72.14 km. No unit-volume assumption is made. Radius above a 36.07 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (191°, -75°), with sidereal period 16.1403 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1399) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/4948/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2018)](https://damit.cuni.cz/projects/damit/references/view/168) — original model publication record.
- [Ďurech et al. (2016)](https://damit.cuni.cz/projects/damit/references/view/162) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 72.14 ± 0.95 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2018), BlueEye600 shape models](https://arxiv.org/pdf/1707.03637) — retained primary publication; see the body-specific selection and calibration above.

Select BlueEye600 model 1399 (191,-75), supported by Ďurech et al. (2018), Table 1, with five dense light curves, two apparitions, and Lowell sparse data. Alternative 1783 (359,-74) remains; publication nominal second pole is (358,-73). An occultation event or special background star is not itself a global shape calibration.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 1783, pole ['359', '-74'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1783

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 721.4 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
