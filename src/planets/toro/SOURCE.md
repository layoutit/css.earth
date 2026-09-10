# (1685) Toro: source and interpretation

Checked 2026-09-09. Original [DAMIT model 1862](https://damit.cuni.cz/projects/damit/asteroid_models/view/1862), version 2017-11-21.

## Shape and physical scale

Convex lightcurve model with thermophysical diameter 3.5 km (published interval 3.1–3.8 km). Grid marks unavailable imagery; phase is illustrative.

Published 2018 YORP/thermophysical solution; rotation uses the fixed published reference period, with arbitrary display phase and no runtime YORP propagation. The original shape is uniformly scaled to the selected archive diameter. Quoted diameter fit uncertainty does not describe local shape accuracy. No albedo, craters or regolith map is inferred. The archive symmetrizes its size uncertainty to ±0.4 km; Ďurech et al. 2018 report 3.5 km with an asymmetric -0.4/+0.3 km interval.

The unchanged original shape contains 1022 vertices and 2040 faces. Signed volume is 22.449297570525811 source units³; an independent centroid/divergence sum gives 22.449297570525811. Its source-volume equivalent diameter is 3.500000003468863 source units. Uniform scale is 0.99999999900889625 km/source unit, preserving the selected archive's declared 3.5 km size. Neither a unit-volume assumption nor a borrowed ellipsoid is used.

## Orientation

Source pole: ecliptic J2000 (71°,-69°). Reference sidereal period: 10.1978 h. Equatorial conversion uses obliquity 23.439291111°. Original +Z axis and +X meridian are retained. Absolute rotational phase is arbitrary; reference-period display rotation is not a YORP propagation model. Heliocentric state is generated through the shared Horizons owner at 2026-09-03; its TDB-as-TT approximation is under 2 ms.

## Source survey

- [Original numerical mesh](https://damit.cuni.cz/projects/damit/stored_files/open/6127/shape.txt) — selected, pinned unchanged.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — pole, period, units and archive diameter definitions; CC BY 4.0.
- [Ďurech et al. (2018)](https://damit.cuni.cz/projects/damit/references/view/172)
- [Ďurech et al. (2018), Toro thermophysical scale and YORP](https://arxiv.org/html/1711.05987)

Alternative shapes/poles: None in the checked target listing.

No registered global reflectance texture is supplied by the selected release. Lightcurves and disk-integrated thermal/radar measurements do not supply surface texels. The normal grid identifies unavailable imagery. The Elevation view reports source radius minus the stated reference sphere; it is shape-derived false color, not independent topography or gravitational height.

## Preparation

Existing source-meshoptimizer preparation retains source connectivity, reduces within an 800-native-u-face budget, and uses 128 px raster cells. The source-fit allowance is 35 m; source-model accuracy and simplification error remain separate. Shared retained DOM, camera, navigation and shell are reused. Shadows and Orbit start off. Source, numerical and visual qualification are recorded with the PR.
