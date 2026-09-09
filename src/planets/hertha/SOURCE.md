# (135) Hertha: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1799**, version **2017-06-14**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1799, version 2017-06-14.

## Shape, scale and orientation

Nonconvex ADAM shape constrained by resolved AO imaging, light curves and occultations, 79 ± 2 km volume-equivalent diameter. The grid marks unavailable imagery; rotational phase is illustrative.

Hanuš2017 fits optical light curves, two disk-resolved AO images and one18-chord occultation. Archive D79±2 km is retained rather than paper ensemble D80±2 km. No resolved albedo or regolith map is supplied.

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 259354.97595498673 source units³; an independent triangle-centroid divergence sum gives 259354.97595498673. The existing recipe applies one uniform scale of 0.99845486434412345 km per source unit so its volume-equivalent diameter is 79 km. No unit-volume assumption is made. Radius above a 39.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (276°, 53°), with sidereal period 8.4006 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1799) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/427/shape.txt) — included unchanged. Nonconvex ADAM shape constrained by resolved AO imaging, light curves and occultations; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2017)](https://damit.cuni.cz/projects/damit/references/view/169) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 72.78 ± 0.87 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2017), A&A 601, A114](https://arxiv.org/pdf/1702.01996) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2017 fits optical light curves, two disk-resolved AO images and one18-chord occultation. Archive D79±2 km is retained rather than paper ensemble D80±2 km. No resolved albedo or regolith map is supplied.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 162, pole ['272', '52'], https://damit.cuni.cz/projects/damit/asteroid_models/view/162

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 790 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
