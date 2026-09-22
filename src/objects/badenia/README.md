# (333) Badenia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-and-physical-scale"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 3298](https://damit.cuni.cz/projects/damit/asteroid_models/view/3298) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-08. The selected source is DAMIT model **3298**, version/record date **2019-05-07**, credited to Ďurech et al. (2019). The unchanged source table contains **572 vertices and 1140 triangles**.

Usui et al. (2011), the original ISAS/JAXA AcuA v1.0 catalog, report an effective thermal diameter of **69.73 ± 2.8 km**, from 2 detections. Its modified Standard Thermal Model fits a nonrotating sphere. This package explicitly uses that diameter as an **approximate volume scale** for the separate convex DAMIT mesh; it is not a published calibration of this mesh’s physical volume.

The quoted ± value is the formal catalog error. The paper excludes additional shape, spin and thermal-model systematics, and describes rotational contributions of a few to about 10%, particularly with few detections. No invented total error bar is assigned.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [badenia validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Known problems

<a id="source-choices-and-uncertainty"></a>

This Gaia DR2 plus Lowell inversion is a low-resolution convex reconstruction. AKARI supplies only two detections; rotational phase and shape effects can therefore exceed the formal catalog error. No exact physical volume is claimed.

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
Vsource = 1.0000000019572799 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 56.20209944011647 km per source unit
metersPerUnit = 56202.099440116472
reference radius = Dpublished / 2 = 34.865 km
```

</details>

<a id="orientation"></a>

<details>
<summary>Orientation</summary>

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(5°, -54°)** and the sidereal period is **9.86107 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°.

</details>

<a id="source-survey-and-credits"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
