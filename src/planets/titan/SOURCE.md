# Titan sources

The first surface lens is **Near-infrared**, Cassini ISS CL1/CB3 at
937.994 nm (9.498 nm bandwidth). It is not visible color. Source:
[Weller et al., USGS 2026 release](https://doi.org/10.5066/P14FAEKS).

The pinned, lossless PNG is the published display export of the controlled
23,048 × 11,524 global mosaic. The accompanying original ISIS label and release
metadata describe the 702 m grid, planetocentric latitude, east-positive
longitude and 2,575,000 m map radius. Center longitude is 180°; the image runs
from approximately 0° to 360° east with north at the top. Grid bounds extend
less than half a source pixel beyond the nominal globe. No longitude mirror or
polar terrain continuation is applied.

The PNG follows the [ISIS display export convention](https://isis.astrogeology.usgs.gov/9.0.0/Application/presentation/Tabbed/isis2std/isis2std.html):
Null is zero and valid dark data starts at one. Only exact zero is withheld,
including a small southern gap; valid dark dunes and lakes are preserved.
Coverage is resampled as alpha before the shared neutral grid is painted.
This interpretation is source-informed: the release does not supply a separate
PNG validity band. The corresponding GeoTIFF header was checked independently
and reports the same grid with ISIS float Null, -3.4028226550889045e38.

USGS already applied weighted mosaicking and a 31 × 31 high-pass filter.
Its display levels and remaining haze, cloud features and patch boundaries are
preserved. The 8,192 × 4,096 prepared map is about 1.98 km per equatorial texel;
the 702 m source grid is not a claim of uniform native image resolution.
Shared globe lighting is approximate and remains controlled by Shadows.

The scene uses the vendored JPL/IAU Titan radius (2,575.5 km), rotation and
Saturn-relative orbit. That physical radius and the source map's reference
sphere are distinct. The small cartographic radius difference does not scale
image features relative to the rendered globe.

## Radar

The Cassini RADAR Team's mission-end MIDR S00 mosaic combines SAR and HiSAR
through flyby T126. The two original gzip PDS3 hemispheres are from the
[Cornell archive](https://data.astro.cornell.edu/RADAR/DATA/MIDR/S00/).
Preparation decodes the attached labels, uses their west-positive longitudes
to place the pixels in our east-positive map, and preserves exact
`MISSING_CONSTANT = 0` coverage. Valid low-backscatter lakes remain observed.
The public label documents incidence-normalized backscatter in logarithmic
form: dB = DN × 0.10000012 − 20.10001. Display brightness retains those byte
levels; it is neither optical albedo nor elevation. Radar speckle and source
swath boundaries remain. Shared globe lighting is an approximate visualization.

The selected archive level is 32 pixels/degree (1.404 km at the equator),
prepared at the shared 8,192 × 4,096 size (1.98 km per equatorial texel).
The archive also has 351 m grids, but those are not the delivered texel density.
Original labels, source dimensions, checksums and acquisition URLs are pinned.

## Other lenses considered

The [2019 VIMS/ISS Enhanced color composite](https://data.caltech.edu/records/8q9an-yt176)
was inspected as a candidate. Its [authors document](https://www.hou.usra.edu/meetings/lpsc2019/eposter/1423.pdf)
filling missing VIMS color with neighboring values and manually removing seams.
The published files do not include a validity mask distinguishing those fills.
It is withheld until observed color coverage can be established; the ISS mask
cannot establish VIMS coverage. Visible haze also needs a suitable observed map.
An orange recoloring of infrared would not be visible imagery.

Facts: [NASA Science](https://science.nasa.gov/saturn/moons/titan/facts/).
Exact input identities, acquisition URLs, credits and consumers are in
`source/manifest.json`; preparation is authored in `object.json` and source JSON.

Delivery uses full-resolution WebP quality 90 for the surface and pole atlases, with lossless alpha. Source observations and preparation maps remain lossless; the latter are excluded from runtime installation.
