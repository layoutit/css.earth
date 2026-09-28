# Preparing numeric USGS surface maps

The Moon, Venus, Mercury and Mars use compact numeric derivatives of selected
[USGS Astrogeology products](https://astrogeology.usgs.gov/search). Each native
product has a checked acquisition recipe and its detached publisher labels under
the body's `source/science/usgs/`. Body READMEs identify the releases, units,
calibrations and scientific limits.

## Reading the maps

Each dataset's short description explains the quantity before naming its
method. The legend gives the units and marks missing coverage; the body README
and linked source records explain the method and limits. A mineral percentage is by weight;
an elevation needs a stated zero level; a model index is not an age or a
temperature. The scientific names remain in the labels and legends so
readers can trace them to the source.

For the lunar mineral descriptions, see NASA's
[Exploring the Moon teacher's guide](https://science.nasa.gov/wp-content/uploads/2024/01/exploring-the-moon-teachers-guide.pdf)
and [Mineral Mapping the Moon](https://science.nasa.gov/photojournal/mineral-mapping-the-moon/).
The latter provides a familiar example: plagioclase also occurs in granite on
Earth. These explain the geology; the Kaguya release and its method paper own
the values shown here. The source and processing details remain in the body
README and linked source records.

## Acquisition and display

The shared [GeoTIFF grid operator](../packages/bake/src/objects/acquisition/geotiff-grid.ts)
checks native dimensions, encoding, missing value, projection, radius, origin and
pixel spacing. It requires bounded HTTP range responses and a stable entity tag
or modification date. Eight workers read at most eight MiB of decoded native
tiles per row each. The output is bounded to 16,777,216 cells; these recipes use
2,048 × 1,024. Whole native files do not have to fit in memory or on disk.

Each output pixel takes the native cell containing its geographic center.
Longitude increases eastward from −180° at the left edge; north is at the top.
The operator preserves native sample values exactly as float32, rejects a lossy
numeric conversion, and writes −99,999 for missing cells. It neither averages
nor extrapolates. Sparse display sampling loses native spatial detail: a
2,048-wide display is not a 59 m lunar map or a 665 m Mercury DEM.

The acquisition plan first tries the body/path source cache. On a miss, it
recreates the compact grid from the original product. The numeric file is an
untracked input; the checked recipe and source manifest remain in Git.
Prepared display images follow the normal runtime inventory and R2 publication
contract. No archive decoding or map generation occurs in the browser.

The raster recipe owns native-to-display units, colors and quality masks.
Colors and numeric legends use the same palette and range; endpoint colors
include values beyond a displayed stretch when the legend marks that limit.
Numeric maps, pole sprites and thumbnails stay lossless. Missing coverage uses
the shared gray grid. Scientific views keep the existing body geometry and
lighting controls; colors do not displace the surface.

Mercury's existing angular pole layout accepts interpreted numeric pixels at
its canonical source dimensions. Preparation avoids a second resize and keeps
its photographic path and polar coordinate convention. The
[raster tests](../packages/bake/src/raster/surfaces.test.ts) compare the retained
photographic bytes and check the numeric palette through every companion image.

## Independent checks

[The native-byte oracle](../tests/oracles/isis-geotiff-grid.mts) computes sample
coordinates and byte offsets from the detached ISIS label, then decodes native
values with `DataView`. It does not call the acquisition mapper or native
GeoTIFF reader. It checks both hemispheres, the longitude seam, extrema, valid
zeros and interior gaps when present. A consuming raster recipe also checks
physical values against the label's scale and offset; a separate unit factor
converts fractions to percentages.

For example, the Mercury check takes these arguments:

```sh
node tests/oracles/isis-geotiff-grid.mts \
  src/objects/mercury/source/science/usgs/elevation.json \
  src/objects/mercury/source/science/usgs/elevation-isis.lbl \
  src/objects/mercury/source/science/usgs/elevation.tif \
  output/mercury-native-check.json \
  src/objects/mercury/source/preparation/raster.json
```

Venus roughness has a conflicting detached-label multiplier. Its retained
[calibration record](../src/objects/venus/source/science/usgs/roughness-calibration.json)
cites the original PDS equation and the corroborating USGS catalogue. Pass that
record after a unit factor of `1` to reproduce the resolved comparison; retain
the failed label-only comparison as evidence of the conflict.

These checks qualify decoding, placement and unit conversion at sampled cells.
They do not establish instrument accuracy, validate a spectral inversion, or
check every native pixel. Rendered coverage, appearance and interaction require
separate browser inspection, recorded beside each body.
