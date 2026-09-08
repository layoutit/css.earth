# 1235 Schorria: source interpretation

Checked 2026-09-08. This package uses an original published convex lightcurve-inversion mesh, with an approximate physical scale derived from separate thermal observations. It does not contain a photographed surface or independently measured topography.

## Shape selection

Selected [DAMIT model 5955](https://damit.cuni.cz/projects/damit/asteroid_models/view/5955), version 2022-02-14, from Hanuš et al. The [original vertex/facet table](https://damit.cuni.cz/projects/damit/stored_files/open/65142/shape.txt) contains 1020 vertices and 2036 triangular facets. All current DAMIT matches for this number were inspected; none supplies a calibrated diameter. The selected file's numerical volume is 1.00000011025 source units cubed, consistent with the unit-volume normalization documented by DAMIT. Source coordinates and face connectivity remain unchanged in the pinned input.

DAMIT assigns quality flag **1**: a coarse reconstruction from sparse photometry with substantial shape and pole uncertainty. The model constrains a broad outline; small surface features and concavities are not resolved.

The selected lower-id pole is one admissible published solution. The alternative remains unresolved; selection is not evidence that one pole is physically preferred.

| Model | Ecliptic pole λ, β | Sidereal period |
| --- | --- | --- |
| 5955 (selected) | 103°, -59° | 1304.1 h |
| [5956](https://damit.cuni.cz/projects/damit/asteroid_models/view/5956) | 279°, -62° | 1304.1 h |

## Physical scale and uncertainty

The adopted diameter is **5.55 km** from [Alí-Lagoa & Delbo (2017), A&A603,A55](https://doi.org/10.1051/0004-6361/201629917); [original measurement data](https://cdsarc.cds.unistra.fr/ftp/J/A+A/603/A55/table1.dat). Its quantity is **NEATM effective spherical diameter from W2 data with assumed beaming 1.20**.

- Diameter uncertainty: ±1.11 km. Derived minimum 20% diameter error prescribed by the source publication for its assumed-beaming fits; not an individually estimated statistical error.
- Additional limitation: At least 20% total relative diameter uncertainty under the fixed-beaming fit; further shape/aspect effects can remain.
- Selection: Direct published WISE Mars-crosser fit supplies scale absent from the main NEOWISE V2 compiled catalog and current SBDB. Source-prescribed uncertainty is retained.

The thermal measurement is an effective spherical diameter at its observing geometry, not an independent measurement of the convex model's enclosed volume. Applying it to a unit-volume mesh is an explicitly approximate display normalization. It is not a thermophysical refit using this mesh, a stellar-occultation size, or an exact volume-equivalent calibration. A scale uncertainty changes every linear model dimension by the same proportion.

Preparation uses the existing metre-per-source-unit parameter:

```text
V = Σ dot(a, cross(b, c)) / 6
D_source = cbrt(6 * V / π)
metresPerSourceUnit = 1000 * 5.55 / D_source
                    = 4473.277508
referenceRadiusKm = 5.55 / 2 = 2.775
```

The signed volume above is independently computed from the original closed triangle mesh, not assumed to be exactly one. No density, mass or gravitational parameter is inferred from this normalization.

The 5.55 km W2-only diameter has an assumed beaming parameter and at least 20% uncertainty; the exceptionally slow spin makes full rotation coverage especially incomplete.

## Coordinates, spin and display phase

[Original spin.txt](https://damit.cuni.cz/projects/damit/generated_files/open/AsteroidModel/5955/spin.txt) specifies the J2000 ecliptic pole λ = 103°, β = -59°, a sidereal period of 1304.1 hours, reference epoch JD 2456489, and reference angle φ₀ = 0°. The original DAMIT co-rotating Cartesian frame is preserved: +Z is its north pole and +X defines the model meridian. [DAMIT's frame and file documentation](https://damit.cuni.cz/pages/documentation) defines the body-to-ecliptic transform.

The existing observed-pole recipe keeps an **arbitrary display phase** (`displayMeridianDegrees: 0`, `phase: arbitrary-display-phase`). It does not propagate the source JD₀ and φ₀ as an absolute rotational ephemeris. The archived epoch and phase are retained for provenance, not claimed as the current attitude. The published pole is converted to the existing J2000 equatorial convention using the shared obliquity transform. Accelerated viewer rotation is illustrative. Orbital position remains owned by the separately pinned JPL source and the shared preparation recipe; a fitted model's spin epoch is not its orbital epoch.

## Available views and candidate survey

| Source | Disposition |
| --- | --- |
| [Current DAMIT model record](https://damit.cuni.cz/projects/damit/asteroid_models/view/5955) | Include original shape and published spin. The examined release supplies no registered optical map, geological map or resolved albedo field. |
| [Thermal sizing data](https://cdsarc.cds.unistra.fr/ftp/J/A+A/603/A55/table1.dat) | Include a global size estimate and uncertainty only. Unresolved thermal flux/albedo measurements cannot supply spatial texels or a temperature map. |
| [Other DAMIT matches](https://damit.cuni.cz/?q=1235) | Inspected for calibrated replacements; retain the selected solution and disclose available alternatives. |

The Shape lens uses cssEarth's existing shared grid to identify unavailable imagery. Any Elevation lens is **source-shape radius minus the chosen reference sphere**, a model-derived geometric quantity whose absolute scale inherits the thermal-size uncertainty. It is not independent terrain surveying or gravitational elevation. Optional directional Shadows are illustrative lighting on that mesh, separate from the grid; Shadows default to off. No regolith, optical texture, density, atmospheric layer or geological interpretation is fabricated.

## Intake evidence and remaining qualification

Intake verified original-file hashes, spin/model-field agreement, finite coordinates, valid indices, a closed two-manifold with consistently oriented shared edges, nonzero-area facets and positive signed volume. These checks qualify source intake only. Simplified geometry, scalar transfer, decoded atlases, retained-DOM rendering, headless browser behavior, installation closure and measured delivery/performance are integration-stage evidence and are not claimed here.

## Publications and reuse

- [Hanuš et al. (2021) — V-band photometry of asteroids from ASAS-SN. Finding asteroids with slow spin](https://damit.cuni.cz/projects/damit/references/view/662).
- [Alí-Lagoa & Delbo (2017), A&A603,A55](https://doi.org/10.1051/0004-6361/201629917) and its linked catalog field definitions.
- DAMIT website/model material: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), unless the original release explicitly states otherwise. Attribute the model authors and Astronomical Institute, Charles University, Josef Ďurech and Vojtěch Sidorin.
- Thermal measurements are original author-supplied scientific table values distributed through CDS. Retain Alí-Lagoa & Delbo (2017) and CDS attribution. The article retains its publication terms; full paper pages are research evidence, not runtime assets.
