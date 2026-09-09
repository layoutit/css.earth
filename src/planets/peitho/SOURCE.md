# (118) Peitho: source and interpretation

Checked 2026-09-09. Selected DAMIT model **4397**, version **2020-04-26**. DAMIT, Astronomical Institute of Charles University; DAMIT archive (no linked publication in this model record); model 4397, version 2020-04-26.

## Shape, scale and orientation

Convex light-curve reconstruction with approximate thermal size: 43.99 km effective diameter (catalog ±0.75 km; additional shape and thermal-model uncertainty). Thermal size is used as a volume-scale approximation. The pole follows the archive’s occultation match. The grid marks unavailable imagery; rotational phase is illustrative.

The physical size is approximately calibrated by assigning the AKARI thermal effective diameter to the mesh volume-equivalent diameter. Neither source mesh nor spin is modified. Convex inversion supplies only broad outline; no resolved craters, concavities, reflectance or regolith texture can be inferred. Selected2020 archive update4397 states this pole agrees with occultation. It closely matches published ATLAS model4475/pole(176,59), but the update links no publication itself; it is credited to the archive. The prior opposite pole4474 remains listed as a comparison, not an equally supported orientation.

The unmodified source has 1009 vertices and 2014 triangles. Its signed tetrahedral volume is 0.99999983232471257 source units³; an independent triangle-centroid divergence sum gives 0.99999983232471257. The existing recipe applies one uniform scale of 35.45576501027756 km per source unit so its volume-equivalent diameter is 43.99 km. No unit-volume assumption is made. Radius above a 21.995 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (179°, 60°), with sidereal period 7.8064 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/4397) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/51247/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.

- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — included as an explicitly approximate thermal size transfer. Its fitted nonrotating-sphere diameter is 43.99 ± 0.75 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Ďurech et al. (2020), A&A 643, A59](https://arxiv.org/pdf/2010.01820) — retained primary publication; see the body-specific selection and calibration above.

Selected2020 archive update4397 states this pole agrees with occultation. It closely matches published ATLAS model4475/pole(176,59), but the update links no publication itself; it is credited to the archive. The prior opposite pole4474 remains listed as a comparison, not an equally supported orientation.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 4474, pole ['346', '34'], https://damit.cuni.cz/projects/damit/asteroid_models/view/4474; model 4475, pole ['176', '59'], https://damit.cuni.cz/projects/damit/asteroid_models/view/4475

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 439.9 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
