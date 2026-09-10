# (1437) Diomedes: source and interpretation

Checked 2026-09-09. L4 Jupiter Trojan. Selected DAMIT model **4215**, version **2019-05-07**. DAMIT, Astronomical Institute of Charles University; Ďurech et al. (2019); model 4215, version 2019-05-07.

## Shape, scale and orientation

Convex light-curve model fitted to a stellar occultation: 118.8 ± 0.6 km volume-equivalent diameter. Grid marks unavailable imagery; rotational phase is illustrative.

The published occultation fit uses this same 574-vertex, 1144-facet dimensionless model, refining its uniform size, pole and period. Three observed chords constrain the silhouette; this remains an inverse model, without resolved local terrain. No albedo, craters or regolith are inferred.

The unmodified source has 574 vertices and 1144 triangles. Its signed tetrahedral volume is 0.99999995101356143 source units³; independent triangle-centroid divergence gives 0.99999995101356143. The existing recipe applies a uniform scale of 95.752323632100087 km per source unit. No unit-volume assumption is made. Radial Elevation is source radius minus the declared 59.4 km reference sphere, in false color; it is neither gravitational height nor independent topography.

Original +Z spin axis and +X reference meridian are retained. The selected ecliptic J2000 pole is (153.73°, 12.69°), with sidereal period 24.4984 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary and accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/4215) and [original mesh](https://damit.cuni.cz/projects/damit/stored_files/open/13159/shape.txt) — included without modifying original coordinates/connectivity. Convex light-curve inversion; concavities and fine relief are unresolved.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — coordinate units, pole, sidereal period and CC BY 4.0 terms.
- [Ďurech et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/182) — original model publication record.
- [NEOWISE v2 definitions](https://irsa.ipac.caltech.edu/data/WISE/NEOWISE_SB/gator_docs/neowisesbprop_colDescriptions.html) and [Grav et al. (2012)](https://arxiv.org/abs/1209.1549) — selected original Gr12b catalog row has a fitted diameter (`D` in FIT_CODE); these are thermal properties, not resolved imagery. Formal fit error does not capture all thermal/shape systematics. CSV row, original query and definitions are pinned.
- [Dutra et al. (2025)](https://doi.org/10.1098/rsta.2024.0187) — included: this same mesh with refined size, pole and period. Original archive pole (150°, 5°) and period 24.4987 h remain recorded in damit-model.json; the published occultation fit drives the presentation. Hanuš et al. (2023) proposed a different shape/133 ± 5 km fit, whose numeric mesh is unresolved; the later same-mesh fit is used here.

No registered global reflectance mosaic was found in the selected model or thermal releases. Disk-integrated colors do not constrain a regolith map; the shared grid marks unavailable image coverage. Alternative archive solutions: None listed for this target.

## Preparation

The existing source-meshoptimizer path retains source connectivity and reduces to at most 800 native PolyCSS `u` raster triangles, with 128 px raster cells. Error allowance is 1188 m. Sampled source-fit error is qualified separately from source accuracy. Shadows and asteroid orbit visibility are off by default. Camera, navigation and shell use the generic contract. PR evidence records source comparison, runtime checks and delivery.
