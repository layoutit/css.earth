# (165) Loreley: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1809**, version **2017-06-16**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1809, version 2017-06-16.

## Shape, scale and orientation

ADAM nonconvex reconstruction constrained by Keck adaptive-optics images. Selected archive volume-equivalent diameter: 177 ±5 km. The grid marks unavailable imagery; rotational phase is illustrative.

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral grid must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative. Select the 2017 ADAM nonconvex model 1809 over convex 295. Hanuš et al. (2017) reports 30 light curves, four AO images, and one occultation; the earlier pole ambiguity was removed by occultations and confirmed by AO. The publication ensemble gives 173 ±5 km and (178±3,31±3); the selected archive release gives 177 ±5 km and (180,31), with raw volume diameter 176.965. Keep the exact archived solution distinct from the ensemble estimate. No mass or density inference is adopted.

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 2901776.9965023012 source units³; an independent triangle-centroid divergence sum gives 2901776.9965023012. The existing recipe applies one uniform scale of 1.0001952689394022 km per source unit so its volume-equivalent diameter is 177 km. No unit-volume assumption is made. Radius above a 88.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (180°, 31°), with sidereal period 7.22439 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1809) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1020/shape.txt) — included unchanged. ADAM nonconvex reconstruction constrained by Keck adaptive-optics images; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2017)](https://damit.cuni.cz/projects/damit/references/view/169) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 173.66 ± 2.65 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2017), ADAM models](https://arxiv.org/pdf/1702.01996) — retained primary publication; see the body-specific selection and calibration above.

Select the 2017 ADAM nonconvex model 1809 over convex 295. Hanuš et al. (2017) reports 30 light curves, four AO images, and one occultation; the earlier pole ambiguity was removed by occultations and confirmed by AO. The publication ensemble gives 173 ±5 km and (178±3,31±3); the selected archive release gives 177 ±5 km and (180,31), with raw volume diameter 176.965. Keep the exact archived solution distinct from the ensemble estimate. No mass or density inference is adopted.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 295, pole ['174', '29'], https://damit.cuni.cz/projects/damit/asteroid_models/view/295

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1770 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
