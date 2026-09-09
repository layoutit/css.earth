# Hiʻiaka source model

Hiʻiaka is Haumea’s largest moon. Stellar occultations and photometry constrain this published triaxial model. It illustrates the inferred bulk shape; the display pole and meridian are not a measured current attitude.

Published occultation/photometric model with semiaxes 240±40, 180±30 and 143±7 km. The axes are inferred together under homogeneous surface brightness. Display orientation is illustrative. The grid marks unmapped terrain.

## Selected geometry

Directly adopt published inferred semiaxes; do not renormalize to370km volume-equivalent diameter.

{"semiAxesKm": [240, 180, 143], "fullAxesKm": [480, 360, 286], "referenceRadiusKm": 183.4875470120756}

## Assumptions

- Use nominal reported axes without inventing covariance.
- Display orientation remains illustrative until the Haumea-aligned pole is correctly transformed; aspect angle is not inertial declination.
- Reuse numerical facts and newly authored ellipsoid, not copyrighted article figures.

## Source interpretation limits

- Published marginal axes uncertainties are correlated; do not combine independent extrema as a fitted confidence region.
- Workbook contains label saying2023-04-16 while event/year data say2021; do not use the label as epoch.
- Workbook article termsCC BY-NC-ND4.0 do not establish a freely redistributable adapted graphic.

## Orbit and orientation

Period is measured photometrically; provisional display pole/phase explicitly illustrative.

Parent-relative state and any fit interval are owned by source/validation evidence. No borrowed parent state, arbitrary current phase or untested propagator is asserted by this package. The source recipe uses illustrative meridian zero.

## Survey and sources

- [Hiʻiaka stellar occultations and shape](https://www.nature.com/articles/s41467-025-65749-1)
- [Hiʻiaka paper Source Data workbook](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41467-025-65749-1/MediaObjects/41467_2025_65749_MOESM3_ESM.xlsx)
- [Non-Keplerian Haumea satellite orbits](https://doi.org/10.3847/PSJ/ad26e9)

Other observation/shape candidates and rejected paths are recorded in docs/moons/review-2026-09-08/outer_companions-review.json and docs/moons/b1-preparation/outer-inputs.json. No mapped photographic, elevation, composition, atmosphere or ring layer is justified by this selected source.

All source parameters stay in authored data; shared preparation creates the retained CSS scene. No runtime surface or geometry synthesis.

## Selected fixed-epoch position

Hiʻiaka uses the retained JPL#110 system solution, not the newer2024 interacting orbit. Its older2005–2008 observations support limited phase accuracy; the source reports900km uncertainty at2025-Jan-01, not an uncertainty bound at the2026 scene epoch. Exact target/center IDs, time conversion, vectors, parent GM and independent heliocentric composition checks are in source/validation/epoch-state.json. Runtime extrapolation is not enabled.
