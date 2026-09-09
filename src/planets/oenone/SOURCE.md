# (215) Oenone: source and interpretation

Checked 2026-09-09. Selected DAMIT model **16312**, version **2025-07-15**. DAMIT, Astronomical Institute of Charles University; Choukroun et al. (2025); model 16312, version 2025-07-15.

## Shape, scale and orientation

Convex CITPM shape; 37 ± 2 km volume-equivalent thermal size. Occultations give 46 ± 1 km for a separate optical-only shape. The grid marks unavailable imagery; rotational phase is illustrative.

Choukroun2025 Table4 explicitly defines D as the equivalent-volume sphere diameter, and the unchanged CITPM mesh independently yields 37 km. Its pole (45,+85) identifies Table4 pole1. The 46±1 km occultation comment belongs to the paper’s separate lightcurve-only shape (section4.2); that shape is explicitly less smooth and is not interchangeable with this CITPM mesh. Both mirror poles fit the occultation similarly; select model16312 as pole1 without rejecting4825. The thermal/occultation size discrepancy remains visible rather than transferring the other mesh’s diameter.

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 26521.847920031152 source units³; an independent triangle-centroid divergence sum gives 26521.847920031152. The existing recipe applies one uniform scale of 1.0000000108130913 km per source unit so its volume-equivalent diameter is 37 km. No unit-volume assumption is made. Radius above a 18.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (45°, 85°), with sidereal period 27.9077 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/16312) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/129887/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Choukroun et al. (2025)](https://damit.cuni.cz/projects/damit/references/view/678) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 35.92 ± 0.41 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Choukroun et al. (2025), A&A 698, A298](https://arxiv.org/pdf/2505.09437) — retained primary publication; see the body-specific selection and calibration above.

Choukroun2025 Table4 explicitly defines D as the equivalent-volume sphere diameter, and the unchanged CITPM mesh independently yields 37 km. Its pole (45,+85) identifies Table4 pole1. The 46±1 km occultation comment belongs to the paper’s separate lightcurve-only shape (section4.2); that shape is explicitly less smooth and is not interchangeable with this CITPM mesh. Both mirror poles fit the occultation similarly; select model16312 as pole1 without rejecting4825. The thermal/occultation size discrepancy remains visible rather than transferring the other mesh’s diameter.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 4825, pole ['233', '85'], https://damit.cuni.cz/projects/damit/asteroid_models/view/4825

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 370 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
