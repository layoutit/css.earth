# (110) Lydia: source and interpretation

Checked 2026-09-09. Selected DAMIT model **152**, version **2009-02-26**. DAMIT, Astronomical Institute of Charles University; J. Ďurech (2007), M. Delbo and P. Tanga (2009); model 152, version 2009-02-26.

## Shape, scale and orientation

Convex light-curve reconstruction with the thermally preferred pole and a published 90–92 km diameter fit range. The archive mesh uses 91 km; another pole remains possible. The grid marks unavailable imagery; rotational phase is illustrative.

Delbo and Tanga2009 supplementary section on Lydia explicitly choose pole1 (149.3,-55), matching model152, because it fits slightly better (reduced chi-square0.7 versus0.76). The second pole remains possible. Its IRAS thermophysical diameter range is90–92 km versus94–97 km for pole2; the archive stores91±1 km.

The unmodified source has 1597 vertices and 3190 triangles. Its signed tetrahedral volume is 394568.75938298897 source units³; an independent triangle-centroid divergence sum gives 394568.75938298897. The existing recipe applies one uniform scale of 1.0000000790258456 km per source unit so its volume-equivalent diameter is 91 km. No unit-volume assumption is made. Radius above a 45.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (149°, -55°), with sidereal period 10.9258 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Absolute phase is arbitrary; accelerated display spin is illustrative. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

DAMIT represents the published 90–92 km thermophysical fit range as 91±1 km. This is a fit range, not an independently stated one-sigma Gaussian confidence interval or a local shape-accuracy bound.

## Source survey

- [Selected model](https://damit.cuni.cz/projects/damit/asteroid_models/view/152) and [original counted mesh](https://damit.cuni.cz/projects/damit/stored_files/open/361/shape.txt) — included unchanged. Convex light-curve reconstruction; fine relief is unresolved.
- [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation) — coordinate units, pole, period and diameter semantics. CC BY 4.0.
- [J. Ďurech (2007)](https://damit.cuni.cz/projects/damit/references/view/113) — original model publication record.
- [M. Delbo and P. Tanga (2009)](https://damit.cuni.cz/projects/damit/references/view/126) — original model publication record.
- [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/) — retained for comparison; the documented physical calibration supplies the selected scale. Its fitted nonrotating-sphere diameter is 82.97 ± 0.81 km. Formal catalog error omits additional shape, spin and thermal-model effects; no total confidence interval is invented.
- [Delbo and Tanga (2009), Planetary and Space Science 57, 259–265](https://arxiv.org/pdf/0808.0869) — retained primary publication; see the body-specific selection and calibration above.

Delbo and Tanga2009 supplementary section on Lydia explicitly choose pole1 (149.3,-55), matching model152, because it fits slightly better (reduced chi-square0.7 versus0.76). The second pole remains possible. Its IRAS thermophysical diameter range is90–92 km versus94–97 km for pole2; the archive stores91±1 km.

No registered global image texture is supplied by the selected release. Shape diagrams, disk-integrated thermal estimates and AO comparison images cannot provide a regolith or albedo map; the shared gray grid is used. Alternative archive solutions: model 153, pole ['331', '-61'], https://damit.cuni.cz/projects/damit/asteroid_models/view/153

## Preparation and qualification

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 910 m; sampled source-fit error is qualified separately from source accuracy. Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default. Shared runtime, camera, navigation and shell remain generic. Delivery and browser evidence are recorded in the PR’s validation report.
