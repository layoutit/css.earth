# Mithra

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Mithra is a strongly bifurcated near-Earth asteroid reconstructed from Arecibo and Goldstone radar observations in 2000.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original Mithra.v1.PA.prograde.mod.obj](https://echo.jpl.nasa.gov/asteroids/shapes/Mithra.v1.PA.prograde.mod.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/4486_Mithra/brozovic.etal.2010.mithra.pdf): Brozović et al. (2010), Icarus 208, 207–220; Arecibo, Goldstone and NASA/JPL radar astronomy. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 0.845 km sphere, from -0.51 to 0.55 km. The scalar is evaluated at the closest source triangle point, not the first center-ray intersection. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 11.469335 m and maximum 25.485827 m; display-to-source p95 11.392943 m and maximum 25.525712 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

The recorded source-scalar and decoded-atlas checks are detailed below; their sampled results do not establish browser pixel parity.

[Source test definitions](../../../tests/objects/unit/mithra/source.test.mts).

## Known problems

This is the archived prograde principal-axis model. The source research also permits a nearly mirrored retrograde solution; the pole and rotational sense are not unique. Near-pole-on observations constrain its unobserved southern shape less strongly. The period is 67.5 ± 6.0 h; a small non-principal-axis component was not excluded. No resolved optical surface map is supplied.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

The final Elevation atlas withholds 5,821 of 5,778,790 triangle-interior texels (0.1007%) to the shared grid. The scientific value is not extrapolated beyond the source-distance allowance. Atlas bleed is counted separately in prepared/surfaces.json.

The paper’s alternate retrograde model is excluded as a duplicate interpretation of the same radar data, with the source ambiguity retained. Less than half the surface was radar-constrained; the unseen hemisphere uses model regularization and should not be read as observed terrain. The nominal 1.69 ± 0.05 km equivalent diameter gives the reference radius and its ±0.025 km uncertainty; coordinates retain their original scale.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="mithra-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>
<a id="source-survey-and-independent-anchors"></a>
<a id="prepared-scalar-and-texture-checks"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 3000 vertices and 5996 triangles, Cartesian extents 2.353623 × 1.650912 × 1.436305 km, closed volume 2.532696640 km³ and volume-equivalent radius 0.845599768 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.845 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

The selected source pole is ecliptic J2000 (337°, 19°), with period 67.5 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 21 m stopping threshold. Its error estimate is 20.031322 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

**Source survey and independent anchors**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Prepared scalar and texture checks**

All 5996 source face centroids and 8,192 sphere directions were checked: 5 centroids disagree with the first radial hit and 1 direction has a further surface hit. Elevation therefore uses the existing closest-source-point transfer on full source triangles, bounded to 21 m, and withholds ambiguous or out-of-range samples. The flat longitude/latitude preview also withholds multi-surface rays. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

The existing independent NumPy plane/edge verifier examined every original triangle for 811 queries: all 800 retained-face centroids, six source axis extremes and all five source centroids with multiple radial surfaces. 1 query exceeds the authored transfer cap and is correctly withheld; this is a scientific-map coverage limit, not missing display geometry. Selected exact coordinates, independent source points and scalar values are pinned in source/reference/scalar-anchors.json and checked by the body source tests. Full results remain in output/asteroids-radar-six/mithra-nereus/mithra/scalar-independent.json.

Independent full-source projection and authored palette/relief calculations match 14 decoded interior anchor colors in both flood and directional WebP atlases, with maximum channel difference 8/255 at quality 90. 28 retained pixel positions, including clamped bleed, match independent source points and scalar values. Source-edge normals are not unique, and WebP chroma filtering can mix neighboring atlas cells at raster boundaries; these checks do not establish boundary color fidelity. Full coordinates, decoded colors and atlas hashes are retained in output/asteroids-radar-six/mithra-nereus/mithra/atlas-anchors.json.

</details>
