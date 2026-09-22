# Moshup

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Moshup is the primary of the near-Earth binary asteroid formerly designated 1999 KW4.

## Sources

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original kw4a.obj](https://echo.jpl.nasa.gov/asteroids/shapes/kw4a.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/1999KW4/1999kw4.html): Ostro et al. (2006), Radar imaging of binary near-Earth asteroid (66391) 1999 KW4, Science 314, 1276–1280, DOI 10.1126/science.1133622; Arecibo, Goldstone and NASA/JPL. The paper and original geometry are pinned beside the recipe.

Shape uses the shared missing-imagery grid. Elevation shows original model radius minus the 0.6585 km sphere, from -0.1 to 0.13 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and lighting are display treatments.

## Evidence

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 6.351102 m and maximum 16.991139 m; display-to-source p95 6.335770 m and maximum 15.013194 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties.

[Source test definitions](../../../tests/objects/unit/moshup/source.test.mts).

## Known problems

This is the archived Alpha model alone; its companion Squannit is not rendered. The source paper identifies regions constrained by weaker Goldstone images where reconstruction accuracy is lower. Table 2 supplies the equivalent diameter, rotation period and ecliptic pole; no gravitational-slope or optical albedo map is inferred.

Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="moshup-sources-and-preparation"></a>
<a id="frame-and-appearance"></a>
<a id="reduction-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

The original mesh has 4586 vertices and 9168 triangles, Cartesian extents 1.531419 × 1.494357 × 1.347514 km, closed volume 1.195308026 km³ and volume-equivalent radius 0.658360463 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.6585 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

**Frame and appearance**

The selected source pole is ecliptic J2000 (326°, -65°), with period 2.7645 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°.

**Reduction and delivery**

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 14 m stopping threshold. Its error estimate is 13.598886 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

All 9168 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

</details>
