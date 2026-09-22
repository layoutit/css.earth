# 1111 Reinmuthia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-selection"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 678](https://damit.cuni.cz/projects/damit/asteroid_models/view/678) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Selected [DAMIT model 678](https://damit.cuni.cz/projects/damit/asteroid_models/view/678), version 2013-02-11, from Hanuš et al.

The adopted diameter is **24.38 km** from [Usui et al. (2011), PASJ63,1117-1138, AcuA V1](https://doi.org/10.1093/pasj/63.5.1117); [original measurement data](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/AcuA_V1.txt.gz). Its quantity is **Standard Thermal Model mean effective spherical diameter**.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [reinmuthia validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

## Known problems

The archived record leaves its quality flag blank; no quality grade is invented. A convex reconstruction describes broad shape and cannot recover small craters or concavities.

The selected lower-id pole is one admissible published solution. The alternative remains unresolved; selection is not evidence that one pole is physically preferred.

- Diameter uncertainty: ±0.48 km. Published thermal-model uncertainty propagated from flux, absolute magnitude and slope parameter. Shape, spin/aspect and fixed thermophysical assumptions are not fully included.
- Additional limitation: Usui 2011 notes additional unquantified model effects and typically a few to approximately 10% rotation-related size uncertainty; this is not an object-specific interval.
- Selection: Direct AKARI measured thermal diameter is available; no diameter exists in current SBDB or the queried NEOWISE V2 rows. No assumed-albedo size is used.

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

The [original vertex/facet table](https://damit.cuni.cz/projects/damit/stored_files/open/2681/shape.txt) contains 1018 vertices and 2032 triangular facets. All current DAMIT matches for this number were inspected; none supplies a calibrated diameter. The selected file's numerical volume is 0.999999915652 source units cubed, consistent with the unit-volume normalization documented by DAMIT.

Source coordinates and face connectivity remain unchanged in the pinned input.

| Model | Ecliptic pole λ, β | Sidereal period |
| --- | --- | --- |
| 678 (selected) | 153°, 78° | 4.007347 h |
| [679](https://damit.cuni.cz/projects/damit/asteroid_models/view/679) | 356°, 68° | 4.007347 h |

</details>

<a id="physical-scale-and-uncertainty"></a>

<details>
<summary>Physical scale and uncertainty</summary>

Preparation uses the existing metre-per-source-unit parameter:

```text
V = Σ dot(a, cross(b, c)) / 6
D_source = cbrt(6 * V / π)
metresPerSourceUnit = 1000 * 24.38 / D_source
                    = 19650.1824719
referenceRadiusKm = 24.38 / 2 = 12.19
```

The signed volume above is independently computed from the original closed triangle mesh, not assumed to be exactly one. No density, mass or gravitational parameter is inferred from this normalization.

AKARI catalog ±0.48 km omits unquantified spin/aspect and thermal-model effects; Reinmuthia is elongated, so absolute scale remains approximate.

</details>

<a id="coordinates-spin-and-display-phase"></a>

<details>
<summary>Coordinates, spin and display phase</summary>

[Original spin.txt](https://damit.cuni.cz/projects/damit/generated_files/open/AsteroidModel/678/spin.txt) specifies the J2000 ecliptic pole λ = 153°, β = 78°, a sidereal period of 4.007347 hours, reference epoch JD 2445766, and reference angle φ₀ = 0°. The original DAMIT co-rotating Cartesian frame is preserved: +Z is its north pole and +X defines the model meridian. [DAMIT's frame and file documentation](https://damit.cuni.cz/pages/documentation) defines the body-to-ecliptic transform.

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

- [Hanuš et al. (2013) — Asteroids' physical models from combined dense and sparse photometry and scaling of the YORP effect by the observed obliquity distribution](https://damit.cuni.cz/projects/damit/references/view/148).
- [Usui et al. (2011), PASJ63,1117-1138, AcuA V1](https://doi.org/10.1093/pasj/63.5.1117) and its linked catalog field definitions.
- DAMIT website/model material: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), unless the original release explicitly states otherwise. Attribute the model authors and Astronomical Institute, Charles University, Josef Ďurech and Vojtěch Sidorin.
- JAXA states that the [AKARI asteroid catalog is freely usable](https://www.ir.isas.jaxa.jp/AKARI/results/20111013_AcuA/); retain Usui et al. and AKARI/JAXA attribution.

</details>
