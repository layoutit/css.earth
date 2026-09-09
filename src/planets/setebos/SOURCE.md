# Setebos source model

Setebos is an outer moon of Uranus. This model translates observed brightness variation into a minimum elongation, assuming uniform reflectivity, equal short axes and a doubled shape-driven rotation period.

Approximate ellipsoid from brightness variability, using an assumed-albedo 47 km size. Equal short axes and orientation are assumed; the rotation period adopts a doubled shape interpretation. The grid marks unmapped terrain.

## Selected geometry

D=47 km adopted from 2023 author table; assumed-albedo brightness scale, no quoted formal size uncertainty.

{"semiAxesKm": [27.73753493781565, 21.630564936199526, 21.630564936199526], "fullAxesKm": [55.4750698756313, 43.26112987239905, 43.26112987239905], "referenceRadiusKm": 23.5}

## Assumptions

- Uniform reflectivity and equator-on projected-area interpretation select a minimum elongation.
- Equal short axes b=c; unknown polar compression is not measured.
- Effective/photometric scale normalized as volume-equivalent display radius only.
- Arbitrary ICRF north pole, spin sense and meridian, not current body attitude.

## Source interpretation limits

- K2 paper reports single-peaked photometric period 4.255h; selected shape-driven full rotation doubles it, consistent with2023 table. Not a uniquely established rotation period.

## Orbit and orientation

Published doubled rotational interpretation; phase/pole are illustrative.

Parent-relative state and any fit interval are owned by source/validation evidence. No borrowed parent state, arbitrary current phase or untested propagator is asserted by this package. The source recipe uses illustrative meridian zero.

## Survey and sources

- [Farkas-Takacs et al. Uranian irregular moons with K2, Herschel and Spitzer](https://arxiv.org/pdf/1706.06837)
- [Uranian irregular satellites physical summary and occultation prospects](https://www.hou.usra.edu/meetings/uranusflagship2023/eposter/8187.pdf)

Other observation/shape candidates and rejected paths are recorded in docs/moons/review-2026-09-08/outer_companions-review.json and docs/moons/b1-preparation/outer-inputs.json. No mapped photographic, elevation, composition, atmosphere or ring layer is justified by this selected source.

All source parameters stay in authored data; shared preparation creates the retained CSS scene. No runtime surface or geometry synthesis.
