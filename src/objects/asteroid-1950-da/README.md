# 1950 DA

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

1950 DA is a near-Earth asteroid with a rounded, oblate radar shape and an equatorial ridge.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original 1950DA_RetrogradeModel.wf](https://echo.jpl.nasa.gov/asteroids/shapes/1950DA_RetrogradeModel.wf). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/29075_1950DA/busch.etal.2007.1950da.pdf): Busch et al. (2007), Icarus 190, 608–621; Arecibo, Goldstone and NASA/JPL radar astronomy. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 0.65 km sphere, from -0.13 to 0.18 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 1.296750 m and maximum 4.703741 m; display-to-source p95 1.323804 m and maximum 4.488058 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

[Source test definitions](../../../tests/objects/unit/asteroid-1950-da/source.test.mts).

## Known problems

This view uses the published 2007 retrograde reconstruction. The 2014 Yarkovsky analysis rules out the prograde alternative. About 30% of the retrograde model surface was unseen or seen at incidence angles above 75 degrees in the original observations, so that region depends on the model assumptions. No optical surface map is supplied.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="1950-da-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 510 vertices and 1016 triangles, Cartesian extents 1.449683 × 1.597741 × 1.197445 km, closed volume 1.145649542 km³ and volume-equivalent radius 0.649114124 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.65 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

The selected source pole is ecliptic J2000 (187.4°, -89.5°), with period 2.1216 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 11 m stopping threshold. Its error estimate is 10.565598 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

All 1016 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

</details>
