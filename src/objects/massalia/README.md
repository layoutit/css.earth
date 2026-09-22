# (20) Massalia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-and-physical-scale"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 16321](https://damit.cuni.cz/projects/damit/asteroid_models/view/16321) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-08. The selected source is DAMIT model **16321**, version/record date **2026-04-30 15:07:16**, credited to DAMIT archive update, April 2026; the record does not link a publication. The unchanged source table contains **1922 vertices and 3840 triangles**.

Alí-Lagoa et al. (2020), Table 2, fit Herschel/PACS measurements to a SAGE model and report a volume-equivalent diameter of **147 ± 2 km**. This package transfers that size uniformly to the different convex DAMIT 16321 mesh.

The transfer is an **approximation**: ±2 km is the uncertainty of the published SAGE fit, not a complete uncertainty on this mesh. Additional model-transfer error has not been quantified.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [massalia validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Known problems

<a id="source-choices-and-uncertainty"></a>

The older DAMIT 118 and 119 records explicitly describe a preliminary, imperfect solution. Podlewska-Gaca et al. (2020) explain its spin-period and pole mismatch. The current archive update uses the corrected 8.0975859 h period and is selected here without inventing a publication attribution.

The SAGE release linked by the primary paper was sought at ISAM, but the endpoint was unavailable during this intake; the exact SAGE mesh remains unresolved. The prior AKARI diameter (131.56 ± 1.16 km) and the poor occultation constraints were considered and not substituted for the stronger later thermophysical size.

The source mesh volume is **35.13365487698239 source units³**, not one unit³.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release.

The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

Alternative archive models: Model 118: pole (179°, 39°), period 8.09902 h. Model 119: pole (360°, 40°), period 8.09902 h.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape and physical scale</summary>

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 35.133654876982391 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 36.175046544127831 km per source unit
metersPerUnit = 36175.046544127828
reference radius = Dpublished / 2 = 73.5 km
```

</details>

<a id="orientation"></a>

<details>
<summary>Orientation</summary>

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(304.1°, 63.7°)** and the sidereal period is **8.09759 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°.

</details>

<a id="source-survey-and-credits"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.
