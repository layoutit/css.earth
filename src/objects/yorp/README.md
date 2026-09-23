# YORP

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

YORP is a small near-Earth asteroid with a radar-derived flattened northern hemisphere and a prominent concavity.

## Sources

Geometry is the unchanged [yorp.obj](https://echo.jpl.nasa.gov/asteroids/shapes/yorp.obj) from the [NASA/JPL radar model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html). Interpretation comes from [the original research](https://echo.jpl.nasa.gov/asteroids/taylor%2B2007_PH5.pdf): Taylor et al. (2007), Science 316, 274–277 and supporting material; Arecibo, Goldstone and NASA/JPL. The original OBJ, paper and supporting material, Horizons responses and authored recipe are pinned under source/.

Shape uses the shared missing-imagery grid. Elevation shows source radius minus a 0.0564 km reference sphere, with a -0.03 to 0.03 km palette. It visualizes the radar inverse model, not independent topography, optical albedo or gravitational elevation.

## Evidence

Independent 8,192 area-stratified surface samples in each direction give source-to-display p95 0.000000 m / max 0.000000 m, and display-to-source p95 0.000000 m / max 0.000000 m. These are sampled distances, not exhaustive bounds or observational errors. All source face centroids and 8,192 sphere directions showed no repeated radial crossing. Front, back and both-pole source/reduced snapshots preserve the gross form; they are preparation comparisons normalized to each mesh’s maximum radius, not browser pixel-parity evidence.

Source-scalar and decoded-atlas measurements are retained below. They are sampled preparation checks, not browser pixel-parity evidence.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/yorp/source.test.mts).

## Known problems

The pole is within 10° of ecliptic J2000 (180°, −85°). The cited initial spin rate is 42582.41 ± 0.02 degrees/day at 2001-07-27 00:00 UT, giving period 360 × 24 / 42582.41 = 0.20290068129070193 h (displayed as 12.17 minutes). The study measured acceleration (2.0 ± 0.2) × 10⁻⁴ degrees/day². The application holds the reference rate fixed with arbitrary display phase: it does not integrate that acceleration into 2026 or claim a current rotational attitude.

The supplement states that about 25% of the surface was unobserved or seen above 60° radar incidence. The spin-axis extent is less constrained because relative optical photometry cannot fix projected area. The model’s grid denotes unavailable optical imagery; it is not a map of this radar coverage. Alternative smoother models affect theoretical YORP torque predictions but do not supply additional measured surface lenses.

The bounded JPL/PDS/paper survey found no calibrated registered optical mosaic, independent elevation measurement or composition map for this package. Failed archive requests do not establish dataset absence.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="yorp-sources-and-preparation"></a>
<a id="model-identity-coordinates-and-spin"></a>
<a id="views-and-source-survey"></a>
<a id="geometry-scalar-transfer-and-delivery"></a>

<details>
<summary>Methods and source notes</summary>

**Model identity, coordinates and spin**

Taylor et al. Table 1 and Fig. S4 distinguish several allowable shape models. This archive’s 288 vertices and 572 facets, extents 149.285, 133.513, 95.663 m and 112.777 m volume-equivalent diameter agree, at the table’s rounding, with model A rough (149 × 134 × 96 m, 112.8 m diameter). The model identity is inferred from these independent numeric anchors; the bare OBJ has no model-version header. The coordinates are consumed in kilometers without scaling. X/Y/Z are the principal-axis directions documented in Fig. S4; positive Z is the northern spin-axis direction.

The original mesh has 288 vertices and 572 triangles, closed volume 0.000751034928943 km³ and volume-equivalent radius 0.0563884956818 km. The reference radius is 0.0564 km. This datum does not rescale the shape. The published ecliptic pole (180°, -85°) is converted to equatorial J2000 using obliquity 23.439291111°. Body longitude is east-positive; display phase is arbitrary.

**Geometry, scalar transfer and delivery**

The same source-meshoptimizer path retains all 572 native faces and 288 vertices. No extra faces are added to reach 800 and the reported simplification error is zero. The source-surface transfer allows only 0.001 m numerical distance from the unchanged geometry.

Both input and output are one closed outward-wound component, Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster cells are 128 px; the triangle atlas is 2048 × 4608 px. All geometry, normals, imagery, lighting and targeting state are prepared before runtime.

Elevation uses the shared closest full-source triangle sampler in 3D. Its source barycentric point supplies radius and normal; competing equal-distance surfaces or out-of-allowance samples are withheld. Atlas bleed is clamped to each retained triangle’s boundary. The flat equirectangular preview withholds ambiguous radial projections. Geometry error, scalar-transfer distance and observational uncertainty are distinct.

Pinned JPL Horizons heliocentric geometric ICRF elements at JD2461286.5 and independent vectors at that epoch and ±30 days support the existing fixed-epoch context. The conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. Horizons supplies no GM, so the astronomy record uses zero rather than an assumed density.

Independent whole-source planar/edge projection agrees with the product sampler on 600 probes (all retained centroids, six source extrema and decoded-atlas interior/bleed coordinates); maximum radius-minus-datum difference is 2.78e-17 km. Decoded flood and directional atlas RGB agree at 11 interior anchors within 2/255 per channel. Bleed RGB probes remain diagnostic: shared source edges/vertices admit multiple incident facet normals and lossy WebP mixes atlas-boundary colors, so no single exact boundary RGB oracle is claimed. Their source-point and scalar agreement is verified separately.

</details>
