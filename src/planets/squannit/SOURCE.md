# Squannit source model

Squannit is Moshup’s companion, formerly 1999 KW4 Beta. This is the original JPL radar-derived shape model. Radar constrains its broad figure, while visible-light terrain and current rotational phase remain unmapped.

JPL radar shape model of 1999 KW 4 Beta, with finite resolution and uneven radar coverage. The original mesh is retained before simplification. Display phase is arbitrary; libration is not reproduced. The grid marks unmapped visible-light terrain.

## Selected geometry

Native mesh scale cross-checked against published full extents 0.57 × 0.46 × 0.35 km.

Later mutual-event photometry favors roughly 1.3 times the original radar model’s linear scale. This view retains the original 2006 mesh dimensions. Scheirich et al. (2021), [Table 4 and pages 14–15](https://arxiv.org/pdf/1912.06456v2), rescale the secondary shape to 130% to fit mutual-event depths, giving a volume-equivalent diameter of 0.59 ± 0.04 km (formal 1-sigma uncertainty; actual uncertainty may be higher). Their discussion identifies low signal-to-noise in the secondary radar echoes as a possible source of underestimated size. The displayed radius remains 0.22550434622701193 km, derived from the original mesh volume.

{"semiAxesKm": null, "fullAxesKm": null, "referenceRadiusKm": 0.22550434622701193}

## Assumptions

- Retain native source connectivity and the original 2006 source scale; disclose the later photometric scale discrepancy.
- No color, craters or albedo texture.

## Source interpretation limits

- PDS model XML and beta spin CSV return HTTP403 in this environment; exact epoch/Euler conventions remain unresolved.
- Reconcile original author OBJ with PDS repackagedOBJ before claiming byte equivalence.

## Orbit and orientation

Illustrative display attitude until source spin/libration convention is qualified.

Parent-relative state and any fit interval are owned by source/validation evidence. No borrowed parent state, arbitrary current phase or untested propagator is asserted by this package. The source recipe uses illustrative meridian zero.

## Survey and sources

- [PDS JPL radar shape model collection](https://sbn.psi.edu/pds/resource/jplradarshape.html)
- [PDS JPL radar shape data directory](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.jpl.radar.shape_models_V1_0/data/)

Other observation/shape candidates and rejected paths are recorded in docs/moons/review-2026-09-08/outer_companions-review.json and docs/moons/b1-preparation/outer-inputs.json. No mapped photographic, elevation, composition, atmosphere or ring layer is justified by this selected source.

All source parameters stay in authored data; shared preparation creates the retained CSS scene. No runtime surface or geometry synthesis.

## Retained orbit qualification

The fixed-epoch orbit is evaluated from Scheirich et al. (2021), Table 4 and section 2.2, with the phase-bearing source parameters retained in source/orbit/published-parameters.json. The 2026 scene extrapolates the 2000–2019 photometric fit. Summed individual phase sensitivities are about 55 degrees at this epoch; this is not a formal confidence interval, and no independent 2026 position product was acquired. The older radar pole checks the orbital plane but does not verify the extrapolated current phase. Geometry retains the original 2006 OBJ scale independently of the later photometric size preference. No current attitude or libration is predicted.
