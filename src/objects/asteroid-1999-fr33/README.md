# 80000 1999 FR33

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-selection"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 15145](https://damit.cuni.cz/projects/damit/asteroid_models/view/15145) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Selected [DAMIT model 15145](https://damit.cuni.cz/projects/damit/asteroid_models/view/15145), version 2022-12-01, from Ďurech & Hanuš.

The adopted diameter is **5.754 km** from [Masiero et al. (2011), ApJ 741, 68](https://doi.org/10.1088/0004-637X/741/2/68); [original measurement data](https://irsa.ipac.caltech.edu/TAP/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=select+%2A+from+neowisesbpropv2+where+asteroid_number%3D80000). Its quantity is **NEATM effective spherical diameter at the observing geometry**.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [asteroid-1999-fr33 validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

## Known problems

DAMIT assigns quality flag **1**: a coarse reconstruction from sparse photometry with substantial shape and pole uncertainty. The model constrains a broad outline; small surface features and concavities are not resolved.

The selected lower-id pole is one admissible published solution. The alternative remains unresolved; selection is not evidence that one pole is physically preferred.

- Diameter uncertainty: ±0.174 km. Published statistical/Monte Carlo fit error; excludes the additional systematic term below.
- Additional limitation: Original publication reports approximately 10% additional systematic uncertainty in diameter. This is a population-level floor, not a shape-specific accuracy guarantee.
- Selection: Selected fully cryogenic data when available; these data include W3 or W4 thermal measurements. Other survey epochs are retained separately.

The thermal measurement is an effective spherical diameter at its observing geometry, not an independent measurement of the convex model's enclosed volume. Applying it to a unit-volume mesh is an explicitly approximate display normalization. It is not a thermophysical refit using this mesh, a stellar-occultation size, or an exact volume-equivalent calibration.

A scale uncertainty changes every linear model dimension by the same proportion.

The Shape lens uses cssEarth's existing shared grid to identify unavailable imagery. Any Elevation lens is **source-shape radius minus the chosen reference sphere**, a model-derived geometric quantity whose absolute scale inherits the thermal-size uncertainty. It is not independent terrain surveying or gravitational elevation.

Optional directional Shadows are illustrative lighting on that mesh, separate from the grid; Shadows default to off.

The archived epoch and phase are retained for provenance, not claimed as the current attitude.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape selection</summary>

Checked 2026-09-08. This package uses an original published convex lightcurve-inversion mesh, with an approximate physical scale derived from separate thermal observations. It does not contain a photographed surface or independently measured topography.

The [original vertex/facet table](https://damit.cuni.cz/projects/damit/stored_files/open/119996/shape.txt) contains 570 vertices and 1136 triangular facets. All current DAMIT matches for this number were inspected; none supplies a calibrated diameter. The selected file's numerical volume is 0.999999817703 source units cubed, consistent with the unit-volume normalization documented by DAMIT.

Source coordinates and face connectivity remain unchanged in the pinned input.

| Model | Ecliptic pole λ, β | Sidereal period |
| --- | --- | --- |
| 15145 (selected) | 145°, -85° | 3.38833 h |
| [15146](https://damit.cuni.cz/projects/damit/asteroid_models/view/15146) | 302°, -55° | 3.38834 h |

</details>

<a id="physical-scale-and-uncertainty"></a>

<details>
<summary>Physical scale and uncertainty</summary>

Preparation uses the existing metre-per-source-unit parameter:

```text
V = Σ dot(a, cross(b, c)) / 6
D_source = cbrt(6 * V / π)
metresPerSourceUnit = 1000 * 5.754 / D_source
                    = 4637.70113352
referenceRadiusKm = 5.754 / 2 = 2.877
```

The signed volume above is independently computed from the original closed triangle mesh, not assumed to be exactly one. No density, mass or gravitational parameter is inferred from this normalization.

</details>

<a id="coordinates-spin-and-display-phase"></a>

<details>
<summary>Coordinates, spin and display phase</summary>

[Original spin.txt](https://damit.cuni.cz/projects/damit/generated_files/open/AsteroidModel/15145/spin.txt) specifies the J2000 ecliptic pole λ = 145°, β = -85°, a sidereal period of 3.38833 hours, reference epoch JD 2457021, and reference angle φ₀ = 0°. The original DAMIT co-rotating Cartesian frame is preserved: +Z is its north pole and +X defines the model meridian. [DAMIT's frame and file documentation](https://damit.cuni.cz/pages/documentation) defines the body-to-ecliptic transform.

The display uses an **arbitrary phase** (`displayMeridianDegrees: 0`, `phase: arbitrary-display-phase`). It does not propagate the source JD₀ and φ₀ as an absolute rotational ephemeris. The published pole is converted to the existing J2000 equatorial convention using the shared obliquity transform.

Accelerated viewer rotation is illustrative. Orbital position remains owned by the separately pinned JPL source and the shared preparation recipe; a fitted model's spin epoch is not its orbital epoch.

</details>

<a id="available-views-and-candidate-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="intake-evidence-and-remaining-qualification"></a>

<details>
<summary>Intake evidence and remaining qualification</summary>

Intake verified original-file hashes, spin/model-field agreement, finite coordinates, valid indices, a closed two-manifold with consistently oriented shared edges, nonzero-area facets and positive signed volume. These checks qualify source intake only. The later validation record linked above covers preparation and application checks separately.

</details>

<a id="publications-and-reuse"></a>

<details>
<summary>Publications and reuse</summary>

- [Ďurech & Hanuš (2023) — Reconstruction of asteroid spin states from Gaia DR3 photometry](https://damit.cuni.cz/projects/damit/references/view/665).
- [Masiero et al. (2011), ApJ 741, 68](https://doi.org/10.1088/0004-637X/741/2/68) and its linked catalog field definitions.
- DAMIT website/model material: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), unless the original release explicitly states otherwise. Attribute the model authors and Astronomical Institute, Charles University, Josef Ďurech and Vojtěch Sidorin.
- NEOWISE measurement values are distributed by NASA/IPAC IRSA and the NASA PDS Small Bodies Node; retain the cited original thermal-fit authors and survey attribution. Research PDFs are not runtime assets.

</details>
