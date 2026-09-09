# (250) Bettina: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1850**, version **2017-09-21**. DAMIT, Astronomical Institute of Charles University; Viikinkoski et al. (2017); model 1850, version 2017-09-21.

## Shape, scale and orientation

Nonconvex ADAM shape constrained by resolved AO imaging and light curves, 110 ± 5 km volume-equivalent diameter. Only one resolved AO observation constrains this reconstruction. The grid marks unavailable imagery; rotational phase is illustrative.

The 2017 ADAM reconstruction combines optical light curves with one resolved adaptive-optics observation. With only one AO observation, jackknife image resampling is impossible; size uncertainty comes from different shape supports. The selected archive solution has volume-equivalent diameter110±5 km, while the paper ensemble reports109±5 km. Its source-scale adjustment preserves the archived surface and does not add image texture.

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 698720.03584500984 source units³; an independent triangle-centroid divergence sum gives 698720.03584500984. The existing recipe applies one uniform scale of 0.99913573834884117 km per source unit so its volume-equivalent diameter is 110 km. No unit-volume assumption is made. Radius above a 55 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (99°, 10°), with sidereal period 5.05441 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1850) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/528/shape.txt) — included unchanged. Nonconvex ADAM shape constrained by resolved AO imaging and light curves; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Viikinkoski et al. (2017)](https://damit.cuni.cz/projects/damit/references/view/171) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 109.37 ± 1.48 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Viikinkoski et al. (2017), A&A 607, A117](https://arxiv.org/pdf/1708.05191) — retained primary publication; see the body-specific selection and calibration above.

The 2017 ADAM reconstruction combines optical light curves with one resolved adaptive-optics observation. With only one AO observation, jackknife image resampling is impossible; size uncertainty comes from different shape supports. The selected archive solution has volume-equivalent diameter110±5 km, while the paper ensemble reports109±5 km. Its source-scale adjustment preserves the archived surface and does not add image texture.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 187, pole ['100', '17'], https://damit.cuni.cz/projects/damit/asteroid_models/view/187

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1100 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
