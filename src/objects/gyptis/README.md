# (444) Gyptis

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-and-physical-scale"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5394](https://damit.cuni.cz/projects/damit/asteroid_models/view/5394) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-08. The selected source is DAMIT model **5394**, version/record date **2019-10-23**, credited to Ďurech et al. (2020). The unchanged source table contains **548 vertices and 1092 triangles**.

Usui et al. (2011), the original ISAS/JAXA AcuA v1.0 catalog, report an effective thermal diameter of **166.03 ± 6.66 km**, from 1 detection. Its modified Standard Thermal Model fits a nonrotating sphere. This package explicitly uses that diameter as an **approximate volume scale** for the separate convex DAMIT mesh; it is not a published calibration of this mesh’s physical volume.

The quoted ± value is the formal catalog error. The paper excludes additional shape, spin and thermal-model systematics, and describes rotational contributions of a few to about 10%, particularly with few detections. No invented total error bar is assigned.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [gyptis validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Known problems

<a id="source-choices-and-uncertainty"></a>

AKARI supplies only one detection for Gyptis, so its formal ±6.66 km error is not the total scale error. Magri et al. (2007), using radar and other available constraints, tabulate a 163 ± 27 km effective diameter and adopted axes 189 × 164 × 137 km with 14% uncertainty.

This supports a broad roughly 160 km scale, but does not calibrate the later ATLAS convex mesh. Neither those axes nor the observed occultation silhouette is substituted for the source mesh.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release.

The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

Alternative archive models: Model 5395: pole (234°, 38°), period 6.21513 h.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape and physical scale</summary>

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 1.0000000605846517 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 133.81950936020783 km per source unit
metersPerUnit = 133819.50936020783
reference radius = Dpublished / 2 = 83.015 km
```

</details>

<a id="orientation"></a>

<details>
<summary>Orientation</summary>

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(58°, 15°)** and the sidereal period is **6.21516 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°.

</details>

<a id="source-survey-and-credits"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
