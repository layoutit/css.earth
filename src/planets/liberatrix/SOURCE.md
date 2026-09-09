# (125) Liberatrix: source and interpretation

Checked 2026-09-09. Selected DAMIT model **157**, version **2007-02-27**. DAMIT, Astronomical Institute of Charles University; J. Ďurech (2007); model 157, version 2007-02-27.

## Shape, scale and orientation

Convex light-curve reconstruction with a thermophysical volume scale of 51.1 ± 2.1 km (reported model-ensemble range). An alternative pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

Ďurech2007 is the actual published collaboration-network shape source. Hanuš2018 TableA.3 uses its pole(95,68), period3.96820 h, QF3 and VS-TPM volume-equivalent diameter51.1±2.1 km. Only this uniform size transfer is applied to nominal DAMIT157. The alternative pole(280,74) has its own50.1±1.3 km fit and remains possible; the varied-model ensemble does not establish byte-identical local terrain.

The unmodified source has 1598 vertices and 3192 triangles. Its signed tetrahedral volume is 0.99999989847966386 source units³; an independent triangle-centroid divergence sum gives 0.99999989847966386. The existing recipe applies one uniform scale of 41.186395818873095 km per source unit so its volume-equivalent diameter is 51.1 km. No unit-volume assumption is made. Radius above a 25.55 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (95°, 68°), with sidereal period 3.9682 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

Empirical VS-TPM interval formed from the smallest range of14 best-fit varied-shape solutions out of20 (approximately68% of models), as defined in Hanuš2018 section3. It is not an independent Gaussian confidence interval or a local surface accuracy bound.

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/157) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/383/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [J. Ďurech (2007)](https://damit.cuni.cz/projects/damit/references/view/113) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 43.17 ± 0.67 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2018), Icarus 309, 297–337](https://arxiv.org/pdf/1803.06116) — retained primary publication; see the body-specific selection and calibration above.

Ďurech2007 is the actual published collaboration-network shape source. Hanuš2018 TableA.3 uses its pole(95,68), period3.96820 h, QF3 and VS-TPM volume-equivalent diameter51.1±2.1 km. Only this uniform size transfer is applied to nominal DAMIT157. The alternative pole(280,74) has its own50.1±1.3 km fit and remains possible; the varied-model ensemble does not establish byte-identical local terrain.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 158, pole ['280', '74'], https://damit.cuni.cz/projects/damit/asteroid_models/view/158

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 511 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
