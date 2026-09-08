# Romulus source model

Romulus is Sylvia’s outer moon. This approximation selects one published occultation-limb solution and assumes equal depth. A later reanalysis admits different correlated limb shapes, so this is not a unique measured figure.

One published projected-limb solution, 23.1±0.7 km area-equivalent diameter and 2.7±0.3 axis ratio, with equal depth assumed. The 2020 reanalysis allows other correlated ellipse shapes. The grid marks unmapped terrain.

## Selected geometry

Published2013 projected area-equivalent diameter23.1±0.7km and ellipse ratio2.7±0.3.

{"semiAxesKm": [18.978586617554008, 7.029106154649631, 7.029106154649631], "fullAxesKm": [37.957173235108016, 14.058212309299263, 14.058212309299263], "referenceRadiusKm": 9.787866191310176}

## Assumptions

- Select2014 reported projected ellipse as one admissible illustrative member.
- Choose unseen c=b; viewing along assumed c reproduces adopted projected ellipse.
- Do not call2.7:1 a unique measured3D shape.

## Source interpretation limits

- Herald2020 shows strong covariance between ellipse axes and orientation; preserve this in visible lens description.

## Orbit and orientation

Illustrative pole and phase; no uniquely measured spin attitude.

Parent-relative state and any fit interval are owned by source/validation evidence. No borrowed parent state, arbitrary current phase or untested propagator is asserted by this package. The source recipe uses illustrative meridian zero.

## Survey and sources

- [Berthier et al. Sylvia physical/dynamical properties](https://www.sciencedirect.com/science/article/abs/pii/S001910351400308X)
- [Sylvia system updated shape, occultations and orbits](https://www.aanda.org/articles/aa/pdf/2021/06/aa40342-21.pdf)

Other observation/shape candidates and rejected paths are recorded in docs/moons/review-2026-09-08/outer_companions-review.json and docs/moons/b1-preparation/outer-inputs.json. No mapped photographic, elevation, composition, atmosphere or ring layer is justified by this selected source.

All source parameters stay in authored data; shared preparation creates the retained CSS scene. No runtime surface or geometry synthesis.

## Retained orbit qualification

The fixed-epoch orbit uses the published 2021 Sylvia-system model retained in source/orbit/published-parameters.json. Independent projections from the newer Miriade 2024 solution differ by about 42 milliarcseconds (140 km in the sky plane) at the scene epoch and 23–63 milliarcseconds over six checks. These checks establish an approximate orbital context; they do not reproduce or claim the paper’s 9.85-milliarcsecond fit RMS. Full source receipts and limits are retained in source/validation/epoch-state.json, source/validation/projection-checks.json, and docs/moons/b1-preparation/romulus-orbit.md. This orbit qualification is separate from the selected 2014 illustrative shape-family member and its 2020 geometric reanalysis caveat.
