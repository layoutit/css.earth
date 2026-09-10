# Tethys sources and preparation

Tethys uses the shared object adapter, application shell, source-mesh scene and lighting. All image resampling and source projection happen during preparation.

## Photographic lenses

- [USGS / Cassini 2012 monochrome mosaic](https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m): 11520 × 5760, about 293 m per pixel on a 536.3 km reference sphere. The GeoTIFF is north-up, equirectangular with center longitude 0°. Preparation rolls its 180° E left edge by half a width into the shared 0–360° E map. GeoTIFF no-data is exactly zero; missing observations use the shared gray grid. All nonzero values are retained.
- [NASA/JPL 2014 enhanced-color map, PIA18439](https://www.jpl.nasa.gov/images/pia18439-color-maps-of-tethys-2014/): the full 13467 × 6734 JPEG, approximately 250 m per source pixel. Infrared, green and ultraviolet observations make this enhanced color, beyond human vision. The producer calibrated, registered and photometrically corrected the observations. The map starts at 0° E, north-up, and is not rolled. The published display mosaic has no separate validity mask: dark terrain is not classified as missing coverage.

Native detail varies across both mosaics. Published image seams, coarse inserts and residual photographed shading remain. In particular, enhanced-color hemisphere differences can represent real surface alteration by dust and radiation, and are not removed as artificial shadows. No inpainting, polar repetition or color synthesis is applied. Different source control networks can leave local registration differences.

Odysseus lies near 30° N, 230° E; [Ithaca Chasma](https://planetarynames.wr.usgs.gov/Feature/2751) is centered near 14° S, 353.9° E. These provide independent checks of orientation and longitude registration.

## Elevation

[Weirich, Gaskell, Palmer and Domingue (2025), Tethys SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichtethysshape.html), NASA PDS, DOI [10.26033/hpv0-eh61](https://doi.org/10.26033/hpv0-eh61). The original product description and XML labels are retained alongside the numeric GeoTIFFs.

The global model is supplied as three grids: a 2222 × 679 equirectangular map spanning 55° S–55° N and two 444 × 444 polar stereographic maps. Preparation samples each original geotransform and uses the polar grids at higher latitudes. It honors actual raster bounds and no-data values; the equatorial map is never stretched over the poles and gaps are not extrapolated. The polar rectangles fall slightly short of their nominal 55° limit near cardinal longitudes, leaving narrow source gaps that use the shared gray grid.

Global values are center-relative radius in meters, unlike the archive's regional height products. The displayed quantity is `radius * 0.001 - 531`, height in kilometers above the source's 531 km reference sphere. Color spans −12.5 to +12.5 km. Brightness shows northwest cartographic relief at true height scale. The shared curvature overlay and optional directional Shadows remain active on this lens too.

The source model spacing is about 1.5 km. The product description’s one-to-two-grid-spacing error estimate is extrapolated from simulation experience; it is not an independent per-cell uncertainty measurement for Tethys. A larger prepared texture adds no measured terrain detail. Elevation colors include broad departures from the reference sphere; rendered geometry follows the simplified source mesh.

## Geometry, delivery and scope

The astronomy package provides the Saturn-relative orbit and IAU orientation. The old spherical display reference is retained only as the package’s scale normalization; the native model now supplies vertex positions. Numeric height datums and factsheet mean radii remain independent quantities. [NASA](https://science.nasa.gov/saturn/moons/tethys/) describes a mildly nonspherical body; the newly selected source model supplies a finite-resolution approximation to silhouette and topography.

The pre-existing photographic and SPC map preparation uses the shared 8192 × 4096 intermediate layout and 1024-pixel pole products. The final source-mesh scene samples these maps into prepared per-triangle atlases. Terminal surface and pole atlases use WebP quality 90 with lossless alpha. Sources and intermediate maps retain their original detail; only prepared files reach runtime. No visible atmosphere or cutaway is added.

Pinned files, URLs and hashes are in `source/manifest.json`; acquisition and preparation use the shared authored-object pipeline.

## B2 source shape and relative albedo

The native global Q128 OBJ is 98,306 vertices and 196,608 triangles in kilometres, north along +Z and longitude zero along +X. Exact source topology is retained before simplification. Preparation uses the measured candidate of 2,000 faces with regularize:false, under a 5,310 m display approximation ceiling (1% of the model reference radius). This is a display approximation budget, not scientific uncertainty. The closed candidate has Euler characteristic 2, one component and 2,000 faces. Its 8,000 one-way barycentric source-distance samples have maximum 3974.44 m, 95th percentile 2023.05 m and RMS 1036.86 m. These samples do not establish a full Hausdorff bound. These numerical samples alone do not qualify geographic registration, silhouette or individual features. The original photographic-map projection radii remain separate from shape geometry and the numeric elevation datum.

New relative albedo uses the published 2025 GeoTIFFs and their original equatorial/polar projections. Values are dimensionless and normalized around 1; the archive gives a nominal 0–2 domain. The visible 0.5–1.5 scale saturates above 1.5. No height conversion or relief shading is applied to this quantity. It is a secondary SPC brightness product, less validated than topography, and is neither geometric albedo nor calibrated reflectance. Tethys used uncalibrated ISS inputs; Dione and Rhea used calibrated frames. Source sigma is internal maplet agreement, not absolute height uncertainty.

The Shape lens uses the shared neutral grid over the source mesh to distinguish geometry from imagery. The Photographic views retain pre-existing image seams, shadows and local control differences. Source reference radii and projections do not become spherical geometry constraints. The original Q128 spacing is about 5.96 km; finer numeric maps do not imply the simplified silhouette retains that full detail.

The B2 intake originally recorded mesh selection and prepared visual checks as pending. Its selected 2,000-face mesh is now the existing body geometry, preserved byte for byte by B9. The numerical approximation checks above do not establish absolute cartographic accuracy; B9 source and mounted-view evidence is recorded separately in the review linked below.

## Cassini VIMS infrared and water-ice maps (B9)

The two additional surface views use original calibrated RC19 C cubes, matched
navigation N cubes and original PDS QUB detector/background data from the
[Nantes VIMS archive](https://vims.univ-nantes.fr/). Originals, exact wavelengths,
source masks, calibration arithmetic, observer timing and prepared source maps
are pinned in `source/cassini-ice/prepare.json` and `source/manifest.json`.

Infrared assigns native channels near 2.02, 1.59 and 1.28 µm to red, green and blue.
It is false color with an explicit common per-body stretch. Ice absorption is
`1 - R(near 2.02 µm) / continuum(near 1.82 µm, near 2.20 µm)` at the exact per-cube
wavelengths. It is not abundance. Calibrated float32 I/F and derived depth values
are retained, including valid negative measurements; only display colors saturate at
the authored legend/stretch limits. No photometric correction or observation
level matching is applied. Grain size, viewing geometry, illumination, noise
and archive filtering affect the signal.

Source support comes from native detector apertures and sampled exposure
geometry. Original saturation, special values, missing background and their
archive-filter dependencies are excluded per band. Numerical source maps do
not interpolate gaps into new measured coverage. The source grid is a sampling
choice, not additional native resolution. Exact observation/source-pixel
companion TIFFs preserve ownership. Infrared display packing follows the existing
photographic bilinear/WebP path, which can soften mask edges; the scalar ice
view uses nearest sampling. The final colors use the existing preparation,
meshes and retained CSS scene.

Registration limits and source-selection dispositions are recorded in
`source/cassini-ice/evidence/registration.md` and the
[B9 review](../../../docs/moons/b9-cassini-ice-surfaces/README.md).

All 9 selected observations contribute ice absorption; 7 contribute infrared after clipping exclusions. The exact-USGS brightness comparison is non-diagnostic for absolute alignment; no resolved Odysseus-center claim is made.
