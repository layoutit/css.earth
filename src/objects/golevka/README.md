# Golevka

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Golevka is a near-Earth asteroid whose radar reconstruction has angular faces, sharp edges and large concavities.

## Sources

Geometry is the unchanged [golevka.obj](https://echo.jpl.nasa.gov/asteroids/shapes/golevka.obj) from the [NASA/JPL radar model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html). Interpretation comes from [the original research](https://echo.jpl.nasa.gov/asteroids/6489_Golevka/hudson.etal.2000.golevka.pdf): Hudson et al. (2000), Icarus 148, 37–51; Goldstone radar, optical light curves and NASA/JPL. The original OBJ, paper, Horizons responses and authored recipe are pinned under source/.

Shape uses the shared missing-imagery grid. Elevation shows source radius minus a 0.265 km reference sphere, with a -0.11 to 0.14 km palette. It visualizes the radar inverse model, not independent topography, optical albedo or gravitational elevation.

## Evidence

Independent 8,192 area-stratified surface samples in each direction give source-to-display p95 3.540989 m / max 9.020970 m, and display-to-source p95 3.548837 m / max 8.252325 m. These are sampled distances, not exhaustive bounds or observational errors. All source face centroids and 8,192 sphere directions showed no repeated radial crossing. Front, back and both-pole source/reduced snapshots preserve the gross form; they are preparation comparisons normalized to each mesh’s maximum radius, not browser pixel-parity evidence.

Source-scalar and decoded-atlas measurements are retained below. They are sampled preparation checks, not browser pixel-parity evidence.

[Source test definitions](../../../tests/objects/unit/golevka/source.test.mts).

## Known problems

The PDS radar shape collection describes a center-of-mass origin and principal-axis frame, with positive Z as the spin pole. Its Golevka mesh and label were located, but both returned HTTP 403 during this acquisition; an exact numeric comparison to that counterpart remains unresolved. This package binds the original JPL mesh to its own paper’s dimensions and pole.

The bounded JPL/PDS/paper survey found no calibrated registered optical mosaic, independent elevation measurement or composition map for this package. Failed archive requests do not establish dataset absence.

The published ecliptic pole (202°, -45°) is converted to equatorial J2000 using obliquity 23.439291111°. Body longitude is east-positive; display phase is arbitrary.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="golevka-sources-and-preparation"></a>
<a id="model-identity-coordinates-and-spin"></a>
<a id="views-and-source-survey"></a>
<a id="geometry-scalar-transfer-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

**Model identity, coordinates and spin**

Hudson et al. Table XI gives a 530 ± 30 m equivalent diameter and principal-axis extents 685, 489 and 572 m. The archived mesh has Cartesian X/Y/Z extents 488.767, 685.157, 572.008 m: These are the paper’s principal-inertia-axis labels: X intermediate, Y long and Z short spin axis. Those labels do not rank the Cartesian maximum extents (X is geometrically shortest). The source coordinates and axes remain unchanged. The ±5° pole uncertainty and ±0.0001 h sidereal-period uncertainty belong to the published reconstruction. The 1997 optical-only pole and older 6.026 h catalog period are not substituted for the radar-model interpretation.

The original mesh has 2048 vertices and 4092 triangles, closed volume 0.0779465269834 km³ and volume-equivalent radius 0.264994007693 km. The reference radius is 0.265 km. This datum does not rescale the shape.

**Geometry, scalar transfer and delivery**

The existing meshoptimizer 1.2.0 source-connectivity path uses ErrorAbsolute and RegularizeLight to reduce 4092 faces to 800, with a 10 m authored stopping allowance. The library’s estimated error is 6.660273 m, not a geometric bound. Independent sampled nearest-surface distances justified a 10 m closest-source-point scalar-transfer allowance; changing the stopping allowance from the exploratory 7 m to 10 m retained the same 800 faces.

Both input and output are one closed outward-wound component, Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster cells are 128 px; the triangle atlas is 2048 × 6400 px. All geometry, normals, imagery, lighting and targeting state are prepared before runtime.

Elevation uses the shared closest full-source triangle sampler in 3D. Its source barycentric point supplies radius and normal; competing equal-distance surfaces or out-of-allowance samples are withheld. Atlas bleed is clamped to each retained triangle’s boundary. The flat equirectangular preview withholds ambiguous radial projections. Geometry error, scalar-transfer distance and observational uncertainty are distinct.

Pinned JPL Horizons heliocentric geometric ICRF elements at JD2461286.5 and independent vectors at that epoch and ±30 days support the existing fixed-epoch context. The conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. Horizons supplies no GM, so the astronomy record uses zero rather than an assumed density.

Independent whole-source planar/edge projection agrees with the product sampler on 830 probes (all retained centroids, six source extrema and decoded-atlas interior/bleed coordinates); maximum radius-minus-datum difference is 1.67e-16 km. Decoded flood and directional atlas RGB agree at 12 interior anchors within 4/255 per channel. Bleed RGB probes remain diagnostic: shared source edges/vertices admit multiple incident facet normals and lossy WebP mixes atlas-boundary colors, so no single exact boundary RGB oracle is claimed. Their source-point and scalar agreement is verified separately.

</details>
