# (482) Petrina

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-and-physical-scale"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1152](https://damit.cuni.cz/projects/damit/asteroid_models/view/1152) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-08. The selected source is DAMIT model **1152**, version/record date **2016-01-04**, credited to Hanuš et al. (2016). The unchanged source table contains **1022 vertices and 2040 triangles**.

Hanuš, Delbo, Ďurech and Alí-Lagoa (2018), Table A.3, report a **volume-equivalent diameter of 44.2 ± 1 km** from varied-shape thermophysical modelling of WISE observations. The reported spread accounts for variations in the optical shape and spin solution.

The physical scale is transferred to the nominal archived model from the same published shape/pole family; this does not claim that the nominal mesh is identical to every thermophysical realization.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [petrina validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Known problems

<a id="source-choices-and-uncertainty"></a>

The nominal model 1152 has pole (281°, 61°); the thermophysical table gives (280°, 61°). The one-degree difference is disclosed and the original pole retained. Both give 11.79214 h. The alternative mirror model 1153 has a separate fit (44.2 ± 0.6 km); this package uses the model-1152-family result, 44.2 ± 1.0 km.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release.

The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

Alternative archive models: Model 1153: pole (94°, 24°), period 11.7921 h.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape and physical scale</summary>

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 0.99999998880303431 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 35.625022316728035 km per source unit
metersPerUnit = 35625.022316728035
reference radius = Dpublished / 2 = 22.1 km
```

</details>

<a id="orientation"></a>

<details>
<summary>Orientation</summary>

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(281°, 61°)** and the sidereal period is **11.7921 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°.

</details>

<a id="source-survey-and-credits"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
