# (258) Tyche: source and interpretation

Checked 2026-09-09. Selected DAMIT model **329**, version **2011-04-21**. DAMIT, Astronomical Institute of Charles University; Hanuš (2011); model 329, version 2011-04-21.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 64.37 km effective diameter (catalog ±0.89 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. Both pole solutions remain possible. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Published convex inversion from Hanuš (2011). The selected archive solution is retained as a reproducible coarse model. An alternative pole remains possible; no unique orientation is claimed. The release supplies no registered global surface imagery or measured local terrain. AKARI thermal effective diameter provides only an explicit volume-scale approximation.

The unmodified source has 1016 vertices and 2028 triangles. Its signed tetrahedral volume is 0.9999999645722949 source units³; an independent triangle-centroid divergence sum gives 0.9999999645722949. The existing recipe applies one uniform scale of 51.881961652706366 km per source unit so its volume-equivalent diameter is 64.37 km. No unit-volume assumption is made. Radius above a 32.185 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (224°, -4°), with sidereal period 10.0401 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/329) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1213/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš (2011)](https://damit.cuni.cz/projects/damit/references/view/141) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 64.37 ± 0.89 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2011), A&A 530, A134](https://arxiv.org/pdf/1104.4114) — retained primary publication; see the body-specific selection and calibration above.

Published convex inversion from Hanuš (2011). The selected archive solution is retained as a reproducible coarse model. An alternative pole remains possible; no unique orientation is claimed. The release supplies no registered global surface imagery or measured local terrain. AKARI thermal effective diameter provides only an explicit volume-scale approximation.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 330, pole ['40', '-9'], https://damit.cuni.cz/projects/damit/asteroid_models/view/330

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 643.7 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
