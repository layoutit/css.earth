# 1950 DA sources and preparation

1950 DA is a near-Earth asteroid with a rounded, oblate radar shape and an equatorial ridge.

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original 1950DA_RetrogradeModel.wf](https://echo.jpl.nasa.gov/asteroids/shapes/1950DA_RetrogradeModel.wf). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/29075_1950DA/busch.etal.2007.1950da.pdf): Busch et al. (2007), Icarus 190, 608–621; Arecibo, Goldstone and NASA/JPL radar astronomy. The paper, original OBJ and public index are pinned beside the recipe. Index HTML is source evidence only; its scripts are never evaluated or shipped at runtime.

This view uses the published 2007 retrograde reconstruction. The 2014 Yarkovsky analysis rules out the prograde alternative. About 30% of the retrograde model surface was unseen or seen at incidence angles above 75 degrees in the original observations, so that region depends on the model assumptions. No optical surface map is supplied.

The original mesh has 510 vertices and 1016 triangles, Cartesian extents 1.449683 × 1.597741 × 1.197445 km, closed volume 1.145649542 km³ and volume-equivalent radius 0.649114124 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 0.65 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

## Frame and appearance

The selected source pole is ecliptic J2000 (187.4°, -89.5°), with period 2.1216 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°. Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

Shape uses the shared missing-imagery grid. No generic regolith texture, invented craters, compositional coloring or optical albedo map is added. Elevation shows original model radius minus the 0.65 km sphere, from -0.13 to 0.18 km. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and directional light are existing prepared display treatments.

## Reduction and delivery

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 11 m stopping threshold. Its error estimate is 10.565598 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 1.296750 m and maximum 4.703741 m; display-to-source p95 1.323804 m and maximum 4.488058 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties. All 1016 source face centroids and 8,192 sphere directions were checked for radial ambiguity, with no repeated intersection found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

The manifest pins every consumed file. Source acquisition restores exact original mesh, article, ESO panorama and Inter font bytes. Shared star and font notices are preserved. Context and runtime outputs rebuild through the existing authored object preparer. Runtime installation requests only the published assets of the selected object.
