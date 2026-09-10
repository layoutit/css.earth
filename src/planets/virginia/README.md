# (50) Virginia

## Sources

<a id="shape-and-physical-scale"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 12738](https://damit.cuni.cz/projects/damit/asteroid_models/view/12738) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-08. The selected source is DAMIT model **12738**, version/record date **2024-04-09**, credited to Franco and Pilcher (2020). The unchanged source table contains **1022 vertices and 2040 triangles**.

Usui et al. (2011), the original ISAS/JAXA AcuA v1.0 catalog, report an effective thermal diameter of **84.37 ± 0.82 km**, from 14 detections. Its modified Standard Thermal Model fits a nonrotating sphere. This package explicitly uses that diameter as an **approximate volume scale** for the separate convex DAMIT mesh; it is not a published calibration of this mesh’s physical volume.

The quoted ± value is the formal catalog error. The paper excludes additional shape, spin and thermal-model systematics, and describes rotational contributions of a few to about 10%, particularly with few detections. No invented total error bar is assigned.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The [virginia validation record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/asteroids-size-calibration-validation.json) contains source, scale, atlas, installation and browser results for its recorded files and revision.

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Known problems

<a id="source-choices-and-uncertainty"></a>

Franco and Pilcher report two mirror poles with ±10° pole uncertainty and a period uncertainty of ±0.00005 h. The selected solution is (295°, 47°). The empirical occultation estimate of 73 ± 8 km and IRAS estimate around 100 km show why a small formal thermal error cannot establish total size accuracy.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release.

The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

Alternative archive models: Model 12739: pole (112°, 41°), period 14.3123 h.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape and physical scale</summary>

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 1.0000000995128715 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 68.001878324497454 km per source unit
metersPerUnit = 68001.878324497447
reference radius = Dpublished / 2 = 42.185 km
```

</details>

<a id="orientation"></a>

<details>
<summary>Orientation</summary>

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(295°, 47°)** and the sidereal period is **14.3123 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°.

</details>

<a id="source-survey-and-credits"></a>

<details>
<summary>Source survey and credits</summary>

- [DAMIT model record](https://damit.cuni.cz/projects/damit/asteroid_models/view/12738) — selected original mesh and spin metadata.
- [Original shape table](https://damit.cuni.cz/projects/damit/stored_files/open/129413/shape.txt) — counted XYZ vertices and one-based triangle indices.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — units, frame, spin definitions and archive license.
- [AcuA primary catalog](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) and [Usui et al. (2011)](https://arxiv.org/abs/1106.1948) — thermal diameter, field meanings and limitations.
- [Hanuš et al. (2018)](https://arxiv.org/abs/1803.06116) — survey of accepted shape-aware size fits; included for Dike, Ducrosa and Petrina.
- [Broughton’s occultation synthesis](https://www.asteroidoccultation.com/observations/Asteroid_Dimensions_from_Occultations.html) — independent empirical size comparison, not a scale fit to this mesh.
- [Franco & Pilcher (2020), Spin-Shape Model for 50 Virginia](https://ui.adsabs.harvard.edu/abs/2020MPBu...47..272F)

The [source manifest](source/manifest.json) records input bytes and the calibration record. Source preparation keeps the established native PolyCSS `u` raster triangles, meshoptimizer reduction and prepared atlas path.

</details>
