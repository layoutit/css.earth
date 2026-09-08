# 2008 EV5 sources

2008 EV5 is a small near-Earth asteroid with a radar-derived equatorial ridge interrupted by a large concavity. The [original NASA/JPL mesh](https://echo.jpl.nasa.gov/asteroids/shapes/2008ev5.obj) and [study](https://echo.jpl.nasa.gov/asteroids/2008EV5/busch.etal.2011.2008ev5.pdf) are pinned by byte count and SHA-256. The north pole was not covered by the radar images, so its topography and flattening depend on modeling constraints. The pole is uncertain by 10 degrees and equivalent diameter is 400 ± 50 m. The unmodified archive mesh is retained; no resolved optical surface map is supplied.

## Geometry, scale and rotation

The source has 2000 vertices and 3996 faces, one closed outward-wound component and Euler characteristic 2. Extents are 0.458038 × 0.444890 × 0.404141 km; volume is 0.034838315 km³. The original OBJ has a 0.034838315 km³ volume, matching the paper’s rounded 0.035 km³ value. Its unrotated bounding extents are 458.038 × 444.890 × 404.141 m, compared with the paper’s rounded 420 × 410 × 390 m principal-axis dimensions (±50 m). We retain and identify the archive geometry rather than rescale it to rounded table entries. The paper’s Figure 5 identifies +Z as angular momentum and rotation axis.

The reference radius is 0.2 km: Half the 400 ± 50 m equivalent diameter in Busch et al. (2011), Table 2. The archived mesh has a 405.2 m volume-equivalent diameter and is not rescaled to the rounded published value. It defines a geometric datum, not a gravitational equipotential. The published ecliptic J2000 pole is (180°, -84°), with period 3.725 ± 0.001 hours. The existing observed-pole recipe converts it to equatorial coordinates using J2000 obliquity 23.439291111°. Display phase is arbitrary; the animation is not a present-day attitude ephemeris.

## Supported views

Shape uses the normal missing-imagery grid on the original source geometry. No regolith texture, optical reflectance or artificial crater imagery is supplied. Shadows default off; prepared directional lighting is available through the common setting.

Elevation colors radius of the closest original source-surface point minus 0.2 km. The palette spans -0.03 to 0.04 km, enclosing the original mesh including triangle interiors. It is derived from the same radar model, not independent measured topography. The shared closest-source-point transfer withholds correspondence beyond 5 m. The flattened sample grid is not the scientific authority for retained triangle texels. Cartographic relief is a display treatment.

0 of 3996 source face-centroid rays and 0 of 8,192 distributed directions encounter radial ambiguity. The census found no competing radial branch, and the same source-surface transfer binds the scalar to the rendered surface.

## Preparation and independent checks

Existing meshoptimizer 1.2.0 source-connectivity simplification retains 800 native PolyCSS u raster faces in 128 px cells. It preserves a single closed component and Euler characteristic 2. The authored error threshold is 5 m; the simplifier estimate is 4.554970 m. This estimate is not a geometric bound.

An independent nearest-triangle comparison used 8,192 area-stratified samples in each direction. Source-to-display p95/max: 2.191206/4.530459 m. Display-to-source p95/max: 2.218597/4.972409 m. These are sampled distances, not exhaustive Hausdorff bounds or observation uncertainties. Independent NumPy full-source plane projections and edge minima qualify source-scalar anchors. Source/result front, back and pole snapshots inspect geometry; they are not browser pixel-parity claims.

JPL Horizons heliocentric geometric elements at JD 2461286.5 and independent ICRF vectors at that epoch and ±30 days are pinned in reference/. Shared astronomy integration owns the conic approximation and vector regression bounds.

## Source survey

- [Original full source radar shape](https://echo.jpl.nasa.gov/asteroids/shapes/2008ev5.obj): **included**. The unmodified source has 2000 vertices and 3996 faces. Original kilometer coordinates are retained.
- [Published physical properties, radar/lightcurve constraints and model uncertainty](https://echo.jpl.nasa.gov/asteroids/2008EV5/busch.etal.2011.2008ev5.pdf): **included**. Half the 400 ± 50 m equivalent diameter in Busch et al. (2011), Table 2. The archived mesh has a 405.2 m volume-equivalent diameter and is not rescaled to the rounded published value.
- [Busch et al. (2019) corrigendum](https://experts.azregents.edu/en/publications/corrigendum-to-radar-observations-and-the-shape-of-near-earth-ast/): **included as qualification**. Corrects the December 21 Goldstone delay-Doppler image resolution to 0.125 microseconds by 1.003 Hz. The authors state that the paper results are unaffected. It does not revise the adopted mesh or spin.
- [WISE thermophysical constraints (Ali-Lagoa et al., 2013)](https://arxiv.org/abs/1310.6715): **excluded from spatial lenses**. Disk-integrated thermal fits infer effective diameter, thermal inertia and grain-size ranges. These are not resolved regolith imagery or a spatial temperature map; the radar vertices are not silently rescaled to the thermal-fit diameter.
- [Arecibo/Goldstone radar images and VLBA spin sense](https://echo.jpl.nasa.gov/asteroids/2008EV5/2008ev5.html): **included as qualification**. VLBA speckle tracking distinguishes the retrograde solution. The north pole is poorly constrained; alternative flattening and facet-scale structures fit the data. Radar images cannot be used as a photographic texture.

Original mesh and paper restore through the body acquisition plan. Source papers retain publisher copyright and are not included in runtime assets. ESO sky, HYG stars and Inter font attributions accompany their source inputs.

The delivered Elevation atlas withholds 382 of 5,733,930 interior texels (0.0067%). Maximum accepted correspondence is 4.999841 m. 21 independent decoded final WebP anchors differ from expected source scalar/relief RGB by at most 8/255 per channel. This is a sampled pixel result, not an every-pixel bound.
