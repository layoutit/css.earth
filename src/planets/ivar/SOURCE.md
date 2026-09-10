# (1627) Ivar: source and interpretation

Checked 2026-09-09. Original [DAMIT model 271](https://damit.cuni.cz/projects/damit/asteroid_models/view/271), version 2016-04-22.

## Shape and physical scale

Convex lightcurve model at the archive fixed-shape scale of 7.4 km (archived ±0.2 km; additional shape-model uncertainty). Grid marks unavailable imagery.

The calibrated 2016 convex solution is selected; the older nonconvex model 272 is explicitly labelled plausible in the archive and is not a resolved terrain measurement. The original shape is uniformly scaled to the selected archive diameter. Quoted diameter fit uncertainty does not describe local shape accuracy. No albedo, craters or regolith map is inferred. Hanuš et al. 2015 Table 4 distinguishes this fixed revised shape fit from the varied-shape ensemble, which gives a wider size range (8.0 km, -0.9/+0.3 km). The archive 7.4 km scale is used consistently with its mesh; the narrow archived error is not total physical uncertainty.

The unchanged original shape contains 1020 vertices and 2036 faces. Signed volume is 212.1747578652795 source units³; an independent centroid/divergence sum gives 212.1747578652795. Its source-volume equivalent diameter is 7.3999996235878962 source units. Uniform scale is 1.0000000508665032 km/source unit, preserving the selected archive's declared 7.4 km size. Neither a unit-volume assumption nor a borrowed ellipsoid is used.

## Orientation

Source pole: ecliptic J2000 (334°,39°). Reference sidereal period: 4.79517 h. Equatorial conversion uses obliquity 23.439291111°. Original +Z axis and +X meridian are retained. Absolute rotational phase is arbitrary; reference-period display rotation is not a YORP propagation model. Heliocentric state is generated through the shared Horizons owner at 2026-09-03; its TDB-as-TT approximation is under 2 ms.

## Source survey

- [Original numerical mesh](https://damit.cuni.cz/projects/damit/stored_files/open/913/shape.txt) — selected, pinned unchanged.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — pole, period, units and archive diameter definitions; CC BY 4.0.
- [Hanuš et al. (2015)](https://damit.cuni.cz/projects/damit/references/view/163)
- [Kaasalainen et al. (2004)](https://damit.cuni.cz/projects/damit/references/view/107)
- [Hanuš et al. (2015), thermophysical fits with shape and pole uncertainty](https://arxiv.org/html/1504.04199)

Alternative shapes/poles: [model 272](https://damit.cuni.cz/projects/damit/asteroid_models/view/272), pole ['336', '39']

No registered global reflectance texture is supplied by the selected release. Lightcurves and disk-integrated thermal/radar measurements do not supply surface texels. The normal grid identifies unavailable imagery. The Elevation view reports source radius minus the stated reference sphere; it is shape-derived false color, not independent topography or gravitational height.

## Preparation

Existing source-meshoptimizer preparation retains source connectivity, reduces within an 800-native-u-face budget, and uses 128 px raster cells. The source-fit allowance is 74 m; source-model accuracy and simplification error remain separate. Shared retained DOM, camera, navigation and shell are reused. Shadows and Orbit start off. Source, numerical and visual qualification are recorded with the PR.
