# 1449 Virtanen

## Sources

<a id="shape-selection"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1175](https://damit.cuni.cz/projects/damit/asteroid_models/view/1175) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Selected [DAMIT model 1175](https://damit.cuni.cz/projects/damit/asteroid_models/view/1175), version 2016-01-04, from Hanuš et al.

The adopted diameter is **9.263 km** from [Masiero et al. (2014), ApJ 791, 121](https://doi.org/10.1088/0004-637X/791/2/121); [original measurement data](https://irsa.ipac.caltech.edu/TAP/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=select+%2A+from+neowisesbpropv2+where+asteroid_number%3D1449). Its quantity is **NEATM effective spherical diameter at the observing geometry**.

## Evidence

The [virtanen validation record](../../../docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

## Known problems

The archived record leaves its quality flag blank; no quality grade is invented. A convex reconstruction describes broad shape and cannot recover small craters or concavities.

The selected lower-id pole is one admissible published solution. The alternative remains unresolved; selection is not evidence that one pole is physically preferred.

- Diameter uncertainty: ±0.098 km. Published statistical/Monte Carlo fit error; excludes the additional systematic term below.
- Additional limitation: Original publication reports approximately 10% additional systematic uncertainty in diameter. This is a population-level floor, not a shape-specific accuracy guarantee.
- Selection: Selected fully cryogenic data when available; these data include W3 or W4 thermal measurements. Other survey epochs are retained separately.

The thermal measurement is an effective spherical diameter at its observing geometry, not an independent measurement of the convex model's enclosed volume. Applying it to a unit-volume mesh is an explicitly approximate display normalization. It is not a thermophysical refit using this mesh, a stellar-occultation size, or an exact volume-equivalent calibration.

A scale uncertainty changes every linear model dimension by the same proportion.

The Shape lens uses cssEarth's existing shared grid to identify unavailable imagery. Any Elevation lens is **source-shape radius minus the chosen reference sphere**, a model-derived geometric quantity whose absolute scale inherits the thermal-size uncertainty. It is not independent terrain surveying or gravitational elevation.

Optional directional Shadows are illustrative lighting on that mesh, separate from the grid; Shadows default to off.

The archived epoch and phase are retained for provenance, not claimed as the current attitude.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape selection</summary>

Checked 2026-09-08. This package uses an original published convex lightcurve-inversion mesh, with an approximate physical scale derived from separate thermal observations. It does not contain a photographed surface or independently measured topography.

The [original vertex/facet table](https://damit.cuni.cz/projects/damit/stored_files/open/4266/shape.txt) contains 1012 vertices and 2020 triangular facets. All current DAMIT matches for this number were inspected; none supplies a calibrated diameter. The selected file's numerical volume is 1.00000028269 source units cubed, consistent with the unit-volume normalization documented by DAMIT.

Source coordinates and face connectivity remain unchanged in the pinned input.

| Model | Ecliptic pole λ, β | Sidereal period |
| --- | --- | --- |
| 1175 (selected) | 307°, 58° | 30.5005 h |
| [1176](https://damit.cuni.cz/projects/damit/asteroid_models/view/1176) | 99°, 58° | 30.5006 h |

</details>

<a id="physical-scale-and-uncertainty"></a>

<details>
<summary>Physical scale and uncertainty</summary>

Preparation uses the existing metre-per-source-unit parameter:

```text
V = Σ dot(a, cross(b, c)) / 6
D_source = cbrt(6 * V / π)
metresPerSourceUnit = 1000 * 9.263 / D_source
                    = 7465.94003151
referenceRadiusKm = 9.263 / 2 = 4.6315
```

The signed volume above is independently computed from the original closed triangle mesh, not assumed to be exactly one. No density, mass or gravitational parameter is inferred from this normalization.

Other published epochs are retained separately, not averaged:

| Reference code | Mean JD | Diameter (km) | Quoted fit error (km) |
| --- | --- | --- | --- |
| Nug16 | 2457158.3114304 | 9.185 | 1.756 |
| Mas12 | 2455543.9574115 | 9.464 | 0.326 |

These quoted errors have their original statistical/fit meaning and do not establish agreement with the selected scale or include all systematic effects.

</details>

<a id="coordinates-spin-and-display-phase"></a>

<details>
<summary>Coordinates, spin and display phase</summary>

[Original spin.txt](https://damit.cuni.cz/projects/damit/generated_files/open/AsteroidModel/1175/spin.txt) specifies the J2000 ecliptic pole λ = 307°, β = 58°, a sidereal period of 30.5005 hours, reference epoch JD 2450875, and reference angle φ₀ = 0°. The original DAMIT co-rotating Cartesian frame is preserved: +Z is its north pole and +X defines the model meridian. [DAMIT's frame and file documentation](https://damit.cuni.cz/pages/documentation) defines the body-to-ecliptic transform.

The display uses an **arbitrary phase** (`displayMeridianDegrees: 0`, `phase: arbitrary-display-phase`). It does not propagate the source JD₀ and φ₀ as an absolute rotational ephemeris. The published pole is converted to the existing J2000 equatorial convention using the shared obliquity transform.

Accelerated viewer rotation is illustrative. Orbital position remains owned by the separately pinned JPL source and the shared preparation recipe; a fitted model's spin epoch is not its orbital epoch.

</details>

<a id="available-views-and-candidate-survey"></a>

<details>
<summary>Available views and candidate survey</summary>

| Source | Disposition |
| --- | --- |
| [Current DAMIT model record](https://damit.cuni.cz/projects/damit/asteroid_models/view/1175) | Include original shape and published spin. The examined release supplies no registered optical map, geological map or resolved albedo field. |
| [Thermal sizing data](https://irsa.ipac.caltech.edu/TAP/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=select+%2A+from+neowisesbpropv2+where+asteroid_number%3D1449) | Include a global size estimate and uncertainty only. Unresolved thermal flux/albedo measurements cannot supply spatial texels or a temperature map. |
| [Other DAMIT matches](https://damit.cuni.cz/?q=1449) | Inspected for calibrated replacements; retain the selected solution and disclose available alternatives. |

</details>

<a id="intake-evidence-and-remaining-qualification"></a>

<details>
<summary>Intake evidence and remaining qualification</summary>

Intake verified original-file hashes, spin/model-field agreement, finite coordinates, valid indices, a closed two-manifold with consistently oriented shared edges, nonzero-area facets and positive signed volume. These checks qualify source intake only. The later validation record linked above covers preparation and application checks separately.

</details>

<a id="publications-and-reuse"></a>

<details>
<summary>Publications and reuse</summary>

- [Hanuš et al. (2016) — New and updated convex shape models of asteroids based on optical data from a large collaboration network](https://damit.cuni.cz/projects/damit/references/view/161).
- [Masiero et al. (2014), ApJ 791, 121](https://doi.org/10.1088/0004-637X/791/2/121) and its linked catalog field definitions.
- DAMIT website/model material: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), unless the original release explicitly states otherwise. Attribute the model authors and Astronomical Institute, Charles University, Josef Ďurech and Vojtěch Sidorin.
- NEOWISE measurement values are distributed by NASA/IPAC IRSA and the NASA PDS Small Bodies Node; retain the cited original thermal-fit authors and survey attribution. Research PDFs are not runtime assets.

</details>
