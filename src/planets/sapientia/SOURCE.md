# (275) Sapientia: source and interpretation

Checked 2026-09-09. Selected DAMIT model **16284**, version **2023-10-03**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2023); model 16284, version 2023-10-03.

## Shape, scale and orientation

Convex light-curve reconstruction scaled by stellar occultations: 103 km volume-equivalent diameter (model range96–109 km). The grid marks unavailable imagery; rotational phase is illustrative.

The selected convex pole2 is preferred by nine occultation epochs in Marciniak2023 §5.2. Table1 gives103 km with asymmetric size interval96–109 km, accounting for acceptable vertical-shape variations. The archive latitude is −2°, differing by 1° from the paper value −1° (published latitude uncertainty ±20°); the cause of the difference is not established. The archive period 14.93046 h also differs slightly from the paper 14.93045 ± 0.00005 h; the archived spin is retained. The paper also reports a stronger nonconvex ADAM pole2 shape at100±1 km; DAMIT lists only the two convex solutions and the targeted ISAM release page returned no model rows, so that improved mesh remains unresolved. It is not substituted by an invented shape.

The unmodified source has 1020 vertices and 2036 triangles. Its signed tetrahedral volume is 572150.5235493955 source units³; an independent triangle-centroid divergence sum gives 572150.5235493955. The existing recipe applies one uniform scale of 0.99999999750287583 km per source unit so its volume-equivalent diameter is 103 km. No unit-volume assumption is made. Radius above a 51.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (264°, -2°), with sidereal period 14.9305 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/16284) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/126589/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2023)](https://damit.cuni.cz/projects/damit/references/view/667) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 118.86 ± 1.76 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Marciniak et al. (2023), A&A 679, A60, accepted author manuscript](https://winstars.net/wp-content/uploads/2023/09/Marciniak-et-al-2023-AA-Scaling-slowly-rotating-asteroids-stellar-occultations-accepted.pdf) — retained primary publication; see the body-specific selection and calibration above.

The selected convex pole2 is preferred by nine occultation epochs in Marciniak2023 §5.2. Table1 gives103 km with asymmetric size interval96–109 km, accounting for acceptable vertical-shape variations. The archive latitude is −2°, differing by 1° from the paper value −1° (published latitude uncertainty ±20°); the cause of the difference is not established. The archive period 14.93046 h also differs slightly from the paper 14.93045 ± 0.00005 h; the archived spin is retained. The paper also reports a stronger nonconvex ADAM pole2 shape at100±1 km; DAMIT lists only the two convex solutions and the targeted ISAM release page returned no model rows, so that improved mesh remains unresolved. It is not substituted by an invented shape.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 16283, pole ['85', '-10'], https://damit.cuni.cz/projects/damit/asteroid_models/view/16283

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1030 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
