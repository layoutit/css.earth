# (56) Melete: source and interpretation

Checked 2026-09-09. Selected DAMIT model **1851**, version **2017-09-21**. DAMIT, Astronomical Institute of Charles University; Viikinkoski et al. (2017); model 1851, version 2017-09-21.

## Shape, scale and orientation

Nonconvex model constrained by resolved imaging, 116 ± 5 km volume-equivalent diameter in the selected archive record. An alternative pole solution remains in the archive. Grid marks unavailable imagery; rotational phase is illustrative.

The original mesh is uniformly scaled to the selected archive record’s declared volume-equivalent diameter. Published ensemble estimates can differ from this archived solution. Original coordinates and connectivity are retained; no albedo, craters or regolith are inferred.

The unmodified source has 402 vertices and 800 triangles. Its signed tetrahedral volume is 824677.69028468616 source units³; an independent triangle-centroid divergence sum gives 824677.69028468616. The existing recipe applies one uniform scale of 0.99700219554996461 km per source unit so its volume-equivalent diameter is 116 km. No unit-volume assumption is made. Radius above a 58 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (103°, -28°), with sidereal period 18.1482 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/1851) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/4061/shape.txt) — included unchanged. Resolved-imaging-constrained nonconvex geometry; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [Viikinkoski et al. (2017)](https://damit.cuni.cz/projects/damit/references/view/171) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the selected archive model has a physical size calibration. Its fitted nonrotating-sphere diameter is 105.22 ± 1.16 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Hanuš et al. 2017](https://arxiv.org/abs/1702.01996), [Viikinkoski et al. 2017](https://arxiv.org/abs/1708.05191), and [Vernazza et al. 2021](https://damit.cuni.cz/projects/damit/references/view/660) — resolved-model releases surveyed; when present in this target’s archive they are preferred over an older convex model. Their disk images constrain geometry but are not registered global reflectance mosaics.
- [Hanuš et al. 2018](https://arxiv.org/abs/1803.06116) and [occultation dimensions](https://www.asteroidoccultation.com/observations/Asteroid_Dimensions_from_Occultations.html) — size comparison candidates; an independent fit or occultation ellipsoid is not silently equated with this mesh’s volume.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 1105, pole ['103', '-27'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1105; model 1106, pole ['282', '-5'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1106; model 1852, pole ['283', '-1'], https://damit.cuni.cz/projects/damit/asteroid_models/view/1852

## Preparation and qualification

The established source-meshoptimizer path starts from the source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 1160 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
