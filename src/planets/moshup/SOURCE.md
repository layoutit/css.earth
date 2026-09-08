# Moshup sources and preparation

Moshup is the primary of the near-Earth binary asteroid formerly designated 1999 KW4. Its radar reconstruction has a pronounced equatorial ridge.

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original kw4a.obj](https://echo.jpl.nasa.gov/asteroids/shapes/kw4a.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/1999KW4/1999kw4.html): Ostro et al. (2006), Radar imaging of binary near-Earth asteroid (66391) 1999 KW4, Science 314, 1276–1280, DOI 10.1126/science.1133622; Arecibo, Goldstone and NASA/JPL. The paper, original OBJ and public index are pinned beside the recipe. Index HTML is source evidence only; its scripts are never evaluated or shipped at runtime.

This is the archived Alpha model alone; its companion Squannit is not rendered. The source paper identifies regions constrained by weaker Goldstone images where reconstruction accuracy is lower. Table 2 supplies the equivalent diameter, rotation period and ecliptic pole; no gravitational-slope or optical albedo map is inferred.

The original mesh has 4586 vertices and 9168 triangles, Cartesian extents 1.531419 × 1.494357 × 1.347514 km, closed volume 1.195308026 km³ and volume-equivalent radius 0.658360463 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.6585 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

## Frame and appearance

The selected source pole is ecliptic J2000 (326°, -65°), with period 2.7645 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°. Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

Shape uses the shared missing-imagery grid. No generic regolith texture, invented craters, compositional coloring or optical albedo map is added. Elevation shows original model radius minus the 0.6585 km sphere, from -0.1 to 0.13 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and directional light are existing prepared display treatments.

## Reduction and delivery

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 14 m stopping threshold. Its error estimate is 13.598886 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 6.351102 m and maximum 16.991139 m; display-to-source p95 6.335770 m and maximum 15.013194 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties. All 9168 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

The manifest pins every consumed file. Source acquisition restores exact original mesh, article, ESO panorama and Inter font bytes. Shared star and font notices are preserved. Context and runtime outputs rebuild through the existing authored object preparer. Runtime installation requests only the published assets of the selected object.
