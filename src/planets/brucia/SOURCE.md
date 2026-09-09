# (323) Brucia: source and interpretation

Checked 2026-09-08. The selected source is DAMIT model **10666**, version/record date **2022-11-29**, credited to Ďurech and Hanuš (2023). The unchanged source table contains **574 vertices and 1144 triangles**.

## Shape and physical scale

Usui et al. (2011), the original ISAS/JAXA AcuA v1.0 catalog, report an effective thermal diameter of **37.29 ± 0.76 km**, from 6 detections. Its modified Standard Thermal Model fits a nonrotating sphere. This package explicitly uses that diameter as an **approximate volume scale** for the separate convex DAMIT mesh; it is not a published calibration of this mesh’s physical volume. The quoted ± value is the formal catalog error. The paper excludes additional shape, spin and thermal-model systematics, and describes rotational contributions of a few to about 10%, particularly with few detections. No invented total error bar is assigned.

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 0.99999972595210018 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 30.055592728194679 km per source unit
metersPerUnit = 30055.592728194679
reference radius = Dpublished / 2 = 18.645 km
```

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Source choices and uncertainty

This Gaia DR3 inversion is a low-resolution convex reconstruction from sparse photometry. Its published period and pole are retained, but the apparent detail of a prepared display must not be read as resolved terrain. AKARI supplies six thermal detections for the approximate scale.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release. The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

## Orientation

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(64°, -13°)** and the sidereal period is **9.4596 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°. Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

Alternative archive models: The selected model record does not supply another mirror model in this intake.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

## Source survey and credits

- [DAMIT model record](https://damit.cuni.cz/projects/damit/asteroid_models/view/10666) — selected original mesh and spin metadata.
- [Original shape table](https://damit.cuni.cz/projects/damit/stored_files/open/94365/shape.txt) — counted XYZ vertices and one-based triangle indices.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — units, frame, spin definitions and archive license.
- [AcuA primary catalog](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) and [Usui et al. (2011)](https://arxiv.org/abs/1106.1948) — thermal diameter, field meanings and limitations.
- [Hanuš et al. (2018)](https://arxiv.org/abs/1803.06116) — survey of accepted shape-aware size fits; included for Dike, Ducrosa and Petrina.
- [Ďurech and Hanuš (2023) ](https://damit.cuni.cz/projects/damit/references/view/665)

The source manifest must pin the exact input bytes and authored calibration record. Source preparation keeps the established native PolyCSS `u` raster triangles, meshoptimizer reduction and prepared atlas path. No new rendering or surface-reconstruction method is introduced. Browser, source-fit, fresh-install and performance measurements are recorded separately after integration.
