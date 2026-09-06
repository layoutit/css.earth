# Callisto

Callisto (`504`) is a standalone satellite of Jupiter. The package uses the shared
object runtime, controls, input, camera and lighting contracts.

## Surface

The **Monochrome** lens uses the public-domain USGS
[Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km).
The original GeoTIFF is pinned in `source/manifest.json`: 15,138 × 7,569 pixels,
one 8-bit band, approximately 1 km grid spacing. Original observations range
from 400 m to 60 km per pixel. Coarse observed patches are retained; a fine grid
spacing does not make those patches high resolution.

USGS describes [Lunar–Lambert normalization and linear overlap matching](https://astrogeology.usgs.gov/search/map/callisto_voyager_galileo_image_mosaic_map)
in this mosaic family. We retain that processing. We do not run a second,
unconstrained flattening over a mosaic without its contributing image geometry.
Photographed crater relief and residual seams remain. The shared Shadows control
adds approximate globe illumination; it is available and retains its established
behavior. Shadows off keeps the shared curvature layer. No atmospheric halo is
rendered for the moon's extremely tenuous exosphere.

The GeoTIFF declares `GDAL_NODATA=0`. Only exact zero and pixels whose resampling
footprint includes that no-data are treated as missing. Preparation interpolates
premultiplied validity and withholds partially covered pixels, then paints the
shared neutral gray grid. Nonzero dark terrain stays observed terrain. No texture
or color is invented for gaps. One lens is supplied: no independent globally
mapped color or elevation product has been qualified for this package.

## Coordinates and prepared assets

The source sphere radius is 2,409,300.0488 m. GeoTIFF projected x increases east
from 0° to 360°, centered on 180°; image rows run north to south. This is distinct
from the west-positive longitude *labels* in USGS's older catalog description.
For an independent landmark, [Valhalla](https://planetarynames.wr.usgs.gov/Feature/6284)
is at 14.7° N, 56° W (304° E), on the right side of the source raster. The source
prime meridian constant, 259.51° at J2000, agrees with the vendored IAU model.

Preparation downsamples to an 8,192 × 4,096 lossless map, bakes the projective
latitude bands with proportionally scaled gutters, and prepares 1,024-pixel
polar caps. These are selected once at every DPR. The scene is a mean-radius
sphere, not a measured terrain mesh: the astronomy package supplies 2,410.3 km.
The physical sphere radius and map's original cartographic reference radius
are kept distinct. No relief, bathymetry or interior model is inferred.

The existing astronomy package supplies JPL parent-relative orbital elements,
Jupiter's heliocentric position and IAU rotation at the shared prepared epoch.
The same presentation frame registers the moon, Sun, orbit and astrometric sky.
The orbital period is about 16.69 days and mean distance from Jupiter about
1,883,000 km. [NASA's facts](https://science.nasa.gov/jupiter/jupiter-moons/callisto/facts/)
provide the brief introductory content. A possible subsurface ocean is uncertain.

The Jupiter context photograph is pinned in Callisto's own source closure and
prepared into its own 1,024-pixel asset. Installing Callisto does not require
Jupiter's scene assets. ESO/S. Brunier imagery and the HYG catalogue supply the
same sourced sky as the established moon integration; their licenses are retained.

## Reproduce

- `node src/planets/callisto/tools/acquire.mjs` restores and verifies pinned inputs.
- `node src/planets/callisto/tools/prepare.mjs` prepares the package.
- `node --test src/planets/callisto/test/*.test.mjs` checks source, pixels and runtime.
- `node src/planets/callisto/test/smoke-browser.mjs http://localhost:4232` checks Chrome DPR 1 and 2.
- `pnpm setup:assets --object=callisto` installs the published runtime closure without source preparation.

The original TIFF, font, panorama and parent photograph remain reacquirable,
ignored inputs. Runtime assets are independently described by `runtime-assets.json`.
Publication and isolated installation are separate from local source verification.
