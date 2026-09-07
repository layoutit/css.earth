# Iapetus sources

Iapetus (NAIF 608) uses the generic solid-body contract and the shared shell, camera, controls and lighting. The geometry is a 734.5 km mean-radius sphere from the astronomy package, not a reconstruction of its oblate figure or equatorial ridge.

## Monochrome

[USGS Cassini/Voyager global mosaic, May 2008](https://astrogeology.usgs.gov/search/map/iapetus_cassini_voyager_global_mosaic_803m), 5760 × 2880. The upstream filename says 783m; the catalog and actual GeoTIFF geotransform establish 802.85145591739 m per pixel on a 736 km cartographic sphere. The map contains Cassini images, Voyager polar images and some Saturnshine observations. Exactly zero is the encoded no-data value. Nonzero dark terrain is preserved.

The file is north up, centered on 0 longitude, with raster X increasing eastward. Preparation rolls its 180 E left edge by half a width to the shared 0–360 E texture layout. The source already incorporates the documented 4.5-degree westward IAU longitude correction. Do not shift it again.

## Enhanced color

[JPL PIA18436, 2014-11-04](https://www.jpl.nasa.gov/images/pia18436-color-maps-of-iapetus-2014/), 11741 × 5871, nominal 400 m per source pixel. Paul Schenk selected, calibrated, registered and photometrically corrected the Cassini imagery. Enhanced colors extend beyond human vision into ultraviolet and infrared. The rectangular map starts at 0 E and is north up; it is not mirrored or rolled.

All supplied pixels are preserved because there is no independent validity mask. The dark leading hemisphere is actual surface albedo and is not treated as illumination to normalize away. The bright trailing hemisphere, dark terrain, equatorial ridge and crater patterns agree geographically with the rolled monochrome source. Coarse polar regions, mosaic seams and residual photographed shading remain.

## Presentation and limits

Both sources are resampled into the shared 8192 × 4096 preparation layout; this adds no detail to the 5760 × 2880 monochrome mosaic. Surface and pole atlases use WebP quality 90. Shared curvature lighting and the Shadows control apply to both lenses. No atmosphere, fake elevation, synthetic gap filling or displaced ridge geometry is introduced.

No qualified downloadable height raster was found: the [current PDS SPC archive](https://sbnarchive.psi.edu/pds4/cassini/) has no Iapetus bundle, the [2025 author abstract](https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-115.html) says Iapetus is forthcoming, and the [USGS inventory](https://fdp.astrogeology.usgs.gov/fdp/saturn/) lists older stereo topography as unreleased. These are acquisition findings on 2026-09-06, not a claim that terrain models do not exist.

Physical facts are from [NASA](https://science.nasa.gov/saturn/moons/iapetus/); the astronomy package supplies the Iapetus orbit and IAU rotation. NASA rounds the mean radius to 736 km, while the renderer uses the package value 734.5 km. ESO/HYG sky and Inter title font retain their pinned provenance.

Source byte lengths and SHA-256 values are in source/manifest.json; inputs restore through source/preparation/acquisition.json. The generic authored preparation reproduces prepared/runtime.json and runtime-assets.json.
