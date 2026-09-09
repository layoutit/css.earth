# (252) Clementina: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1912**, version **2018-07-18**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2018); model 1912, version 2018-07-18.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 67.67 km effective diameter (catalog ±0.82 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. Both pole solutions remain possible. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Published convex inversion from Ďurech et al. (2018). The selected archive solution is retained as a reproducible coarse model. An alternative pole remains possible; no unique orientation is claimed. The release supplies no registered global surface imagery or measured local terrain. AKARI thermal effective diameter provides only an explicit volume-scale approximation.

The unmodified source has 554 vertices and 1104 triangles. Its signed tetrahedral volume is 1.0000000727612957 source units³; an independent triangle-centroid divergence sum gives 1.0000000727612954. The existing recipe applies one uniform scale of 54.541746441304575 km per source unit so its volume-equivalent diameter is 67.67 km. No unit-volume assumption is made. Radius above a 33.835 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (121°, 46°), with sidereal period 10.8619 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1912) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/6262/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2018)](https://damit.cuni.cz/projects/damit/references/view/175) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 67.67 ± 0.82 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2018), BlueEye600 shape models](https://arxiv.org/pdf/1707.03637) — retained primary publication; see the body-specific selection and calibration above.

Published convex inversion from Ďurech et al. (2018). The selected archive solution is retained as a reproducible coarse model. An alternative pole remains possible; no unique orientation is claimed. The release supplies no registered global surface imagery or measured local terrain. AKARI thermal effective diameter provides only an explicit volume-scale approximation.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 1913, pole ['307', '59'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1913

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 676.7 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
