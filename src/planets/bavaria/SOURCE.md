# (301) Bavaria: source and interpretation

Checked 2026-09-09. Selected DAMIT model **3090**, version **2019-06-24**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2019); model 3090, version 2019-06-24.

## Shape, scale and orientation

Convex light-curve reconstruction with archive equivalent-volume size55 km (published thermal-size3-sigma interval53–57 km). The vertical shape is poorly constrained. Both pole solutions remain possible. The grid marks unavailable imagery; rotational phase is illustrative.

Marciniak2019 §4.4 fits36 thermal measurements from IRAS, AKARI and WISE. Both mirror poles fit; the selected second pole, AM 2 at (226°, +70°), is representative, not unique. High pole latitude makes the vertical extent poorly constrained. The archived physical mesh has equivalent-volume diameter55 km and Table2 reports thermal size55±2 km at3σ. The paper calls D a shape scaling value without an explicit volume definition, so the archive volume and paper thermal uncertainty are distinguished.

The unmodified source has 1010 vertices and 2016 triangles. Its signed tetrahedral volume is 87113.746610160262 source units³; an independent triangle-centroid divergence sum gives 87113.746610160248. The existing recipe applies one uniform scale of 0.99999999877557311 km per source unit so its volume-equivalent diameter is 55 km. No unit-volume assumption is made. Radius above a 27.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (226°, 70°), with sidereal period 12.2409 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/3090) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/9793/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Marciniak et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/179) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 51.9 ± 0.82 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Marciniak et al. (2019), A&A 625, A139](https://hebe.astro.amu.edu.pl/docs/aa35129-19.pdf) — retained primary publication; see the body-specific selection and calibration above.

Marciniak2019 §4.4 fits36 thermal measurements from IRAS, AKARI and WISE. Both mirror poles fit; the selected second pole, AM 2 at (226°, +70°), is representative, not unique. High pole latitude makes the vertical extent poorly constrained. The archived physical mesh has equivalent-volume diameter55 km and Table2 reports thermal size55±2 km at3σ. The paper calls D a shape scaling value without an explicit volume definition, so the archive volume and paper thermal uncertainty are distinguished.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 3091, pole ['46', '61'], https://damit.cuni.cz/projects/damit/asteroid_models/view/3091

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 550 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
