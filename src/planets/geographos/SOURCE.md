# Geographos sources

Geographos is an elongated near-Earth asteroid reconstructed from Goldstone radar and optical light curves. The selected [NASA/JPL OBJ](https://echo.jpl.nasa.gov/asteroids/shapes/geographos.obj) is attributed to Hudson and Ostro (1999), Icarus 140, 369–378; Goldstone and NASA/JPL radar astronomy. The original mesh and paper are pinned with byte counts and SHA-256 hashes. The 1994 equatorial radar geometry leaves north–south ambiguity: local feature latitudes and thickness are model-dependent. This view retains the archived 1999 radar model; the reference radius is derived from this mesh volume and is not an independently measured physical mean radius. No resolved optical surface map is supplied.

## Shape and physical interpretation

The original source has 2048 vertices and 4092 faces, with extents 5.052589 × 2.028125 × 2.145141 km. Closed volume is 8.868010549 km³ and its derived volume-equivalent radius is 1.284041905 km. Vertices remain at original kilometer scale; no catalog diameter rescales them. The 1.284042 km display datum is Volume-equivalent radius computed from the unmodified JPL archive mesh. The source paper gives a model-volume upper bound; no catalog diameter is imposed on the vertices.

The JPL release has more vertices than the 512-vertex fit discussed in the paper. Its sampling density is not observation resolution. The paper gives a model-dependent volume upper bound near 8.8 km³; rounded archival geometry is not a new physical measurement. The separate PDS release is thicker and has different coordinates. These variants are not claimed identical. Later thermophysical research favors a thinner/lightcurve-based interpretation; this package intentionally identifies the archived radar reconstruction.

The [PDS radar model archive](https://sbn.psi.edu/pds/resource/rshape.html) documents kilometer coordinates centered on the modeled center of mass, principal axes, and positive Z as the spin direction. The paper supplies ecliptic J2000 pole (55°, -46°) and sidereal period 5.223327 h. The shared observed-pole recipe applies J2000 obliquity 23.439291111°. The display prime meridian is arbitrary; accelerated rotation and lighting do not propagate a measured present-day attitude.

## Views

Shape uses the shared missing-imagery grid. It shows modeled geometry under prepared lighting, without optical reflectance, generic regolith, invented craters or composition.

Elevation is false-color source radius minus a 1.284042 km reference sphere, encoded from -0.59 to 1.4 km. It is a derived geometric scalar, not independent topography or gravitational height. The existing closest-source-point transfer projects each display sample onto the full source mesh, preserving the source face, point and radius. Correspondences farther than 30 m are withheld as missing coverage. The flattened map withholds ambiguous radial cells; it does not define the triangle atlas’s scientific value. Cartographic relief and Sun lighting remain display treatments.

Two source face-centroid rays select a different surface sheet (up to 72.280338 m radius difference); the source-surface transfer avoids that false assignment. A uniform 8,192 direction census alone missed this localized ambiguity.

## Preparation checks

The shared meshoptimizer 1.2.0 source-connectivity path outputs 800 native PolyCSS u triangles, 128px raster cells, with ErrorAbsolute and RegularizeLight. Its authored stopping threshold is 30 m and its estimated error is 29.385834 m. Source and output are each one closed outward-wound component with Euler characteristic 2; zero opposite faces were removed. Estimated error is not a geometric bound.

An independent nearest-triangle comparison uses 8,192 area-stratified points on each surface: source-to-display p95 16.070065 m/max 31.238113 m; display-to-source p95 16.182665 m/max 31.635163 m. These are sampled distances, not observational uncertainty or exhaustive Hausdorff bounds. Full-source NumPy plane/edge projections supply independent scalar anchors at shape extremes, the central indentation and ambiguous source sheets. Matching source/result snapshots cover front, back and poles; each is normalized to its own maximum radius, so they are geometry comparisons rather than browser pixel parity.

Pinned JPL Horizons geometric heliocentric ICRF elements at JD 2461286.5 and vectors at that epoch and ±30 days support the fixed scene. The conic is a display approximation, not a perturbation ephemeris; root integration owns the independent position checks.

## Source survey

- [Nonconvex kilometer-scale radar geometry](https://echo.jpl.nasa.gov/asteroids/shapes/geographos.obj): **included**. Unmodified JPL OBJ; its extents match the named radar model. Archived geometry is explicitly identified, including north-south ambiguity.
- [PDS radar model at 8,192 vertices / 16,380 triangles](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.radar.shape-models/data/1620geographos.tab): **excluded**. A different archival geometry: extents 5.112129×1.9997933×2.410471km and different first vertex. More vertices do not establish more independent resolving power; no silent substitute for the selected JPL version. PDS XML supplies family frame/units evidence, not exact byte identity.
- [Thermophysical analysis and comparison of radar, flattened radar and lightcurve shapes](https://arxiv.org/abs/1407.2127): **included as qualification**. Concludes radar thickness can be overestimated. We preserve the cited radar release and disclose this alternative interpretation; no ad hoc flattening or invented correction.
- [Lightcurve-derived convex shape and later YORP spin solutions](https://astro.troja.mff.cuni.cz/projects/damit/asteroids/view/206): **excluded from this radar presentation**. Distinct inversion assumptions and phase model. Useful future alternative, not a measured optical texture or a correction that can be spliced into the archived radar source.
- [1994 Goldstone delay-Doppler observations 75–151 m](https://sbn.psi.edu/pds/resource/geograph.html): **excluded from surface lens**. Radar delay-Doppler pixels mix surface locations; cannot be treated as a registered optical/albedo texture.

Original geometry and research sources restore through the pinned acquisition plan. ESO sky, HYG stars and Inter font notices are preserved. Runtime assets contain prepared derivatives, never source article pages.

The delivered Elevation atlas records 1,286 withheld interior texels of 5,784,820 (0.0222%). The maximum accepted projection distance is 29.999850 m. Independent decoded-atlas checks include 23 final WebP pixel anchors: maximum channel error 2/255 against the source scalar and cartographic-relief recipe. This bound describes those sampled pixels, not every atlas pixel.
