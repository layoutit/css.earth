# (1865) Cerberus: source and interpretation

Checked 2026-09-09. Original [DAMIT model 456](https://damit.cuni.cz/projects/damit/asteroid_models/view/456), version 2016-04-22.

## Shape and physical scale

Convex lightcurve model at an uncertain 1.2 km archive scale. The published thermal fit is poor and its size uncertainty is unconstrained. Grid marks unavailable imagery.

The archived model gives D 1.2 km with no diameter uncertainty. Unknown uncertainty is retained as null; neither zero uncertainty nor a precise surface reconstruction is claimed. The original shape is uniformly scaled to the selected archive diameter. Quoted diameter fit uncertainty does not describe local shape accuracy. No albedo, craters or regolith map is inferred. Hanuš et al. 2015 section 4.2 explicitly report a poor thermophysical fit for Cerberus and omit its uncertainties. The DAMIT calibrated flag is retained as archive metadata, not treated as strong physical-size validation.

The unchanged original shape contains 1022 vertices and 2040 faces. Signed volume is 0.90477836020095082 source units³; an independent centroid/divergence sum gives 0.90477836020095082. Its source-volume equivalent diameter is 1.1999998567459849 source units. Uniform scale is 1.0000001193783601 km/source unit, preserving the selected archive's declared 1.2 km size. Neither a unit-volume assumption nor a borrowed ellipsoid is used.

## Orientation

Source pole: ecliptic J2000 (311°,-78°). Reference sidereal period: 6.80329 h. Equatorial conversion uses obliquity 23.439291111°. Original +Z axis and +X meridian are retained. Absolute rotational phase is arbitrary; reference-period display rotation is not a YORP propagation model. Heliocentric state is generated through the shared Horizons owner at 2026-09-03; its TDB-as-TT approximation is under 2 ms.

## Source survey

- [Original numerical mesh](https://damit.cuni.cz/projects/damit/stored_files/open/1783/shape.txt) — selected, pinned unchanged.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — pole, period, units and archive diameter definitions; CC BY 4.0.
- [Ďurech et al. (2012)](https://damit.cuni.cz/projects/damit/references/view/144)
- [Hanuš et al. (2015)](https://damit.cuni.cz/projects/damit/references/view/163)
- [Hanuš et al. (2015), thermophysical fits with shape and pole uncertainty](https://arxiv.org/html/1504.04199)

Alternative shapes/poles: None in the checked target listing.

No registered global reflectance texture is supplied by the selected release. Lightcurves and disk-integrated thermal/radar measurements do not supply surface texels. The normal grid identifies unavailable imagery. The Elevation view reports source radius minus the stated reference sphere; it is shape-derived false color, not independent topography or gravitational height.

## Preparation

Existing source-meshoptimizer preparation retains source connectivity, reduces within an 800-native-u-face budget, and uses 128 px raster cells. The source-fit allowance is 12 m; source-model accuracy and simplification error remain separate. Shared retained DOM, camera, navigation and shell are reused. Shadows and Orbit start off. Source, numerical and visual qualification are recorded with the PR.
