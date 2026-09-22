# Nereus

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Nereus is an elongated near-Earth asteroid reconstructed from Arecibo and Goldstone radar observations around its 2002 encounter.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original Nereus_alt1.mod.wf](https://echo.jpl.nasa.gov/asteroids/shapes/Nereus_alt1.mod.wf). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/4660_Nereus/brozovic.etal.2009.nereus.pdf): Brozović et al. (2009), Icarus 201, 153–166; Arecibo, Goldstone and NASA/JPL radar astronomy. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 0.165 km sphere, from -0.05 to 0.1 km. The scalar is evaluated at the closest source triangle point, not the first center-ray intersection. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 0.990535 m and maximum 2.729109 m; display-to-source p95 0.995135 m and maximum 2.896178 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

The recorded source-scalar and decoded-atlas checks are detailed below; their sampled results do not establish browser pixel parity.

[Source test definitions](../../../tests/objects/unit/nereus/source.test.mts).

## Known problems

The archived filename contains alt1, but its measured 0.510 × 0.330 × 0.241 km extents identify the paper’s preferred smaller-volume model. Its polar dimension is weakly constrained; a thicker alternative fits comparably. The selected pole is within a 10° uncertainty radius and the period is 15.16 ± 0.04 h. No resolved optical surface map is supplied.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

The final Elevation atlas withholds 116 of 5,777,054 triangle-interior texels (0.0020%) to the shared grid. The scientific value is not extrapolated beyond the source-distance allowance. Atlas bleed is counted separately in prepared/surfaces.json.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="nereus-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>
<a id="source-survey-and-independent-anchors"></a>
<a id="prepared-scalar-and-texture-checks"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 1148 vertices and 2292 triangles, Cartesian extents 0.510205 × 0.330351 × 0.241219 km, closed volume 0.019401720 km³ and volume-equivalent radius 0.166692940 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.165 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

The selected source pole is ecliptic J2000 (25°, 80°), with period 15.16 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 3 m stopping threshold. Its error estimate is 2.815206 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

**Source survey and independent anchors**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Prepared scalar and texture checks**

All 2292 source face centroids and 8,192 sphere directions were checked: 0 centroids disagree with the first radial hit and 0 directions have a further surface hit. Elevation therefore uses the existing closest-source-point transfer on full source triangles, bounded to 3 m, and withholds ambiguous or out-of-range samples. The flat longitude/latitude preview also withholds multi-surface rays. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

The existing independent NumPy plane/edge verifier examined every original triangle for 806 queries: all 800 retained-face centroids, six source axis extremes. All sampled queries stay within the authored transfer cap. Selected exact coordinates, independent source points and scalar values are pinned in source/reference/scalar-anchors.json and checked by the body source tests. Full results remain in output/asteroids-radar-six/mithra-nereus/nereus/scalar-independent.json.

Independent full-source projection and authored palette/relief calculations match 11 decoded interior anchor colors in both flood and directional WebP atlases, with maximum channel difference 3/255 at quality 90. 22 retained pixel positions, including clamped bleed, match independent source points and scalar values. Source-edge normals are not unique, and WebP chroma filtering can mix neighboring atlas cells at raster boundaries; these checks do not establish boundary color fidelity. Full coordinates, decoded colors and atlas hashes are retained in output/asteroids-radar-six/mithra-nereus/nereus/atlas-anchors.json.

</details>
