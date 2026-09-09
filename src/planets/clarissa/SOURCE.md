# (302) Clarissa: source and interpretation

Checked 2026-09-09. Selected DAMIT model **296**, version **2011-02-17**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2011), Hanuš (2011); model 296, version 2011-02-17.

## Shape, scale and orientation

Convex light-curve reconstruction, 43 ± 4 km volume-equivalent diameter. This pole gives the preferred occultation fit; the rival pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

Ďurech2011 describes this as a very elongated convex model. Both poles fit the2004 occultation; selected pole(28,−72) fits particularly well and is preferred in DAMIT, but its rival is not rejected. Three video chords have reported timing errors of tenths of a second. Table3 gives volume-equivalent43±4 km for this pole; local surface relief is unresolved.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 41629.777050978482 source units³; an independent triangle-centroid divergence sum gives 41629.777050978482. The existing recipe applies one uniform scale of 0.99999992633890256 km per source unit so its volume-equivalent diameter is 43 km. No unit-volume assumption is made. Radius above a 21.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (28°, -72°), with sidereal period 14.4767 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/296) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1032/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Ďurech et al. (2011)](https://damit.cuni.cz/projects/damit/references/view/139) — original model publication record.
- [Hanuš (2011)](https://damit.cuni.cz/projects/damit/references/view/141) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 34.44 ± 0.48 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2011), Icarus 214, 652–670](https://arxiv.org/pdf/1104.4227) — retained primary publication; see the body-specific selection and calibration above.
- [Hanuš et al. (2011), A&A 530, A134](https://arxiv.org/pdf/1104.4114) — retained primary publication; see the body-specific selection and calibration above.

Ďurech2011 describes this as a very elongated convex model. Both poles fit the2004 occultation; selected pole(28,−72) fits particularly well and is preferred in DAMIT, but its rival is not rejected. Three video chords have reported timing errors of tenths of a second. Table3 gives volume-equivalent43±4 km for this pole; local surface relief is unresolved.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 297, pole ['190', '-72'], https://damit.cuni.cz/projects/damit/asteroid_models/view/297

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 430 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
