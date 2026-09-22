# (99) Dike

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-and-physical-scale"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1144](https://damit.cuni.cz/projects/damit/asteroid_models/view/1144) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-08. The selected source is DAMIT model **1144**, version/record date **2016-01-04**, credited to Hanuš et al. (2016). The unchanged source table contains **1022 vertices and 2040 triangles**.

Hanuš, Delbo, Ďurech and Alí-Lagoa (2018), Table A.3, report a **volume-equivalent diameter of 66.5 ± 0.9 km** from varied-shape thermophysical modelling of WISE observations. The reported spread accounts for variations in the optical shape and spin solution.

The physical scale is transferred to the nominal archived model from the same published shape/pole family; this does not claim that the nominal mesh is identical to every thermophysical realization.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [dike validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Known problems

<a id="source-choices-and-uncertainty"></a>

The nominal DAMIT pole is (233°, 50°), while the varied-shape table lists (233°, 49°). The one-degree difference is disclosed rather than changing the original pole. The published period 18.1191 h agrees with the rounded archived period.

The spherical AKARI estimate 70.60 ± 0.99 km is not used for scale because the same-family shape-aware fit is available.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release.

The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

Alternative archive models: The selected model record does not supply another mirror model in this intake.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape and physical scale</summary>

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 1.0000000222552459 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 53.598732073429957 km per source unit
metersPerUnit = 53598.732073429957
reference radius = Dpublished / 2 = 33.25 km
```

</details>

<a id="orientation"></a>

<details>
<summary>Orientation</summary>

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(233°, 50°)** and the sidereal period is **18.1191 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°.

</details>

<a id="source-survey-and-credits"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
