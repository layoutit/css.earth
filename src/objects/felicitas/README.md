# (109) Felicitas

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 3097](https://damit.cuni.cz/projects/damit/asteroid_models/view/3097) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **3097**, version **2019-06-24**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2019); model 3097, version 2019-06-24.

Convex light-curve reconstruction with the thermally preferred pole. The selected archive mesh has an 85 km equivalent-volume size; the paper reports a thermal-size 3-sigma interval of 80–92 km. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [felicitas results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **326.70 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Marciniak 2019 section 4.2 and TableB.2 prefer AM1 (77,-26), matching model3097: reduced chi-square 1.1 versus 2.0 for AM2/model3096. The latter is a bad thermal fit. The published diameter is 85 km with asymmetric 3-sigma interval 80–92 km; DAMIT rounds its equivalent-diameter error to 6 km.

WISE W3/W4 residual offsets remain and roughness is unconstrained.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 3096, pole ['252', '-49'], [Model 3096](https://damit.cuni.cz/projects/damit/asteroid_models/view/3096)

Marciniak 2019 section 4 calls D a scaling value for the published spin/shape solution and points to DAMIT for its release, but does not explicitly define volume-equivalent D. Equivalent-volume semantics here describe the selected DAMIT mesh and its declared size; they are not quoted as a separate physical-volume definition from that paper.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 988 vertices and 1972 triangles. Its signed tetrahedral volume is 321555.12813677243 source units³; an independent triangle-centroid divergence sum gives 321555.12813677243. The existing recipe applies one uniform scale of 0.99999996882601128 km per source unit so its volume-equivalent diameter is 85 km.

No unit-volume assumption is made. Radius above a 42.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (77°, -26°), with sidereal period 13.1905 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 850 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
