# (187) Lamberta: source and interpretation

Checked 2026-09-09. Selected DAMIT model **5914**, version **2021-11-12**. DAMIT, Astronomical Institute of Charles University; Vernazza et al. (2021); model 5914, version 2021-11-12.

## Shape, scale and orientation

ADAM nonconvex reconstruction constrained by VLT/SPHERE images. Selected archive volume-equivalent diameter: 141 ±2 km. The grid marks unavailable imagery; rotational phase is illustrative.

The pinned mesh is an inverse model, not a directly sampled surface. No registered reflectance mosaic is supplied by this release; a neutral grid must mark unavailable imagery. Fine-scale craters, regolith and albedo are unresolved. Absolute rotational phase is illustrative. Select Vernazza et al. (2021) ADAM model5914 over older convex1086. The VLT/SPHERE imaging study reports volume-equivalent141 ±2 km, agreeing with the selected archive diameter and raw volume141.094. MPCD is a promising refinement documented in the paper; its linked LAM release could not be retrieved during this survey. The mounted source is the pinned ADAM mesh, not an unverified MPCD or reflectance product.

The unmodified source has 902 vertices and 1800 triangles. Its signed tetrahedral volume is 1470693.7403402955 source units³; an independent triangle-centroid divergence sum gives 1470693.7403402955. The existing recipe applies one uniform scale of 0.99933532370243183 km per source unit so its volume-equivalent diameter is 141 km. No unit-volume assumption is made. Radius above a 70.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (115°, -80°), with sidereal period 10.667 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/5914) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/63532/shape.txt) — included unchanged. ADAM nonconvex reconstruction constrained by VLT/SPHERE images; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Vernazza et al. (2021)](https://damit.cuni.cz/projects/damit/references/view/660) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 130.44 ± 1.89 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Vernazza et al. (2021), ESO-hosted author manuscript](https://www.eso.org/public/archives/releases/sciencepapers/eso2114/eso2114a.pdf) — retained primary publication; see the body-specific selection and calibration above.

Select Vernazza et al. (2021) ADAM model5914 over older convex1086. The VLT/SPHERE imaging study reports volume-equivalent141 ±2 km, agreeing with the selected archive diameter and raw volume141.094. MPCD is a promising refinement documented in the paper; its linked LAM release could not be retrieved during this survey. The mounted source is the pinned ADAM mesh, not an unverified MPCD or reflectance product.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 1086, pole ['153', '-56'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1086

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1410 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
