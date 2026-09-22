# 2002 CE26 Primary

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

(276049) 2002 CE26 is a near-Earth binary system.

## Sources

Geometry is the unchanged [ce26.obj](https://echo.jpl.nasa.gov/asteroids/shapes/ce26.obj) from the [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html). Its source study is [Shepard et al. (2006), Icarus 184, 198–210](https://echo.jpl.nasa.gov/asteroids/2002CE26/shepard.etal.2006.2002ce26.pdf), using 2004 Arecibo radar, optical light curves and NASA IRTF observations.

Shape uses the shared missing-imagery grid. Elevation is radius minus the documented reference sphere, derived from the same radar inverse model; it is not independent topography, optical albedo or height above a gravitational equipotential. Cartographic relief is a prepared display treatment. Shadows are off by default. Optional directional shading and the grid are existing shared rendering treatments, not measured surface appearance.

## Evidence

The source mesh is reduced from 2292 to 800 faces. The final stopping and closest-source scalar-transfer allowance is 35 m. Meshoptimizer's estimated error is 28.439396 m, not an exhaustive bound. An initial 29 m allowance was below the independent sampled display-to-source maximum; increasing it to 35 m preserved the same 800 faces. Independent 8192 area-stratified samples in each direction give source-to-display p95 12.616378 m / max 26.107453 m, and display-to-source p95 12.632884 m / max 29.899055 m. These are sampled geometric distances, not observational errors. All 2292 source face-centroid rays and 8192 sphere directions showed no repeated radial crossing. Elevation spans -0.15 to 0.17 km relative to the 1.73 km reference sphere.

Source-scalar and decoded-atlas measurements are retained below. They are sampled preparation checks, not browser pixel-parity evidence.

[Source test definitions](../../../tests/objects/unit/asteroid-2002-ce26/source.test.mts).

## Known problems

The north polar region was hidden or observed above 60° radar incidence. The solution uses model priors to suppress unsupported small-scale concavities. This limits local shape confidence even where the mesh is numerically smooth. The approximate retrograde pole and arbitrary phase also limit the interpretation of optional Sun shading.

No calibrated registered optical mosaic, composition map or independent topographic raster was acquired in the bounded survey. Failed or unacquired sources are not evidence of universal absence. Shape therefore uses the common grid and no generic regolith texture.

Rotational phase is arbitrary, not a present-attitude ephemeris. The prior 3.2930 h synodic light-curve value is not substituted for the model period. The secondary's approximately 15.6 h orbit is not a primary spin period.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="2002-ce26-primary-sources-and-preparation"></a>
<a id="model-identity-scale-and-spin"></a>
<a id="source-survey-and-geometry-qualification"></a>
<a id="prepared-views-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

**Model identity, scale and spin**

The source file contains 1148 vertices and 2292 triangles in kilometers. Its Cartesian X/Y/Z extents are 3.650626, 3.652092 and 3.256482 km, matching the model dimensions in Table 7. Closed volume is 21.6715337422 km³, and volume-equivalent radius is 1.72955222233 km. The reference radius is 1.73 km, from the model's 3.46 km equivalent diameter (±10%). The rounded 3.5 km catalog diameter is not used to rescale the source coordinates. The paper's volume uncertainty is ±30%.

Table 7 gives a model period of 3.2931 ± 0.0003 h and ecliptic J2000 pole (317°, -20°), with longitude/latitude uncertainties ±10°/±15°. These are converted to equatorial J2000 using obliquity 23.439291111°. Positive Z is the selected spin pole, X defines zero longitude and Y defines 90°; display longitude is east-positive.

The study derives a primary mass of (1.95 ± 0.25) × 10¹³ kg from the secondary orbit. The astronomy value GM = 1.3014885 × 10⁻⁶ km³/s² uses that mass and CODATA 2018 G = 6.67430 × 10⁻²⁰ km³ kg⁻¹ s⁻². This does not add secondary geometry or assume a density.

**Source survey and geometry qualification**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Prepared views and delivery**

The original source coordinates are preserved without axis rescaling. The existing meshoptimizer 1.2.0 source-connectivity path uses ErrorAbsolute and RegularizeLight. Both source and retained meshes are one closed outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster cells are 128 px, with 800 triangles in a 2048 × 6400 px atlas. Geometry, scalar transfer, normals, lighting and targeting state are prepared before runtime.

Elevation uses the shared closest full-source triangle sampler in three dimensions. The nearest source point supplies radius and normal. Competing equal-distance surfaces or out-of-allowance samples are withheld; atlas bleed is clamped to each retained triangle boundary. The equirectangular preview withholds ambiguous radial projections. Geometry error, transfer allowance and observational uncertainty are distinct.

Pinned JPL Horizons heliocentric geometric ICRF elements at JD2461286.5 and independent vectors at that epoch and ±30 days support the existing fixed-epoch orbital context. The conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms.

Front, back and both-pole source/reduced snapshots preserve the gross form and silhouette. These are preparation comparisons normalized to each mesh maximum radius, not browser pixel-parity evidence.

Independent whole-source planar/edge projection agrees with the product sampler on 828 probes: every retained face centroid, six source extrema, and decoded-atlas interior/bleed coordinates. The maximum radius-minus-datum difference is 6.66e-16 km. All 13,107,200 prepared atlas texels, including bleed, were accepted; no retained triangle interior was withheld. The maximum actual transfer distance is 30.555441 m. Decoded flood and directional RGB agree at 11 interior anchors within 7/255 per channel. Bleed RGB remains diagnostic because incident normals are nonunique at shared source edges/vertices and lossy WebP mixes atlas-boundary colors. Its closest coordinates and scalar values are checked separately; no exact boundary RGB oracle is claimed.

</details>
