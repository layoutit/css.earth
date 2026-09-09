# (276) Adelheid: source and interpretation

Checked 2026-09-09. Selected DAMIT model **189**, version **2011-03-28**. DAMIT, Astronomical Institute of Charles University; A. Marciniak (2007), Ďurech et al. (2011), Hanuš et al. (2013); model 189, version 2011-03-28.

## Shape, scale and orientation

Convex light-curve reconstruction, 104 ± 11 km volume-equivalent diameter. Both pole solutions remain possible. The grid marks unavailable imagery; rotational phase is illustrative.

The selected convex pole(9,−4) remains one of two possible orientations. Ďurech2011 fits three occultation chords (two close together) at125±15 km and cannot distinguish the poles. Hanuš2013 Table3 obtains volume-equivalent104±11 km for this pole from one Keck AO observation, matching the later archive comment. This newer resolved-image scale is explicitly transferred to the original mesh, rather than treating the archived125 km coordinates as final physical kilometers. One-image size and local morphology remain uncertain.

The unmodified source has 1598 vertices and 3192 triangles. Its signed tetrahedral volume is 1022653.8517369278 source units³; an independent triangle-centroid divergence sum gives 1022653.8517369275. The existing recipe applies one uniform scale of 0.83200000185859968 km per source unit so its volume-equivalent diameter is 104 km. No unit-volume assumption is made. Radius above a 52 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (9°, -4°), with sidereal period 6.3192 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/189) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/540/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [A. Marciniak (2007)](https://damit.cuni.cz/projects/damit/references/view/117) — original model publication record.
- [Ďurech et al. (2011)](https://damit.cuni.cz/projects/damit/references/view/139) — original model publication record.
- [Hanuš et al. (2013)](https://damit.cuni.cz/projects/damit/references/view/149) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 135.3 ± 2.09 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. (2013), Icarus 226, 1045–1057](https://arxiv.org/pdf/1308.0446) — retained primary publication; see the body-specific selection and calibration above.
- [Ďurech et al. (2011), Icarus 214, 652–670](https://arxiv.org/pdf/1104.4227) — retained primary publication; see the body-specific selection and calibration above.

The selected convex pole(9,−4) remains one of two possible orientations. Ďurech2011 fits three occultation chords (two close together) at125±15 km and cannot distinguish the poles. Hanuš2013 Table3 obtains volume-equivalent104±11 km for this pole from one Keck AO observation, matching the later archive comment. This newer resolved-image scale is explicitly transferred to the original mesh, rather than treating the archived125 km coordinates as final physical kilometers. One-image size and local morphology remain uncertain.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 190, pole ['199', '-20'], https://damit.cuni.cz/projects/damit/asteroid_models/view/190

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1040 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
