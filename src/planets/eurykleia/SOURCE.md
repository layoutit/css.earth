# (195) Eurykleia: source and interpretation

Checked 2026-09-09. Selected DAMIT model **3102**, version **2019-06-24**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2019); model 3102, version 2019-06-24.

## Shape, scale and orientation

Convex light-curve reconstruction; 87 km volume-equivalent diameter (published 3-sigma range 78–98 km). The grid marks unavailable imagery; rotational phase is illustrative.

Marciniak2019 Table1 gives 51 dense lightcurves over seven apparitions. AM1 (101,+71) gives slightly better thermal chi-square than AM2 (0.51 vs 0.60), but neither pole is decisively rejected. Section4.3 adopts 87 km with asymmetric 3-sigma range 78–98 km because WISE W4 fluxes lie systematically below the fitted model. This published uncertainty supersedes the archive ±6 km simplification.

The unmodified source has 1018 vertices and 2032 triangles. Its signed tetrahedral volume is 344791.40013818286 source units³; an independent triangle-centroid divergence sum gives 344791.40013818286. The existing recipe applies one uniform scale of 0.99999996557302251 km per source unit so its volume-equivalent diameter is 87 km. No unit-volume assumption is made. Radius above a 43.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (101°, 71°), with sidereal period 16.5218 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/3102) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/9829/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/179) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 89.38 ± 1.1 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Marciniak et al. (2019), A&A 625, A139](https://arxiv.org/pdf/1905.06056) — retained primary publication; see the body-specific selection and calibration above.

Marciniak2019 Table1 gives 51 dense lightcurves over seven apparitions. AM1 (101,+71) gives slightly better thermal chi-square than AM2 (0.51 vs 0.60), but neither pole is decisively rejected. Section4.3 adopts 87 km with asymmetric 3-sigma range 78–98 km because WISE W4 fluxes lie systematically below the fitted model. This published uncertainty supersedes the archive ±6 km simplification.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 3103, pole ['352', '83'], https://damit.cuni.cz/projects/damit/asteroid_models/view/3103

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 870 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
