# (193) Ambrosia: source and interpretation

Checked 2026-09-09. Selected DAMIT model **548**, version **2013-02-11**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2013); model 548, version 2013-02-11.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 37.89 km effective diameter (catalog ±0.65 km; additional shape and thermal-model uncertainty). Thermal size supplies a volume-scale approximation. The grid marks unavailable imagery; rotational phase is illustrative.

Hanuš2013 table reports 18 dense lightcurves from four apparitions plus 256 sparse measurements. Both mirror poles remain; model 548 is the representative first archived solution. The thermal scale is approximate. Convex inversion supplies broad outline without resolved craters, concavities, reflectance or regolith texture.

The unmodified source has 1002 vertices and 2000 triangles. Its signed tetrahedral volume is 0.99999984422902566 source units³; an independent triangle-centroid divergence sum gives 0.99999984422902566. The existing recipe applies one uniform scale of 30.539189154548517 km per source unit so its volume-equivalent diameter is 37.89 km. No unit-volume assumption is made. Radius above a 18.945 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (141°, -11°), with sidereal period 6.58167 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/548) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/2160/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2013)](https://damit.cuni.cz/projects/damit/references/view/148) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 37.89 ± 0.65 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2013), A&A 551, A67](https://arxiv.org/pdf/1301.6943) — retained primary publication; see the body-specific selection and calibration above.
- [Usui et al. (2011), PASJ 63, 1117–1138](https://arxiv.org/pdf/1106.1948) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2013 table reports 18 dense lightcurves from four apparitions plus 256 sparse measurements. Both mirror poles remain; model 548 is the representative first archived solution.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 549, pole ['328', '-17'], https://damit.cuni.cz/projects/damit/asteroid_models/view/549

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 378.9 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
