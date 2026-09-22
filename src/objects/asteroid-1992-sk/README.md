# 1992 SK

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

1992 SK is an elongated near-Earth asteroid reconstructed from Goldstone radar and optical lightcurves obtained in 1999.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original sk.obj](https://echo.jpl.nasa.gov/asteroids/shapes/sk.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/10115_1992SK/busch.etal.2006.1992sk.pdf): Busch et al. (2006), Icarus 181, 145–155; Goldstone, optical observatories and NASA/JPL radar astronomy. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 0.5 km sphere, from -0.11 to 0.23 km. The scalar is evaluated at the closest source triangle point, not the first center-ray intersection. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 1.541196 m and maximum 4.960844 m; display-to-source p95 1.507709 m and maximum 4.677960 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

The recorded source-scalar and decoded-atlas checks are detailed below; their sampled results do not establish browser pixel parity.

[Source test definitions](../../../tests/objects/unit/asteroid-1992-sk/source.test.mts).

## Known problems

This is the published 2006 combined radar and lightcurve model. The north polar region is poorly constrained and some structure there may be a fitting artifact. Its diameter uncertainty is about 20%. Later lightcurves favor a different pole and measured rotational acceleration; this historical model retains its original pole and period with arbitrary display phase, not a current attitude. No resolved optical surface map is supplied.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="1992-sk-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>
<a id="independent-archive-and-bounded-data-survey"></a>
<a id="delivered-atlas-anchors"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 510 vertices and 1016 triangles, Cartesian extents 1.392511 × 0.901153 × 0.909754 km, closed volume 0.531398080 km³ and volume-equivalent radius 0.502470370 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.5 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

The selected source pole is ecliptic J2000 (99°, -3°), with period 7.3182 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 9 m stopping threshold. Its error estimate is 8.792428 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

**Independent archive and bounded data survey**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Delivered atlas anchors**

All 1016 source face centroids and 8,192 sphere directions were checked: 0 centroids disagree with the first radial hit and 0 directions have a further surface hit. Elevation therefore uses the existing closest-source-point transfer on full source triangles, bounded to 9 m, and withholds ambiguous or out-of-range samples. The flat longitude/latitude preview also withholds multi-surface rays. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

The baked Elevation flood and directional WebP atlases pass 11 independent unique-interior color anchors, with maximum RGB channel error 2 under the existing fixed tolerance of 12. Actual retained matrices locate texel centers; independent NumPy projection against every original triangle supplies source points, radii and source normals. Product correspondence agrees at all 22 interior and clamped edge-padding queries. Source-edge/vertex normals can be nonunique, and WebP chroma filtering crosses cell boundaries; boundary RGB is recorded diagnostically and is not a color-fidelity acceptance claim. The full source-surface radius range, including triangle interiors, lies inside the authored palette domain.

The prepared package test verifies the selected body's asset hashes, 800 native u raster triangles, source-connected closed topology, hit geometry, Shape/Elevation lenses, distinct prepared lighting images and its Sun-context registration. Shared browser/DPR conformance remains part of the integration qualification.

</details>
