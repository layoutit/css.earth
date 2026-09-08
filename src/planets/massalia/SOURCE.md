# (20) Massalia: source and interpretation

Checked 2026-09-08. The selected source is DAMIT model **16321**, version/record date **2026-04-30 15:07:16**, credited to DAMIT archive update, April 2026; the record does not link a publication. The unchanged source table contains **1922 vertices and 3840 triangles**.

## Shape and physical scale

Alí-Lagoa et al. (2020), Table 2, fit Herschel/PACS measurements to a SAGE model and report a volume-equivalent diameter of **147 ± 2 km**. This package transfers that size uniformly to the different convex DAMIT 16321 mesh. The transfer is an **approximation**: ±2 km is the uncertainty of the published SAGE fit, not a complete uncertainty on this mesh. Additional model-transfer error has not been quantified.

The original mesh bytes are retained. The existing preparation recipe applies one uniform scale through `grid.metersPerUnit`; it does not alter the source topology, axes, pole or relative vertex positions. The scale is computed from the actual signed tetrahedral mesh volume, rather than assuming every uncalibrated DAMIT file has unit volume:

```text
Vsource = 35.133654876982391 source units³
Deq(source) = 2 × (3 × abs(Vsource) / (4 × π))^(1/3)
scale = Dpublished / Deq(source) = 36.175046544127831 km per source unit
metersPerUnit = 36175.046544127828
reference radius = Dpublished / 2 = 73.5 km
```

An independent sum using triangle normals reproduces the intake volume and calibrated diameter. All source edges have two opposite incidents, the Euler characteristic is two, and no source triangle has zero area. These intake checks establish file and scale consistency; they are not visual or runtime qualification.

## Source choices and uncertainty

The older DAMIT 118 and 119 records explicitly describe a preliminary, imperfect solution. Podlewska-Gaca et al. (2020) explain its spin-period and pole mismatch. The current archive update uses the corrected 8.0975859 h period and is selected here without inventing a publication attribution. The SAGE release linked by the primary paper was sought at ISAM, but the endpoint was unavailable during this intake; the exact SAGE mesh remains unresolved. The prior AKARI diameter (131.56 ± 1.16 km) and the poor occultation constraints were considered and not substituted for the stronger later thermophysical size. The source mesh volume is **35.13365487698239 source units³**, not one unit³.

The selected release supplies a shape model and spin metadata, not a registered optical reflectance texture. Thermal diameters are disk-integrated quantities and cannot supply a thermal or regolith map. No registered image product was identified in the selected release. The shared grid therefore marks unavailable imagery. A shape-derived Elevation view means radius above the stated reference sphere; it is not independent topography, gravitational height or resolved cratering.

## Orientation

The original co-rotating Cartesian frame is kept: positive Z is the rotation axis, and positive X defines the source reference meridian. The pole is ecliptic J2000 **(304.1°, 63.7°)** and the sidereal period is **8.09759 h**. The existing shared recipe converts that pole to equatorial J2000 with obliquity 23.439291111°. Absolute rotational phase is intentionally arbitrary; no present-day absolute attitude or source-epoch phase is claimed.

Alternative archive models: Model 118: pole (179°, 39°), period 8.09902 h. Model 119: pole (360°, 40°), period 8.09902 h.

The alternative solutions are recorded, not blended. Selecting one shape for a single body scene does not reject another mirror pole. Optional directional lighting uses the retained model frame and illustrative phase; Shadows are off by default.

## Source survey and credits

- [DAMIT model record](https://damit.cuni.cz/projects/damit/asteroid_models/view/16321) — selected original mesh and spin metadata.
- [Original shape table](https://damit.cuni.cz/projects/damit/stored_files/open/130623/shape.txt) — counted XYZ vertices and one-based triangle indices.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — units, frame, spin definitions and archive license.
- [AcuA primary catalog](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) and [Usui et al. (2011)](https://arxiv.org/abs/1106.1948) — thermal diameter, field meanings and limitations.
- [Hanuš et al. (2018)](https://arxiv.org/abs/1803.06116) — survey of accepted shape-aware size fits; included for Dike, Ducrosa and Petrina.
- [Broughton’s occultation synthesis](https://www.asteroidoccultation.com/observations/Asteroid_Dimensions_from_Occultations.html) — independent empirical size comparison, not a scale fit to this mesh.
- [Alí-Lagoa et al. (2020)](https://arxiv.org/abs/2005.01479) — selected 147 ± 2 km SAGE-based thermophysical diameter.
- [Podlewska-Gaca et al. (2020)](https://arxiv.org/abs/2001.07030) — revised spin and SAGE shape; imperfect old spin and occultation constraints.
- [ISAM](http://isam.astro.amu.edu.pl/) — original SAGE release sought but unavailable during intake.

The source manifest must pin the exact input bytes and authored calibration record. Source preparation keeps the established native PolyCSS `u` raster triangles, meshoptimizer reduction and prepared atlas path. No new rendering or surface-reconstruction method is introduced. Browser, source-fit, fresh-install and performance measurements are recorded separately after integration.
