# (9694) Lycomedes: source and interpretation

Checked 2026-09-09. L4 Jupiter Trojan. Selected DAMIT model **4284**, version **2019-05-07**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2019); model 4284, version 2019-05-07.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 31.736 km effective diameter (fit ±0.243 km; additional shape and thermal-model uncertainty). An alternative pole solution remains in the archive. Thermal size is used as a volume-scale approximation; grid marks unavailable imagery.

Disk-integrated NEOWISE thermal flux constrains an effective spherical diameter, not this mesh volume or a surface map. Transferring that diameter uniformly to mesh volume is approximate. The quoted fit error is not a total uncertainty and does not measure local shape accuracy. Absolute rotational phase is illustrative.

The unmodified source has 570 vertices and 1136 triangles. Its signed tetrahedral volume is 0.99999985295702809 source units³; independent triangle-centroid divergence gives 0.99999985295702809. The existing recipe applies a uniform scale of 25.579089580075184 km per source unit. No unit-volume assumption is made. Radial Elevation is source radius minus the declared 15.868 km reference sphere, in false color; it is neither gravitational height nor independent topography.

Original +Z spin axis and +X reference meridian are retained. The selected ecliptic J2000 pole is (133°, 54°), with sidereal period 18.1094 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary and accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/4284) and [original mesh](https://damit.cuni.cz/projects/damit/stored_files/open/13366/shape.txt) — included without modifying original coordinates/connectivity. Convex light-curve inversion; concavities and fine relief are unresolved.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — coordinate units, pole, sidereal period and CC BY 4.0 terms.
- [Ďurech et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/182) — original model publication record.
- [NEOWISE v2 definitions](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html) and [Grav et al. (2012)](https://arxiv.org/abs/1209.1549) — selected original Gr12b catalog row has a fitted diameter (`D` in FIT_CODE); these are thermal properties, not resolved imagery. Formal fit error does not capture all thermal/shape systematics. CSV row, original query and definitions are pinned.
- [Hanuš et al. (2023), Table B.3](https://arxiv.org/abs/2308.05380) — adopts this existing DAMIT shape/spin solution. No replacement mesh is required by that survey.

No registered global reflectance mosaic was found in the selected model or thermal releases. Disk-integrated colors do not constrain a regolith map; the shared grid marks unavailable image coverage. Alternative archive solutions: model 4285, pole ['323', '53'], https://damit.cuni.cz/projects/damit/asteroid_models/view/4285

## Preparation

The existing source-meshoptimizer path retains source connectivity and reduces to at most 800 native PolyCSS `u` raster triangles, with 128 px raster cells. Error allowance is 317.36 m. Sampled source-fit error is qualified separately from source accuracy. Shadows and asteroid orbit visibility are off by default. Camera, navigation and shell use the generic contract. PR evidence records source comparison, runtime checks and delivery.
