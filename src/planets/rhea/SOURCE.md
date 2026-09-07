# Rhea sources and preparation

Rhea uses the generic object adapter, shared spherical scene, shell, controls and lighting. Its source imagery and terrain model are interpreted during preparation.

## Monochrome and Enhanced color

[USGS Cassini–Voyager mosaic, 2012](https://astrogeology.usgs.gov/search/map/rhea_cassini_voyager_global_mosaic_417m): 11520 × 5760, 416.75190045277 m/pixel, 764.1 km projection sphere. The catalog download link incorrectly points to the older 833 m Voyager map. The pinned `Rhea_Cassini_Voyager_mosaic_global_417m.tif` matches the catalog dimensions and metadata and includes the March 2012 Cassini flyby. Six Voyager images supply north-polar coverage.

The GeoTIFF has center longitude 180° but origin easting zero: its left edge is 180° E. Shared preparation derives the half-width roll from the actual origin. It does not mirror the map. Exactly zero is documented no-data and gets the shared gray grid; other source pixels remain unchanged apart from resampling and delivery compression.

[NASA/JPL PIA18438](https://www.jpl.nasa.gov/images/pia18438-color-maps-of-rhea-2014/): published 2014-11-04, 12015 × 6008, about 400 m/pixel. Cassini ISS colors extend beyond human vision into ultraviolet and infrared. Paul Schenk calibrated, registered and photometrically corrected the observations. The map begins at 0° E and needs no roll. The source's one-pixel departure from 2:1 is resampled to the common layout.

The color map has no separate validity mask, so all published pixels are retained. Hemisphere differences include real surface alteration and E-ring dust. Photographed shadows, image seams and coarse inserts remain; no inpainting, color synthesis or shadow-removal correction is applied. Shared curvature lighting and optional Shadows remain available on every lens.

Independent landmarks: [Tirawa](https://planetarynames.wr.usgs.gov/Feature/6026), 34.2° N, 151.7° W (208.3° E), and [Inktomi](https://planetarynames.wr.usgs.gov/Feature/14671), 14.1° S, 112.1° W (247.9° E). These source positions check map orientation.

## Elevation

[Weirich, Gaskell, Palmer and Domingue (2025), Rhea SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichrheashape.html), NASA PDS, DOI [10.26033/tqxb-q714](https://doi.org/10.26033/tqxb-q714). The original XML label, product description and quality assessment are retained beside the GeoTIFF.

The 2222 × 1111 equirectangular raster stores center-relative radius in meters. Displayed height is `radius * 0.001 - 763.5` km, with a −10 to +10 km color scale. The actual geotransform stops slightly short at the east and south edges. Those narrow strips are marked with the shared gray grid, without extrapolation. All source cells themselves are valid.

The model uses 2719 Cassini images through 2015-02-15. Model spacing is about 2.15 km and the producer estimates typical height uncertainty at 2.15–4.3 km. It is a derived terrain model, not direct imagery. Color represents height; brightness adds fixed northwest relief at true height scale. Geometry stays spherical and shared globe lighting remains active.

The secondary relative-albedo product is not a separate lens: it is coarser than the observations and the producer documents terrain/shadow leakage into it.

## Physical model and delivery

The astronomy package supplies Rhea's Saturn-relative orbit, IAU orientation and 764.5 km rendered mean-radius sphere. [NASA](https://science.nasa.gov/saturn/moons/rhea/) rounds the radius to 764 km. Keep that physical value separate from the 764.1 km monochrome projection sphere and 763.5 km elevation datum. The very tenuous exosphere does not justify a visible halo; proposed rings are not rendered.

All three lenses use the common 8192 × 4096 map layout, 16 projective bands and 1024-pixel pole caps. Prepared surface/pole atlases use WebP quality 90 with lossless alpha; intermediate maps remain lossless. Native observations are downsampled, and larger textures would not increase the terrain model's detail.

`source/manifest.json` pins source URLs, byte counts, hashes and credits. Ignored inputs are downloadable through the shared acquisition recipe; runtime uses prepared assets only. Remote installation remains unproven until the assets are published through the existing publisher.
