# (129) Antigone: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1810**, version **2017-06-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1810, version 2017-06-14.

## Shape, scale and orientation

Nonconvex ADAM shape constrained by resolved AO imaging, light curves and occultations. The selected archive gives 126 ± 3 km equivalent-volume size; its size error is not local shape accuracy. The grid marks unavailable imagery; rotational phase is illustrative.

Hanuš2017 confirms the pole family using disk-resolved AO imaging, light curves and occultations. Section on129 describes eight AO images while TableA.1 lists nine; this discrepancy is retained. Archive D126±3 km is retained; local shape accuracy is not the diameter uncertainty.

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 1052275.475911973 source units³; an independent triangle-centroid divergence sum gives 1052275.475911973. The existing recipe applies one uniform scale of 0.99845141371348756 km per source unit so its volume-equivalent diameter is 126 km. No unit-volume assumption is made. Radius above a 63 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (205°, 63°), with sidereal period 4.95716 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1810) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/401/shape.txt) — included unchanged. Nonconvex ADAM shape constrained by resolved AO imaging, light curves and occultations; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2017)](https://damit.cuni.cz/projects/damit/references/view/169) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 119.55 ± 1.42 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2017), A&A 601, A114](https://arxiv.org/pdf/1702.01996) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2017 confirms the pole family using disk-resolved AO imaging, light curves and occultations. Section on129 describes eight AO images while TableA.1 lists nine; this discrepancy is retained. Archive D126±3 km is retained; local shape accuracy is not the diameter uncertainty.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 159, pole ['207', '58'], https://damit.cuni.cz/projects/damit/asteroid_models/view/159

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1260 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
