# Betulia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Betulia is a near-Earth asteroid reconstructed from Arecibo radar and optical light curves.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original betulia.obj](https://echo.jpl.nasa.gov/asteroids/shapes/betulia.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/1580_Betulia/magri.etal.2007.betulia.pdf): Magri et al. (2007), Icarus 186, 152–177; Arecibo and NASA/JPL radar astronomy. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 2.695 km sphere, from -0.67 to 0.89 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 15.812102 m and maximum 45.629614 m; display-to-source p95 15.719719 m and maximum 46.250738 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/betulia/source.test.mts).

## Known problems

The southern depression and overall irregular form are resolved unevenly. Fine surface material and photographic reflectance are not supplied by this model.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="betulia-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 1148 vertices and 2292 triangles, Cartesian extents 6.587920 × 5.847660 × 4.189877 km, closed volume 81.982480317 km³ and volume-equivalent radius 2.694909268 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 2.695 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

The selected source pole is ecliptic J2000 (136°, 22°), with period 6.13836 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 46 m stopping threshold. Its error estimate is 45.252815 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

All 2292 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

</details>
