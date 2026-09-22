# 1998 WT24

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

1998 WT24 is a small near-Earth asteroid reconstructed from radar and optical observations.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original wt24.obj](https://echo.jpl.nasa.gov/asteroids/shapes/wt24.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/1998WT24/busch.etal.2008.1998wt24.pdf): Busch et al. (2008), Icarus 195, 614–621; Arecibo, Goldstone and NASA/JPL. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 0.2075 km sphere, from -0.08 to 0.06 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 1.669778 m and maximum 3.873296 m; display-to-source p95 1.669370 m and maximum 3.954152 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

[Source test definitions](../../../tests/objects/unit/asteroid-1998-wt24/source.test.mts).

## Known problems

The published model has uneven latitude coverage, including an unseen region near the north pole. Its small depressions and rounded outline are radar-derived geometry; no measured optical surface texture is supplied.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="1998-wt24-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 4000 vertices and 7996 triangles, Cartesian extents 0.470798 × 0.425616 × 0.404051 km, closed volume 0.037509350 km³ and volume-equivalent radius 0.207658785 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.2075 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

The selected source pole is ecliptic J2000 (15°, -22°), with period 3.697 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 4 m stopping threshold. Its error estimate is 3.616501 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

All 7996 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

</details>
