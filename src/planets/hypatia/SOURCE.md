# (238) Hypatia: source and interpretation

Checked 2026-09-09. Selected DAMIT model **3844**, version **2019-05-07**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2019); model 3844, version 2019-05-07.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 143.97 km effective diameter (catalog ±1.55 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. The grid marks unavailable imagery; rotational phase is illustrative.

Gaia DR2 plus Lowell inversion; publication table gives334 Lowell and20 Gaia points. Both poles remain; model3844 is representative. This is a coarse convex inverse model with an approximate thermal size. The thermal scale is approximate. Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 0.99999970373272962 source units³; an independent triangle-centroid divergence sum gives 0.99999970373272962. The existing recipe applies one uniform scale of 116.03925226942087 km per source unit so its volume-equivalent diameter is 143.97 km. No unit-volume assumption is made. Radius above a 71.985 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (261°, 45°), with sidereal period 8.87273 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/3844) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/12046/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/182) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 143.97 ± 1.55 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2019), A&A 631, A2](https://arxiv.org/pdf/1909.09395) — retained primary publication; see the body-specific selection and calibration above.
- [Usui et al. (2011), PASJ 63, 1117–1138](https://arxiv.org/pdf/1106.1948) — retained primary publication; see the body-specific selection and calibration above.

Gaia DR2 plus Lowell inversion; publication table gives334 Lowell and20 Gaia points. Both poles remain; model3844 is representative. This is a coarse convex inverse model with an approximate thermal size.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 3845, pole ['84', '20'], https://damit.cuni.cz/projects/damit/asteroid_models/view/3845

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1439.7 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
