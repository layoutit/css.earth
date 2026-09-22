# Castalia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Castalia is a two-lobed near-Earth asteroid reconstructed from the 1989 Arecibo radar observations.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original castalia.obj](https://echo.jpl.nasa.gov/asteroids/shapes/castalia.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/hudson%2B1997_cas_lcurves_icarus.pdf): Hudson and Ostro (1994), Science 263, 940–943; Hudson, Ostro and Harris (1997), Icarus 130, 165–176; Arecibo and NASA/JPL. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 0.542238 km sphere, from -0.29 to 0.34 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 6.559007 m and maximum 13.083273 m; display-to-source p95 6.608185 m and maximum 13.018666 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

[Source test definitions](../../../tests/objects/unit/castalia/source.test.mts).

## Known problems

The 1997 optical analysis statistically prefers the northern spin solution used here: period 4.089 h and ecliptic pole (253°, 56°). The alternative southern solution, period 4.094 h and pole (242°, 7°), was not absolutely excluded. This is the archived JPL shape, not a newly fitted model.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="castalia-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 2048 vertices and 4092 triangles, Cartesian extents 1.625855 × 0.998148 × 0.843095 km, closed volume 0.667816841 km³ and volume-equivalent radius 0.542237546 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.542238 km. This radius is computed from the archived mesh volume; it is not a catalog diameter imposed on the vertices. The archived PDS counterpart and its label independently document the mesh units, center of mass and principal axes. The 1997 study identifies the original northern versions and supplies the preferred spin interpretation.

**Frame and appearance**

The selected source pole is ecliptic J2000 (253°, 56°), with period 4.089 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 11 m stopping threshold. Its error estimate is 10.723386 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

All 4092 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

</details>
