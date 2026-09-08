# Ra-Shalom sources and preparation

Ra-Shalom is an irregular near-Earth asteroid reconstructed from Arecibo radar observations in 2000 and 2003.

The [NASA/JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) identifies the [original rashalom.obj](https://echo.jpl.nasa.gov/asteroids/shapes/rashalom.obj). Geometry and scientific interpretation come from [the source research](https://echo.jpl.nasa.gov/asteroids/2100_RaShalom/shepard.etal.2008.rashalom.pdf): Shepard et al. (2008), Icarus 193, 20–38; Arecibo and NASA/JPL radar astronomy. The paper, original OBJ and public index are pinned beside the recipe. Index HTML is source evidence only; its scripts are never evaluated or shipped at runtime.

This is the 2008 radar model and its adopted prograde spin interpretation. The original radar data did not uniquely determine the pole; later lightcurve studies favor a different, retrograde solution and a slightly longer period. The displayed attitude is model-specific and has arbitrary phase, not a current rotational ephemeris. No resolved optical surface map is supplied.

The original mesh has 1148 vertices and 2292 triangles, Cartesian extents 2.958422 × 2.455054 × 1.954120 km, closed volume 6.203733938 km³ and volume-equivalent radius 1.139868761 km. The body-fixed coordinates are consumed in kilometers, without rescaling or a radial replacement mesh. The displayed reference radius is 1.15 km. The reference diameter is the value paired with the radar model in its source paper, and need not exactly equal the volume of a rounded vertex file.

## Frame and appearance

The selected source pole is ecliptic J2000 (75°, 16°), with period 19.793 h. Positive Z is the selected spin axis; longitude is east-positive around that model axis. The existing observed-pole recipe converts the source pole using J2000 obliquity 23.439291111°. Prime-meridian display phase is arbitrary. Lighting does not claim an absolute current rotational attitude.

Shape uses the shared missing-imagery grid. No generic regolith texture, invented craters, compositional coloring or optical albedo map is added. Elevation shows original model radius minus the 1.15 km sphere, from -0.33 to 0.37 km. The scalar is evaluated at the closest source triangle point, not the first center-ray intersection. This is another view of the same radar reconstruction, not independent topography or height above a gravitational equipotential. Cartographic relief and directional light are existing prepared display treatments.

## Reduction and delivery

Meshoptimizer 1.2.0, with ErrorAbsolute and RegularizeLight, reduces the original connectivity to 800 triangles at the authored 24 m stopping threshold. Its error estimate is 23.015841 m; that estimate is not a geometric bound. Source and display remain one closed, outward-wound component with Euler characteristic 2; no opposite faces are removed. Native PolyCSS u raster leaves use 128 × 128 px cells in a 2048 × 6400 atlas. Geometry, texels and lighting are prepared ahead of runtime.

Independent 8,192 area-stratified samples in each direction measured nearest-triangle distances: source-to-display p95 9.615730 m and maximum 20.132628 m; display-to-source p95 9.684616 m and maximum 29.433514 m. These are sampled distances, not exhaustive Hausdorff bounds or observational uncertainties. All 2292 source face centroids and 8,192 sphere directions were checked: 0 centroids disagree with the first radial hit and 0 directions have a further surface hit. Elevation therefore uses the existing closest-source-point transfer on full source triangles, bounded to 24 m, and withholds ambiguous or out-of-range samples. The flat longitude/latitude preview also withholds multi-surface rays. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they inspect geometry and do not claim browser pixel parity.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The fixed-epoch conic is a display approximation, not a long-term perturbation ephemeris; TDB is approximated as TT within 2 ms. GM is the pinned Horizons physical value, or zero when unavailable, without an assumed density.

The manifest pins every consumed file. Source acquisition restores exact original mesh, article, ESO panorama and Inter font bytes. Shared star and font notices are preserved. Context and runtime outputs rebuild through the existing authored object preparer. Runtime installation requests only the published assets of the selected object.

## Independent archive and bounded data survey

The PDS radar bundle (Lawrence and Benner, 2020; https://doi.org/10.26033/xtkf-wz81) supplies the corresponding a2100rashalom.obj and XML label. Every parsed vertex and triangle index matches the consumed JPL file exactly, despite formatting differences. The pinned bundle description explicitly identifies kilometer units, center-of-mass origin, principal axes and positive-Z spin axis. Its label describes radar image resolution of 75–150 m; 128 px display cells add no observational detail.

The pinned PDS spin table records the adopted ecliptic pole (75°,16°), 19.793 h period, and phase 17° at 2003-08-22 00:00:00. These are archival model parameters. The app retains the model axes and period but deliberately uses arbitrary display phase; the archival epoch is not propagated into a current attitude.

The original 2008 multi-wavelength study combines radar, spectroscopy and thermal observations. Its disk-integrated spectra and thermal/roughness results are not a registered surface map. The radar fit did not include the optical lightcurves and could not rule out a retrograde interpretation; the adopted pole was not unique. The independent [JPL 2016 observation planning summary](https://echo.jpl.nasa.gov/asteroids/Ra-Shalom/Ra-Shalom_2016_planning.html), pinned as source evidence, reports Ďurech et al. (2012) lightcurve values of 19.8201 ± 0.0004 h and pole (313°,-45°). Later [lightcurve modeling](https://academic.oup.com/mnras/article/527/3/6814/7419864) also concerns another convex-model solution. A newer pole is not applied to the older radar mesh without a source registration. The visible introduction qualifies this historical model and the differing later interpretation.

Survey decision: retain the calibrated JPL/PDS radar shape plus its source-derived Elevation. The radar images are delay-Doppler measurements, not an optical texture. Disk-integrated spectra, thermal modeling and unregistered alternate convex shapes do not qualify additional surface lenses. No resolved optical map or independently registered composition, temperature, gravity or slope grid was identified in this bounded source survey.

The sampled display-to-source maximum (29.433514 m) exceeds the 24 m authored transfer cap. Meshoptimizer’s estimate is not a distance bound. The cap is retained: out-of-range Elevation samples remain the shared missing-data grid. No threshold was enlarged to hide this limit.

## Delivered atlas anchors

The baked Elevation flood and directional WebP atlases pass 11 independent unique-interior color anchors, with maximum RGB channel error 3 under the existing fixed tolerance of 12. Actual retained matrices locate texel centers; independent NumPy projection against every original triangle supplies source points, radii and source normals. Product correspondence agrees at all 22 interior and clamped edge-padding queries. Source-edge/vertex normals can be nonunique, and WebP chroma filtering crosses cell boundaries; boundary RGB is recorded diagnostically and is not a color-fidelity acceptance claim. The full source-surface radius range, including triangle interiors, lies inside the authored palette domain.

The prepared package test verifies the selected body's asset hashes, 800 native u raster triangles, source-connected closed topology, hit geometry, Shape/Elevation lenses, distinct prepared lighting images and its Sun-context registration. Shared browser/DPR conformance remains part of the integration qualification.
