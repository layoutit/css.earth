# (230) Athamantis: source and interpretation

Checked 2026-09-09. Selected DAMIT model **185**, version **2007-02-27**. DAMIT, Astronomical Institute of Charles University; Torppa et al. (2003), Hanuš et al. (2013); model 185, version 2007-02-27.

## Shape, scale and orientation

Convex light-curve reconstruction; 115 km volume-equivalent diameter (±12 km). The grid marks unavailable imagery; rotational phase is illustrative.

Hanuš2013 Keck study Table3 independently confirms115±12 km for the first pole and116±12 km for the mirror, based on one adaptive-optics image. DAMIT comment slightly prefers pole(74,+27), selected here. The geometry remains a convex lightcurve model; AO constrains scale and silhouette, not a global photographic surface.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 796328.21249552199 source units³; an independent triangle-centroid divergence sum gives 796328.21249552199. The existing recipe applies one uniform scale of 1.0000000315374733 km per source unit so its volume-equivalent diameter is 115 km. No unit-volume assumption is made. Radius above a 57.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (74°, 27°), with sidereal period 23.9845 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/185) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/519/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Torppa et al. (2003)](https://damit.cuni.cz/projects/damit/references/view/106) — original model publication record.
- [Hanuš et al. (2013)](https://damit.cuni.cz/projects/damit/references/view/149) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 108.28 ± 1.18 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2013), Icarus 226, 1045–1057](https://arxiv.org/pdf/1308.0446) — retained primary publication; see the body-specific selection and calibration above.

Hanuš2013 Keck study Table3 independently confirms115±12 km for the first pole and116±12 km for the mirror, based on one adaptive-optics image. DAMIT comment slightly prefers pole(74,+27), selected here. The geometry remains a convex lightcurve model; AO constrains scale and silhouette, not a global photographic surface.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 186, pole ['237', '29'], https://damit.cuni.cz/projects/damit/asteroid_models/view/186

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1150 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
