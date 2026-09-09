# (109) Felicitas: source and interpretation

Checked 2026-09-09. Selected DAMIT model **3097**, version **2019-06-24**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2019); model 3097, version 2019-06-24.

## Shape, scale and orientation

Convex light-curve reconstruction with the thermally preferred pole. The selected archive mesh has an 85 km equivalent-volume size; the paper reports a thermal-size 3-sigma interval of 80–92 km. The grid marks unavailable imagery; rotational phase is illustrative.

Marciniak2019 section4.2 and TableB.2 prefer AM1 (77,-26), matching model3097: reduced chi-square1.1 versus2.0 for AM2/model3096. The latter is a bad thermal fit. The published diameter is85 km with asymmetric3-sigma interval80–92 km; DAMIT rounds its equivalent-diameter error to6 km. WISE W3/W4 residual offsets remain and roughness is unconstrained.

The unmodified source has 988 vertices and 1972 triangles. Its signed tetrahedral volume is 321555.12813677243 source units³; an independent triangle-centroid divergence sum gives 321555.12813677243. The existing recipe applies one uniform scale of 0.99999996882601128 km per source unit so its volume-equivalent diameter is 85 km. No unit-volume assumption is made. Radius above a 42.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (77°, -26°), with sidereal period 13.1905 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/3097) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/9814/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/179) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 80.81 ± 1.24 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Marciniak et al. (2019), A&A 625, A139](https://hebe.astro.amu.edu.pl/docs/aa35129-19.pdf) — retained primary publication; see the body-specific selection and calibration above.

Marciniak2019 section4.2 and TableB.2 prefer AM1 (77,-26), matching model3097: reduced chi-square1.1 versus2.0 for AM2/model3096. The latter is a bad thermal fit. The published diameter is85 km with asymmetric3-sigma interval80–92 km; DAMIT rounds its equivalent-diameter error to6 km. WISE W3/W4 residual offsets remain and roughness is unconstrained.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 3096, pole ['252', '-49'], https://damit.cuni.cz/projects/damit/asteroid_models/view/3096

 Marciniak2019 section4 calls D a scaling value for the published spin/shape solution and points to DAMIT for its release, but does not explicitly define volume-equivalent D. Equivalent-volume semantics here describe the selected DAMIT mesh and its declared size; they are not quoted as a separate physical-volume definition from that paper.

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 850 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
