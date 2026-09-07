# Tethys sources and preparation

Tethys uses the shared object adapter, application shell, spherical scene and lighting. All image resampling and source projection happen during preparation.

## Photographic lenses

- [USGS / Cassini 2012 monochrome mosaic](https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m): 11520 × 5760, about 293 m per pixel on a 536.3 km reference sphere. The GeoTIFF is north-up, equirectangular with center longitude 0°. Preparation rolls its 180° E left edge by half a width into the shared 0–360° E map. GeoTIFF no-data is exactly zero; missing observations use the shared gray grid. All nonzero values are retained.
- [NASA/JPL 2014 enhanced-color map, PIA18439](https://www.jpl.nasa.gov/images/pia18439-color-maps-of-tethys-2014/): the full 13467 × 6734 JPEG, approximately 250 m per source pixel. Infrared, green and ultraviolet observations make this enhanced color, beyond human vision. The producer calibrated, registered and photometrically corrected the observations. The map starts at 0° E, north-up, and is not rolled. The published display mosaic has no separate validity mask: dark terrain is not classified as missing coverage.

Native detail varies across both mosaics. Published image seams, coarse inserts and residual photographed shading remain. In particular, enhanced-color hemisphere differences can represent real surface alteration by dust and radiation, and are not removed as artificial shadows. No inpainting, polar repetition or color synthesis is applied. Different source control networks can leave local registration differences.

Odysseus lies near 30° N, 230° E; [Ithaca Chasma](https://planetarynames.wr.usgs.gov/Feature/2751) is centered near 14° S, 353.9° E. These provide independent checks of orientation and longitude registration.

## Elevation

[Weirich, Gaskell, Palmer and Domingue (2025), Tethys SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichtethysshape.html), NASA PDS, DOI [10.26033/hpv0-eh61](https://doi.org/10.26033/hpv0-eh61). The original product description and XML labels are retained alongside the numeric GeoTIFFs.

The global model is supplied as three grids: a 2222 × 679 equirectangular map spanning 55° S–55° N and two 444 × 444 polar stereographic maps. Preparation samples each original geotransform and uses the polar grids at higher latitudes. It honors actual raster bounds and no-data values; the equatorial map is never stretched over the poles and gaps are not extrapolated. The polar rectangles fall slightly short of their nominal 55° limit near cardinal longitudes, leaving narrow source gaps that use the shared gray grid.

Global values are center-relative radius in meters, unlike the archive's regional height products. The displayed quantity is `radius * 0.001 - 531`, height in kilometers above the source's 531 km reference sphere. Color spans −12.5 to +12.5 km. Brightness shows northwest cartographic relief at true height scale. The shared curvature overlay and optional directional Shadows remain active on this lens too.

The source model spacing is about 1.5 km. The producer estimates typical global DTM accuracy at one to two grid spacings (1.5–3 km), worse where source imagery is coarser. A larger prepared texture adds no measured terrain detail. Elevation colors include broad departures from the reference sphere; rendered geometry remains spherical.

## Geometry, delivery and scope

The astronomy package provides the Saturn-relative orbit and IAU orientation. The rendered sphere uses its 536.3 km radius, also used by the [2012 Tethys atlas](https://science.nasa.gov/resource/the-tethys-atlas/). This is distinct from the 531 km elevation datum and NASA's rounded 533 km mean radius in the factsheet. [NASA](https://science.nasa.gov/saturn/moons/tethys/) describes a mildly nonspherical body; its exact silhouette and crater depth are not modeled here.

All three lenses use the shared 8192 × 4096 map layout, 16 projective bands and 1024-pixel pole caps. Terminal surface and pole atlases use WebP quality 90 with lossless alpha. Sources and intermediate maps retain their original detail; only prepared files reach runtime. No visible atmosphere or cutaway is added.

Pinned files, URLs and hashes are in `source/manifest.json`; acquisition and preparation use the shared authored-object pipeline.
