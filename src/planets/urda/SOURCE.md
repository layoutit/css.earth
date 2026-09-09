# (167) Urda: source and interpretation

Checked 2026-09-09. Selected DAMIT model **172**, version **2011-03-28**. DAMIT, Astronomical Institute of Charles University; Slivan et al. (2003), B. D. Warner (2008), Ďurech et al. (2011); model 172, version 2011-03-28.

## Shape, scale and orientation

Convex light-curve reconstruction. Selected archive volume-equivalent diameter: 44 ±15 km. An alternative pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral grid must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative. Select archive model 172 (249,-68), explicitly marked preferred. Ďurech et al. (2011), discussion and Fig.34, says it fits better but the rival cannot be rejected and size is not very accurate; one negative chord was visual. Retain the direct occultation volume-equivalent 44 ±15 km estimate. The later Hanuš et al. (2018) VS-TPM 41.5 ±0.8 km at this pole is a comparison, not an independent local-shape accuracy claim.

The unmodified source has 1022 vertices and 2040 triangles. Its signed tetrahedral volume is 44602.235078373204 source units³; an independent triangle-centroid divergence sum gives 44602.235078373196. The existing recipe applies one uniform scale of 1.0000000225862542 km per source unit so its volume-equivalent diameter is 44 km. No unit-volume assumption is made. Radius above a 22 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (249°, -68°), with sidereal period 13.0613 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/172) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/467/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Slivan et al. (2003)](https://damit.cuni.cz/projects/damit/references/view/105) — original model publication record.
- [B. D. Warner (2008)](https://damit.cuni.cz/projects/damit/references/view/120) — original model publication record.
- [Ďurech et al. (2011)](https://damit.cuni.cz/projects/damit/references/view/139) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 38.36 ± 0.46 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2011), occultation silhouette scaling](https://arxiv.org/pdf/1104.4227) — retained primary publication; see the body-specific selection and calibration above.
- [Hanuš et al. (2018), VS-TPM size study, Table A.3](https://arxiv.org/pdf/1803.06116) — retained primary publication; see the body-specific selection and calibration above.

Select archive model 172 (249,-68), explicitly marked preferred. Ďurech et al. (2011), discussion and Fig.34, says it fits better but the rival cannot be rejected and size is not very accurate; one negative chord was visual. Retain the direct occultation volume-equivalent 44 ±15 km estimate. The later Hanuš et al. (2018) VS-TPM 41.5 ±0.8 km at this pole is a comparison, not an independent local-shape accuracy claim.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 171, pole ['107', '-69'], https://damit.cuni.cz/projects/damit/asteroid_models/view/171

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 440 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
