# (286) Iclea: source and interpretation

Checked 2026-09-09. Selected DAMIT model **5017**, version **2023-10-03**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2023); model 5017, version 2023-10-03.

## Shape, scale and orientation

Convex light-curve reconstruction scaled by stellar occultations: 86 km volume-equivalent diameter (model range79–99 km). The grid marks unavailable imagery; rotational phase is illustrative.

Marciniak2023 §5.3 prefers pole1(31,13) based on the only available three-chord occultation, agreement with independent period/pole recovery, and inconsistent smaller size for pole2. Table1 gives volume-equivalent86 km with asymmetric interval79–99 km; these limits reflect model vertical-stretch variation, not Gaussian local surface error. The archive keeps the larger13 km side as a symmetric error field; the actual asymmetric range is preserved here.

The unmodified source has 994 vertices and 1984 triangles. Its signed tetrahedral volume is 333038.14017642365 source units³; an independent triangle-centroid divergence sum gives 333038.14017642359. The existing recipe applies one uniform scale of 1.0000000026378641 km per source unit so its volume-equivalent diameter is 86 km. No unit-volume assumption is made. Radius above a 43 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (31°, 13°), with sidereal period 15.3612 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/5017) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/127591/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2023)](https://damit.cuni.cz/projects/damit/references/view/667) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 109.11 ± 1.49 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Marciniak et al. (2023), A&A 679, A60, accepted author manuscript](https://winstars.net/wp-content/uploads/2023/09/Marciniak-et-al-2023-AA-Scaling-slowly-rotating-asteroids-stellar-occultations-accepted.pdf) — retained primary publication; see the body-specific selection and calibration above.

Marciniak2023 §5.3 prefers pole1(31,13) based on the only available three-chord occultation, agreement with independent period/pole recovery, and inconsistent smaller size for pole2. Table1 gives volume-equivalent86 km with asymmetric interval79–99 km; these limits reflect model vertical-stretch variation, not Gaussian local surface error. The archive keeps the larger13 km side as a symmetric error field; the actual asymmetric range is preserved here.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 16295, pole ['196', '44'], https://damit.cuni.cz/projects/damit/asteroid_models/view/16295

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 860 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
