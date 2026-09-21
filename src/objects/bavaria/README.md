# (301) Bavaria

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 3090](https://damit.cuni.cz/projects/damit/asteroid_models/view/3090) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **3090**, version **2019-06-24**. DAMIT, Astronomical Institute of Charles University; Marciniak et al. (2019); model 3090, version 2019-06-24.

Convex light-curve reconstruction with archive equivalent-volume size 55 km (published thermal-size 3-sigma interval 53–57 km). The vertical shape is poorly constrained. Both pole solutions remain possible. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [bavaria results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **238.40 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Marciniak 2019 §4.4 fits 36 thermal measurements from IRAS, AKARI and WISE. Both mirror poles fit; the selected second pole, AM 2 at (226°, +70°), is representative, not unique. High pole latitude makes the vertical extent poorly constrained.

The archived physical mesh has equivalent-volume diameter 55 km and Table 2 reports thermal size 55±2 km at 3σ. The paper calls D a shape scaling value without an explicit volume definition, so the archive volume and paper thermal uncertainty are distinguished.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 3091, pole ['46', '61'], [Model 3091](https://damit.cuni.cz/projects/damit/asteroid_models/view/3091)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1010 vertices and 2016 triangles. Its signed tetrahedral volume is 87113.746610160262 source units³; an independent triangle-centroid divergence sum gives 87113.746610160248. The existing recipe applies one uniform scale of 0.99999999877557311 km per source unit so its volume-equivalent diameter is 55 km.

No unit-volume assumption is made. Radius above a 27.5 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (226°, 70°), with sidereal period 12.2409 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 550 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
