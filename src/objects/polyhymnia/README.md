# (33) Polyhymnia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-and-physical-scale"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 5163](https://damit.cuni.cz/projects/damit/asteroid_models/view/5163) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-08. The selected source is DAMIT model **5163**, version/record date **2024-04-08**, credited to Franco, Pilcher, Ferrero and Maurice (2020). The unchanged source table contains **1022 vertices and 2040 triangles**.

Usui et al. (2011), the original ISAS/JAXA AcuA v1.0 catalog, report an effective thermal diameter of **53.98 ± 0.91 km**, from 6 detections. Its modified Standard Thermal Model fits a nonrotating sphere. This package explicitly uses that diameter as an **approximate volume scale** for the separate convex DAMIT mesh; it is not a published calibration of this mesh’s physical volume.

The quoted ± value is the formal catalog error. The paper excludes additional shape, spin and thermal-model systematics, and describes rotational contributions of a few to about 10%, particularly with few detections. No invented total error bar is assigned.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [polyhymnia validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Known problems

<a id="source-choices-and-uncertainty"></a>

Franco et al. report two mirror poles, with ±15° pole uncertainty and a period uncertainty of ±0.00029 h. The selected model is the (185°, −61°) solution. A multi-event occultation estimate of 64 ± 6 km differs from the AKARI effective diameter; its three sparse events do not fit the selected 3D shape, so the estimates are not averaged.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release.

The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

Alternative archive models: Model 5164: pole (19°, -65°), period 18.6089 h.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape and physical scale</summary>

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 0.99999996784675738 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 43.507663305208673 km per source unit
metersPerUnit = 43507.663305208676
reference radius = Dpublished / 2 = 26.99 km
```

</details>

<a id="orientation"></a>

<details>
<summary>Orientation</summary>

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(185°, -61°)** and the sidereal period is **18.6089 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°.

</details>

<a id="source-survey-and-credits"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
