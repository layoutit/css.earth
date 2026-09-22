# (125) Liberatrix

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 157](https://damit.cuni.cz/projects/damit/asteroid_models/view/157) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

Checked 2026-09-09. Selected DAMIT model **157**, version **2007-02-27**. DAMIT, Astronomical Institute of Charles University; J. Ďurech (2007); model 157, version 2007-02-27.

Convex light-curve reconstruction with a thermophysical volume scale of 51.1 ± 2.1 km (reported model-ensemble range). An alternative pole remains possible. Neutral gray marks unavailable imagery; rotational phase is illustrative.

## Evidence

The [liberatrix results](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/evidence/main-belt-asteroids-expansion/summary.json) record a maximum sampled source-to-display distance of **285.81 m**. This is a sampled comparison, not an exhaustive error bound.

The 2 browser cases predate final integration. The report compares their recorded body assets with the integrated files; it does not identify a tested code revision for these cases.

## Known problems

Ďurech 2007 is the actual published collaboration-network shape source. Hanuš 2018 TableA.3 uses its pole(95,68), period 3.96820 h, QF3 and VS-TPM volume-equivalent diameter 51.1±2.1 km. Only this uniform size transfer is applied to nominal DAMIT157. The alternative pole(280,74) has its own 50.1±1.3 km fit and remains possible; the varied-model ensemble does not establish byte-identical local terrain.

Empirical VS-TPM interval formed from the smallest range of 14 best-fit varied-shape solutions out of 20 (approximately 68% of models), as defined in Hanuš 2018 section 3. It is not an independent Gaussian confidence interval or a local surface accuracy bound.

Absolute phase is arbitrary; accelerated display spin is illustrative.

The release supplies no registered surface imagery; neutral gray marks that gap. Alternative archive solutions: model 158, pole ['280', '74'], [Model 158](https://damit.cuni.cz/projects/damit/asteroid_models/view/158)

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · Provenance (`prepared/provenance.json`) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Shape, scale and orientation</summary>

The unmodified source has 1598 vertices and 3192 triangles. Its signed tetrahedral volume is 0.99999989847966386 source units³; an independent triangle-centroid divergence sum gives 0.99999989847966386. The existing recipe applies one uniform scale of 41.186395818873095 km per source unit so its volume-equivalent diameter is 51.1 km.

No unit-volume assumption is made. Radius above a 25.55 km sphere is a shape-derived scalar, not gravitational height or measured geology.

The original +Z spin axis and +X reference meridian are retained. The source pole is ecliptic J2000 (95°, 68°), with sidereal period 3.9682 h. Conversion to equatorial J2000 uses obliquity 23.439291111°. Position uses JPL Horizons heliocentric ICRF elements at 2026-09-03 TT (TDB approximated as TT, under 2 ms).

</details>

<a id="source-survey"></a>

The [investigation ledger](investigations.json) records the source survey and alternative models.

<a id="preparation-and-qualification"></a>

<details>
<summary>Preparation and qualification</summary>

The established source-meshoptimizer path retains source connectivity, reduces to at most 800 faces, and emits native PolyCSS `u` triangles with 128 px raster cells. The error allowance is 511 m; sampled source-fit error is qualified separately from source accuracy.

Elevation uses closest-source-surface sampling with the same physical scale. Shadows are off by default.

</details>
