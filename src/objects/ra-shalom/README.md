# Ra-Shalom

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Ra-Shalom is an irregular near-Earth asteroid reconstructed from Arecibo radar observations in 2000 and 2003.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original rashalom.obj](https://echo.jpl.nasa.gov/asteroids/shapes/rashalom.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/2100_RaShalom/shepard.etal.2008.rashalom.pdf): Shepard et al. (2008), Icarus 193, 20–38; Arecibo and NASA/JPL radar astronomy. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 1.15 km sphere, from -0.33 to 0.37 km. The scalar is evaluated at the closest source triangle point, not the first center-ray intersection. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 9.615730 m and maximum 20.132628 m; display-to-source p95 9.684616 m and maximum 29.433514 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

The recorded source-scalar and decoded-atlas checks are detailed below; their sampled results do not establish browser pixel parity.

[Source test definitions](../../../tests/objects/unit/ra-shalom/source.test.mts).

## Known problems

This is the 2008 radar model and its adopted prograde spin interpretation. The original radar data did not uniquely determine the pole; later lightcurve studies favor a different, retrograde solution and a slightly longer period. The displayed attitude is model-specific and has arbitrary phase, not a current rotational ephemeris. No resolved optical surface map is supplied.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

The sampled display-to-source maximum (29.433514 m) exceeds the 24 m authored transfer cap. Meshoptimizer’s estimate is not a distance bound. The cap is retained: out-of-range Elevation samples remain the shared missing-data grid. No threshold was enlarged to hide this limit.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="ra-shalom-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>
<a id="independent-archive-and-bounded-data-survey"></a>
<a id="delivered-atlas-anchors"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 1148 vertices and 2292 triangles, Cartesian extents 2.958422 × 2.455054 × 1.954120 km, closed volume 6.203733938 km³ and volume-equivalent radius 1.139868761 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 1.15 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

The selected source pole is ecliptic J2000 (75°, 16°), with period 19.793 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 24 m stopping threshold. Its error estimate is 23.015841 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

**Independent archive and bounded data survey**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Delivered atlas anchors**

All 2292 source face centroids and 8,192 sphere directions were checked: 0 centroids disagree with the first radial hit and 0 directions have a further surface hit. Elevation therefore uses the existing closest-source-point transfer on full source triangles, bounded to 24 m, and withholds ambiguous or out-of-range samples. The flat longitude/latitude preview also withholds multi-surface rays. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

The baked Elevation flood and directional WebP atlases pass 11 independent unique-interior color anchors, with maximum RGB channel error 3 under the existing fixed tolerance of 12. Actual retained matrices locate texel centers; independent NumPy projection against every original triangle supplies source points, radii and source normals. Product correspondence agrees at all 22 interior and clamped edge-padding queries. Source-edge/vertex normals can be nonunique, and WebP chroma filtering crosses cell boundaries; boundary RGB is recorded diagnostically and is not a color-fidelity acceptance claim. The full source-surface radius range, including triangle interiors, lies inside the authored palette domain.

The prepared package test verifies the selected body's asset hashes, 800 native u raster triangles, source-connected closed topology, hit geometry, Shape/Elevation lenses, distinct prepared lighting images and its Sun-context registration. Shared browser/DPR conformance remains part of the integration qualification.

</details>
