# 1998 WT24 sources and preparation

1998 WT24 is a small near-Earth asteroid reconstructed from radar and optical observations.

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original wt24.obj](https://echo.jpl.nasa.gov/asteroids/shapes/wt24.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/1998WT24/busch.etal.2008.1998wt24.pdf): Busch et al. (2008), Icarus 195, 614–621; Arecibo, Goldstone and NASA/JPL. The paper, original OBJ and public index are pinned beside the recipe. Index HTML is source evidence only; its scripts are never evaluated or shipped at runtime.

The published model has uneven latitude coverage, including an unseen region near the north pole. Its small depressions and rounded outline are radar-derived geometry; no measured optical surface texture is supplied.

The original mesh has 4000 vertices and 7996 triangles, Cartesian extents 0.470798 × 0.425616 × 0.404051 km, closed volume 0.037509350 km³ and volume-equivalent radius 0.207658785 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.2075 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

## Frame and appearance

The selected source pole is ecliptic J2000 (15°, -22°), with period 3.697 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°. Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

Shape uses the shared missing-imagery grid. No generic regolith texture, invented craters, compositional coloring or optical albedo map is added. Elevation shows original model radius minus the 0.2075 km sphere, from -0.08 to 0.06 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and directional light are existing prepared display treatments.

## Reduction and delivery

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 4 m stopping threshold. Its error estimate is 3.616501 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 1.669778 m and maximum 3.873296 m; display-to-source p95 1.669370 m and maximum 3.954152 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties. All 7996 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

The manifest pins every consumed file. Source acquisition restores exact original mesh, article, ESO panorama and Inter font bytes. Shared star and font notices are preserved. Context and runtime outputs rebuild through the existing authored object preparer. Runtime installation requests only the published assets of the selected object.
