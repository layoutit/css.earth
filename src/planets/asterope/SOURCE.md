# (233) Asterope: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1823**, version **2017-06-16**. DAMIT, Astronomical Institute of Charles University; Hanuš et al. (2017); model 1823, version 2017-06-16.

## Shape, scale and orientation

Nonconvex ADAM reconstruction constrained by adaptive optics and occultation; 107 km volume-equivalent diameter (±3 km). The grid marks unavailable imagery; rotational phase is illustrative.

Hanuš2017 ADAM uses13 lightcurves, one adaptive-optics image and one occultation; disk-resolved/occultation data reject the alternate convex pole. The selected archived ADAM mesh has pole(318,+61) and volume-equivalent diameter106.926418 km, matching its rounded archive107±3 km. The paper reports an ensemble106±3 km and pole(316,+58), within the stated model uncertainties. Use the pinned archive solution, not an assertion that the paper’s ensemble is exactly107 km. AO and occultation constrain broad shape; no resolved global reflectance or regolith texture is supplied.

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 640108.62323457503 source units³; an independent triangle-centroid divergence sum gives 640108.62323457515. The existing recipe applies one uniform scale of 1.0006881550930256 km per source unit so its volume-equivalent diameter is 107 km. No unit-volume assumption is made. Radius above a 53.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (318°, 61°), with sidereal period 19.698 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1823) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/4019/shape.txt) — included unchanged. Nonconvex ADAM reconstruction constrained by adaptive optics and occultation; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Hanuš et al. (2017)](https://damit.cuni.cz/projects/damit/references/view/169) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 93.02 ± 0.96 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2017), A&A 601, A114](https://arxiv.org/pdf/1702.01996) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2017 ADAM uses13 lightcurves, one adaptive-optics image and one occultation; disk-resolved/occultation data reject the alternate convex pole. The selected archived ADAM mesh has pole(318,+61) and volume-equivalent diameter106.926418 km, matching its rounded archive107±3 km. The paper reports an ensemble106±3 km and pole(316,+58), within the stated model uncertainties. Use the pinned archive solution, not an assertion that the paper’s ensemble is exactly107 km. AO and occultation constrain broad shape; no resolved global reflectance or regolith texture is supplied.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 1093, pole ['322', '59'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1093

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1070 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
