# Juliet sources and interpretation

Juliet uses one **Shape model** dataset and the shared missing-coverage grid.
[Karkoschka (2001), Table IV, printed page 55](https://doi.org/10.1006/icar.2001.6596)
adopts radius axes A=75 km and B=37 km in a prolate model: A points toward
Uranus and both perpendicular radii equal B. Thus the displayed dimensions are
150 × 74 × 74 km. The third axis is assumed by that model, not independently
measured. The analytic radius table preserves these axes without rescaling.

[French et al. (2024), Table 3, PDF page 10](https://arxiv.org/abs/2401.04634)
reproduces the Voyager paper's Table V: projected √(AB) radius 53 ± 4 km and
B/A=0.5 ± 0.1. These uncertainties are not independent errors on each axis.
The reference radius ∛(AB²)=46.8261 km is derived from the adopted volume;
it is distinct from the reported projected radius.

`source/shape/rotation.json` evaluates the NAIF PCK00011 BODY711 IAU rotation
at the prepared epoch, JD2461286.5 TT. Its small U6 pole/meridian corrections
are fixed at that epoch while the shared runtime advances the linear meridian.
This is a display approximation, not a complete long-term nutation ephemeris.
The PCK's old 42 km spherical radii are deliberately not used for geometry.
The body coordinates are east-positive longitude with the modeled long axis
at 0°/180° longitude. Shared Flood and Shadows shade the same retained mesh.

| Candidate | Disposition |
| --- | --- |
| Karkoschka 2001 HST photometry, adopted Voyager dimensions | Included as a prolate shape approximation, not local relief. HST rotational photometry independently supports strong elongation. |
| [PDS Voyager ISS](https://pds-rings.seti.org/voyager/iss/), calibrated/geometrically corrected images | Sorted 3,441 indexed Juliet observations by body-center sampling. Best C2673225 is 46.28754 km per native pixel, about 3.2 samples along the longest possible diameter. Downloaded and inspected the 1000×1000 GEOMED raster and label: geometric resampling cannot add native surface detail. Its 15.36 s exposure and 5:1 scan also limit an inferred footprint. Excluded as a photographic surface map. |
| French 2024 occultation analysis | Included for shape uncertainty and orbital context; no spatial surface field. |
| [HST photometry](https://doi.org/10.1006/icar.2001.6596) and [Keck near-infrared photometry](https://www.sciencedirect.com/science/article/pii/S0019103522004237) | Integrated brightness/color measurements cannot supply resolved surface texels. No separate Color or composition map qualified. |
| [JPL texture catalog](https://space.jpl.nasa.gov/tmaps/uranus.html), PDS shape releases and USGS mapping survey | No usable registered Juliet texture, detailed mesh, elevation or geology product located. Absence from the inspected catalogs is not a claim that no future dataset can exist. |
| [NASA overview](https://science.nasa.gov/uranus/moons/juliet/) | Used for discovery and naming only. Its older size/albedo paragraph predates the source measurements and does not override them. |

The original Voyager paper's full table is paywalled; the 2024 primary study
explicitly reproduces it. The accessible HST paper independently lists the
adopted axes. A compact measured-data transcription is checked in; preparation
does not depend on downloading papers or the Northwestern mirror's invalid TLS
certificate. The archived image identity, sampling and label are retained under
`source/survey/`; the research-only IMG is not a runtime or preparation input.

Every material pixel is explicitly no-data. The shared grid supplies surface,
thumbnail, minimap and context imagery. It does not assert gray albedo, craters,
photometric correction or an observed texture. Preparation targets 480 native
`u` leaves; input, lighting, preparation and rendering use the existing owners.

The shared orbital model fits daily JPL states over 2020–2032. Its maximum
residual at six independent evaluation epochs is 119.87 km; that sampled
residual is not an all-time error bound or a current-ephemeris guarantee.
