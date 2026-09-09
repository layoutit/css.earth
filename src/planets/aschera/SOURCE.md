# (214) Aschera: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1435**, version **2016-01-12**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2016); model 1435, version 2016-01-12.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 26.07 km effective diameter (catalog ±0.34 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. The grid marks unavailable imagery; rotational phase is illustrative.

Ďurech2016 table reports 386 Lowell sparse measurements and a period identified by the ellipsoid method before convex reconstruction. Two poles remain. Select1435 as a reproducible representative and label the shape as coarse lightcurve inversion. The thermal scale is approximate. Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 1.000000046371027 source units³; an independent triangle-centroid divergence sum gives 1.000000046371027. The existing recipe applies one uniform scale of 21.012314795817147 km per source unit so its volume-equivalent diameter is 26.07 km. No unit-volume assumption is made. Radius above a 13.035 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (123°, -37°), with sidereal period 6.8337 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1435) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/5059/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2016)](https://damit.cuni.cz/projects/damit/references/view/162) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 26.07 ± 0.34 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2016), A&A 587, A48](https://arxiv.org/pdf/1601.02909) — retained primary publication; see the body-specific selection and calibration above.
- [Usui et al. (2011), PASJ 63, 1117–1138](https://arxiv.org/pdf/1106.1948) — retained primary publication; see the body-specific selection and calibration above.

Ďurech2016 table reports 386 Lowell sparse measurements and a period identified by the ellipsoid method before convex reconstruction. Two poles remain. Select1435 as a reproducible representative and label the shape as coarse lightcurve inversion.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 1436, pole ['306', '-42'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1436

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 260.7 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
