# (60) Echo

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-and-physical-scale"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1695](https://damit.cuni.cz/projects/damit/asteroid_models/view/1695) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-08. The selected source is DAMIT model **1695**, version/record date **2016-01-12**, credited to Ďurech et al. (2016). The unchanged source table contains **1022 vertices and 2040 triangles**.

Usui et al. (2011), the original ISAS/JAXA AcuA v1.0 catalog, report an effective thermal diameter of **58.95 ± 1.24 km**, from 3 detections. Its modified Standard Thermal Model fits a nonrotating sphere. This package explicitly uses that diameter as an **approximate volume scale** for the separate convex DAMIT mesh; it is not a published calibration of this mesh’s physical volume.

The quoted ± value is the formal catalog error. The paper excludes additional shape, spin and thermal-model systematics, and describes rotational contributions of a few to about 10%, particularly with few detections. No invented total error bar is assigned.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [echo validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Known problems

<a id="source-choices-and-uncertainty"></a>

Ďurech et al. (2016) give the archived 25.2285 h sidereal period and the two poles used by DAMIT. The lower model id selects (91°, −25°); the alternate (272°, −17°) is not rejected. An empirical sparse-chord occultation estimate of 58 ± 6 km agrees broadly with the selected thermal scale.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release.

The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

Alternative archive models: Model 1696: pole (272°, -17°), period 25.2285 h.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape and physical scale</summary>

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 1.0000001812373185 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 47.513459974231594 km per source unit
metersPerUnit = 47513.459974231591
reference radius = Dpublished / 2 = 29.475 km
```

</details>

<a id="orientation"></a>

<details>
<summary>Orientation</summary>

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(91°, -25°)** and the sidereal period is **25.2285 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°.

</details>

<a id="source-survey-and-credits"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
