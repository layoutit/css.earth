The WAC global mosaic is comprised of over 15,000 images acquired from
December 2009 through January 2011. The WAC maps the whole Moon in one month,
however the solar incidence angle at the equator changes about 28 degrees from
the beginning to the end of the month. To even out the incidence angle
variations, the mosaic is comprised of data collected over three periods
(2010-01-20 to 2010-01-28, 2010-05-30 to 2010-06-06, 2010-07-24 to 2010-08-07)
(Table 1). Some gores were filled with data taken at other times between
2009-12-10 and 2011-01-31; complete image lists for each 100 m/px tile can be
downloaded separately. The non-polar images were map projected onto the GLD100
(WAC derived 100m/pixel DTM) while polar images were map projected on the LOLA
shape model (80 to 90 degrees N/S) and the GLD100 (60 to 80 degrees N/S).
Accurate positioning of each WAC image was ensured using ephemeris provided by
the LOLA and GRAIL team and an improved camera geometry model [1]. To reduce
brightness discrepancies across image boundaries, all images were corrected to
a common photometric geometry using a Hapke model with model parameters varying
across the Moon [2]. This mosaic uses only the 643 nm band of the WAC.

The WAC global mosaic is archived in ten regional tiles at three different
resolutions: 100 meters/pixel, 256 pixels/degree, and 128 pixels/degree. Eight
of the tiles are equirectangular projections that encompass 60 degrees latitude
by 90 degrees longitude (for the 128 pixels/degree products, these tiles extend
from the equator to the pole). The remaining two tiles are polar stereographic
projections for each pole from 60 degrees to the pole.

Lower resolution products (at 64, 32, 16, 8, and 4 pixels/degree) are available
in single global equirectangular tiles, centered at either 180 or 0 degrees
longitude (longitude ranges from 0 to 360 degrees and -180 to 180 degrees,
respectively, and latitude range always from -90 to +90 degrees). Additionally,
orthographic products are available at all resolutions showing the hemispheres
centered at the equator at 0, 60, 120, 180, 240, and 300 degrees longitude, and
the polar tiles described above are also available at all resolutions. Each
file is named with the following pattern (see Table 1 for examples):
 WAC_GLOBAL_[E|P]###[N|S]????_***[M|P]
where:
 [E|P] indicates the map projection (E=Equirectangular or P=Polar Stereographic)
 ###[N|S] indicates the center latitude in 1/10th degrees North (N) or South (S)
 ???? indicates the center longitude in 1/10th degrees East
 ***[M|P] indicates the scale in meters/pixel (M) or pixels/degree (P)

Low-resolution 8-bit browse products in PNG format for this product, along with 
full-resolution 8-bit GeoTIFFs, are available at the following location, with 
names matching those of the full-resolution IMG files:
http://lroc.sese.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/WAC_GLOBAL/

When citing this product, use the following reference, but see [3] for a brief
summary of updates made in 2014:
Speyerer, E. J., Robinson, M. S., Denevi, B. W., & LROC Team. (2011).
    Lunar Reconnaissance Orbiter Camera Morphological Map of the Moon.
    In Lunar and Planetary Science Conference (Vol. 42, abstract #2387).
    https://www.lpi.usra.edu/meetings/lpsc2011/pdf/2387.pdf


Table 1: Parameters of the ten full-resolution WAC_GLOBAL tiles.
                      Lat. Range   Lon. Range                         Beta Angle   Solar
Product Name           (degrees)   (degrees)         Date Range       Range (deg) Azimuth
WAC_GLOBAL_E300N0450    0 to 60     0 to 90   2010-07-24 to 2010-07-31   60-66     West
WAC_GLOBAL_E300S0450  -60 to 0      0 to 90   2010-07-24 to 2010-07-31   60-66     West
WAC_GLOBAL_E300N1350    0 to 60    90 to 180  2010-01-20 to 2010-01-28   61-69     West
WAC_GLOBAL_E300S1350  -60 to 0     90 to 180  2010-01-20 to 2010-01-28   61-69     West
WAC_GLOBAL_E300N2250    0 to 60   180 to 270  2010-05-30 to 2010-06-06   61-69     East
WAC_GLOBAL_E300S2250  -60 to 0    180 to 270  2010-05-30 to 2010-06-06   61-68     East
WAC_GLOBAL_E300N3150    0 to 60   270 to 360  2010-07-30 to 2010-08-07   55-61     West
WAC_GLOBAL_E300S3150  -60 to 0    270 to 360  2010-07-30 to 2010-08-07   53-61     West
WAC_GLOBAL_P900N0000   60 to 90     0 to 360   All above date ranges     53-69      --
WAC_GLOBAL_P900S0000  -90 to -60    0 to 360   All above date ranges     53-69      --

For more information on LROC Reduced Data Records (RDRs), please refer to the
Software Interface Specification (SIS):
http://lroc.sese.asu.edu/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DOCUMENT/RDRSIS.PDF

[1] Speyerer, E. J., Wagner, R. V., Robinson, M. S., Licht, A., Thomas, P. C.,
    Becker, K., Anderson, J., Brylow, S.M., & Tschimmel, M. (2016). Pre-flight
    and on-orbit geometric calibration of the Lunar Reconnaissance Orbiter
    Camera. Space Science Reviews, 200(1-4), 357-392.
    https://doi.org/10.1007/s11214-014-0073-3

[2] Sato, H., Robinson, M. S., Hapke, B., Denevi, B. W., & Boyd, A. K. (2014).
    Resolved Hapke parameter maps of the Moon. Journal of Geophysical Research:
    Planets, 119(8), 1775-1805.
    https://doi.org/10.1002/2013JE004580

[3] Wagner, R. V., Speyerer, E. J., Robinson, M. S., & LROC Team. (2015).
    New Mosaicked Data Products from the LROC Team. In Lunar and Planetary
    Science Conference (Vol. 46, abstract #1473).
    https://www.hou.usra.edu/meetings/lpsc2015/pdf/1473.pdf
