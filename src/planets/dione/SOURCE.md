# Dione sources and preparation

Dione uses the shared object adapter, source-mesh scene, application shell, controls and lighting. Source projection and image processing happen during preparation.

## Photographic lenses

- [USGS Cassini–Voyager global mosaic](https://astrogeology.usgs.gov/search/map/dione_cassini_voyager_global_mosaic_154m): 2010 edition, 23040 × 11520, about 154 m per source pixel on a 563 km cartographic sphere. Its equirectangular GeoTIFF has center longitude 0° and eastward raster x. Preparation rolls the 180° E left edge by half a width; it does not mirror the image. Exactly zero is documented no-data and receives the shared gray grid. Other values remain observed terrain, including shadows. Source resolution varies; Voyager images fill some Cassini gaps.
- [NASA/JPL enhanced-color map PIA18434](https://www.jpl.nasa.gov/images/pia18434-color-maps-of-dione-2014/): 2014, 14134 × 7067, about 250 m per source pixel. Ultraviolet and infrared extend the colors beyond human vision. Paul Schenk calibrated, registered and photometrically corrected the contributing images. The north-up map starts at 0° E and is not rolled. There is no separate validity mask: all published pixels are preserved. Hemisphere differences reflect surface alteration and E-ring dust as well as residual photographed shading; they are not removed as shadows.

Different control networks, photographed shadows, seams and coarse inserts remain. No inpainting, synthetic color, polar repetition or patch correction is applied. The shared curvature overlay and optional directional Shadows operate on both lenses.

Independent landmarks: [Palinurus](https://planetarynames.wr.usgs.gov/Feature/4555) at 3.3° S, 63° W (297° E), and [Janiculum Dorsa](https://planetarynames.wr.usgs.gov/Feature/14379) near 24.6° N, 144.1° W (215.9° E). Bright trailing-hemisphere fractures lie near 90° E. These check orientation across the source maps.

## Elevation

[Weirich, Gaskell, Palmer and Domingue (2025), Dione SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichdioneshape.html), NASA PDS, DOI [10.26033/bxx6-g543](https://doi.org/10.26033/bxx6-g543). The original product description and XML labels are retained with the three GeoTIFFs.

The 2222 × 679 equatorial map spans 55° S–55° N; two 444 × 444 polar stereographic maps provide higher latitudes. Shared preparation samples each actual geotransform, honoring raster bounds and documented latitude limits. Small gaps near the 55° joins remain marked rather than extrapolated.

Global values are center-relative radius in meters. Displayed elevation is `radius * 0.001 - 561.4` km, with a −7.5 to +7.5 km color scale. Brightness adds northwest relief at true height scale. The shared globe lighting and Shadows remain available. Geometry follows a simplified source mesh.

Model spacing is about 1.58 km. The producer’s one-to-two-grid-spacing accuracy estimate derives from simulation experience, not independent per-cell Dione uncertainty. Increasing texture dimensions adds no terrain detail. This release includes roughly 1040 additional images compared with the previous archived model, through June 2017.

## Geometry and delivery

The astronomy package supplies the Saturn-relative orbit, IAU orientation and 562.5 km display scale reference. [NASA](https://science.nasa.gov/saturn/moons/dione/) rounds the mean radius to 562 km. Keep this physical radius distinct from the monochrome map's 563 km projection sphere and elevation's 561.4 km datum. The elevation colors and source-mesh silhouette are separate products with distinct resolutions. No visible atmosphere or cutaway is added.

Map preparation uses the shared 8192 × 4096 intermediate layout and 1024-pixel pole products. The final source-mesh scene samples these maps into prepared per-triangle atlases. Surface/pole atlases use WebP quality 90 with lossless alpha; intermediate maps remain lossless. The 23K monochrome and 14K color sources are downsampled to this common delivery layout.

Pinned URLs, source bytes and hashes are in `source/manifest.json`. The shared acquisition recipe restores every large source; runtime uses prepared assets only. Remote runtime installation remains unproven until these new assets are published through the existing publisher.

## B2 source shape and relative albedo

The native global Q128 OBJ is 98,306 vertices and 196,608 triangles in kilometres, north along +Z and longitude zero along +X. Exact source topology is retained before simplification. Preparation uses the measured candidate of 2,000 faces with regularize:false, under a 5,614 m display approximation ceiling (1% of the model reference radius). This is a display approximation budget, not scientific uncertainty. The closed candidate has Euler characteristic 2, one component and 2,000 faces. Its 8,000 one-way barycentric source-distance samples have maximum 4851.62 m, 95th percentile 2463.15 m and RMS 1298.41 m. These samples do not establish a full Hausdorff bound. Geographic registration, silhouette and feature review remain pending. The original photographic-map projection radii remain separate from shape geometry and the numeric elevation datum.

New relative albedo uses the published 2025 GeoTIFFs and their original equatorial/polar projections. Values are dimensionless and normalized around 1; the archive gives a nominal 0–2 domain. The visible 0.5–1.5 scale saturates above 1.5. No height conversion or relief shading is applied to this quantity. It is a secondary SPC brightness product, less validated than topography, and is neither geometric albedo nor calibrated reflectance. Tethys used uncalibrated ISS inputs; Dione and Rhea used calibrated frames. Source sigma is internal maplet agreement, not absolute height uncertainty.

The Shape lens uses the shared neutral grid over the source mesh to distinguish geometry from imagery. The Photographic views retain pre-existing image seams, shadows and local control differences. Source reference radii and projections do not become spherical geometry constraints. The original Q128 spacing is about 6.32 km; finer numeric maps do not imply the simplified silhouette retains that full detail.

Qualification status: source intake and recipe proposal. Final mesh selection (where applicable), restored-source and prepared browser/visual gates remain pending. No readiness is claimed.
