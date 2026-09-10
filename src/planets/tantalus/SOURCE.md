# (2102) Tantalus: source and interpretation

Checked 2026-09-09. Original [DAMIT model 6205](https://damit.cuni.cz/projects/damit/asteroid_models/view/6205), version 2022-07-13.

## Shape and physical scale

Radar and optical shape reconstruction. Radar-calibrated diameter: 1.45 ± 0.2 km. Grid marks unavailable mapped imagery; rotational phase is illustrative.

The prograde radar/optical model 6205 is selected because Rożek et al. 2022 find it more consistent with WISE size determination than retrograde 6204. The alternative pole remains unresolved. The convex-only model 6203 is not substituted. The original shape is uniformly scaled to the selected archive diameter. Quoted diameter fit uncertainty does not describe local shape accuracy. No albedo, craters or regolith map is inferred.

The unchanged original shape contains 1000 vertices and 1996 faces. Signed volume is 1.5962562691861362 source units³; an independent centroid/divergence sum gives 1.5962562691861362. Its source-volume equivalent diameter is 1.4499999854441232 source units. Uniform scale is 1.0000000100385358 km/source unit, preserving the selected archive's declared 1.45 km size. Neither a unit-volume assumption nor a borrowed ellipsoid is used.

## Orientation

Source pole: ecliptic J2000 (36°,30°). Reference sidereal period: 2.39006 h. Equatorial conversion uses obliquity 23.439291111°. Original +Z axis and +X meridian are retained. Absolute rotational phase is arbitrary; reference-period display rotation is not a YORP propagation model. Heliocentric state is generated through the shared Horizons owner at 2026-09-03; its TDB-as-TT approximation is under 2 ms.

## Source survey

- [Original numerical mesh](https://damit.cuni.cz/projects/damit/stored_files/open/66623/shape.txt) — selected, pinned unchanged.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — pole, period, units and archive diameter definitions; CC BY 4.0.
- [Rożek et al. (2022)](https://damit.cuni.cz/projects/damit/references/view/663)
- [Rożek et al. (2022), radar and optical Tantalus shape](https://arxiv.org/html/2206.14306)

Alternative shapes/poles: [model 6203](https://damit.cuni.cz/projects/damit/asteroid_models/view/6203), pole ['210', '-30']; [model 6204](https://damit.cuni.cz/projects/damit/asteroid_models/view/6204), pole ['180', '-30']

No registered global reflectance texture is supplied by the selected release. Lightcurves and disk-integrated thermal/radar measurements do not supply surface texels. The normal grid identifies unavailable imagery. The Elevation view reports source radius minus the stated reference sphere; it is shape-derived false color, not independent topography or gravitational height.

## Preparation

Existing source-meshoptimizer preparation retains source connectivity, reduces within an 800-native-u-face budget, and uses 128 px raster cells. The source-fit allowance is 14.5 m; source-model accuracy and simplification error remain separate. Shared retained DOM, camera, navigation and shell are reused. Shadows and Orbit start off. Source, numerical and visual qualification are recorded with the PR.
