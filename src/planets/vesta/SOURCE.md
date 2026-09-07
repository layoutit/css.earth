# Vesta sources and interpretation

Vesta is an asteroid. Its package uses the shared object contract, shell,
world camera, authored preparation, and retained CSS renderer.

## Source survey

| Candidate | Decision |
| --- | --- |
| [DLR Dawn HAMO natural color](https://dawngis.dlr.de/data/Vesta/mosaic_vesta.php) | Included. Calibrated and photometrically corrected 650/550/430 nm composite. The 26,704 × 13,080 PNG retains the publisher's bright-terrain clipping and some registration artifacts. |
| DLR HAMO corrected monochrome | Complementary candidate, excluded from this selection: natural color supplies the same broad surface interpretation; a separate grayscale view would duplicate it. |
| [DLR HAMO Clementine ratios](https://dawngis.dlr.de/data/Vesta/mosaics/HAMO/clementine/Vesta_clementine_HAMO-1-2_global.jp2) | Deferred. The 651,737,045-byte JP2 was downloaded and its 26,703 × 13,351 dimensions checked, but the project's portable image decoder does not support this container. No calibrated ratio lens is claimed. The ratios emphasize spectral differences, not mineral abundance. |
| [DLR Dawn HAMO 64 ppd terrain](https://dawngis.dlr.de/data/Vesta/dtm_vesta.php) | Included. 23,041 × 11,521 big-endian float grid, about 69.5 m spacing. The release page explicitly defines values as radii in meters. |
| [USGS 48 ppd terrain and relief](https://astrogeology.usgs.gov/search/map/vesta_dawn_fc_hamo_global_dtm_93m) | Excluded in favor of the higher-resolution DLR release and its original coordinate system. |
| [Le Corre et al. 2017 controlled color mosaics](https://www.hou.usra.edu/meetings/metsoc2017/pdf/6135.pdf) | Unresolved. The conference abstract describes improved registration and planned PDS delivery; this survey has not located a downloadable release corresponding to that work. |
| [NASA VIR mineral map](https://science.nasa.gov/photojournal/global-mineral-map-of-vesta/) | Excluded: a small explanatory press visualization, not the calibrated global scalar grid needed for a quantitative lens. |

## Coordinates and coverage

The DLR products retain Dawn Claudia east-positive, planetocentric coordinates.
They must not be silently mixed with USGS maps shifted into Claudia Double Prime.
`reference/true-color.lbl` is the verbatim attached PDS label extracted from
the corresponding DLR PDS ZIP. The PNG has the same dimensions. Its projection
offsets and 74.176493209759 pixels/degree locate the cropped rows; stretching
the entire PNG from pole to pole would misregister the map.

The natural-color PNG carries no alpha or validity mask. Exact RGB black is
treated as likely fill before resampling, and out-of-crop coordinates are
missing. This heuristic cannot distinguish every photographed black shadow
from missing data. Uncertain nonzero colors and channel fringes remain intact.
The shared gray grid marks only the declared missing samples.
The published image's border also leaves a narrow missing strip at longitude
zero. It is retained rather than filled with invented surface detail.

The terrain ZIP contains `Vesta_HAMO_dtm_global_64.pds`. Its generic attached
label describes heights above a reference surface, but the actual values
are about 200–300 km and the DLR release explicitly says **radii in meters**.
The package follows the release and actual numeric range, preserving the
original archive and conflicting label. Missing code is −32768. Published
polar interpolation has no separate validity mask; model-derived views must
disclose that those regions are not independent stereo observations.

## Physical registration

JPL Horizons solution JPL#36 supplies mean radius 261.385 km, GM 17.28828
km³/s², and the asteroid's heliocentric elements. `generate-asteroids.mjs`
records reproducible Horizons queries and independent vector fixtures.
The geometry epoch is the shared 2026-09-04T00:00:00 TT. The osculating ellipse
does not claim accurate long-term perturbed motion. Horizons TDB epochs are
approximated as TT, differing by less than 2 ms.

DLR's mapping rotation uses pole RA 309.03312°, declination 42.22623°,
W = 74.66250° + 1617.3331237° × days since J2000. These coefficients belong to
the body package and are evaluated only during shared preparation.

The shared ESO/HYG sky and pinned Inter title font keep their original source
credits. Required binaries are restored through `source/preparation/acquisition.json`.

## Prepared presentation

The original radial model supplies 1,840 retained triangles. Their positions
are unchanged by lighting; area-weighted vertex normals provide continuous
directional shading. The 8,192 × 4,096 normalized maps are sampled into fixed
2,048 × 14,720 atlases. PolyCSS prepares native `u` triangles in raster mode:
each leaf matches its 128 × 128 texel cell, with the inverse matrix scale
preserving the measured geometry. The cells are opaque; the native triangle
primitive supplies their boundary. Runtime mounts the prepared leaves and
does not construct geometry or lighting.

Natural color and elevation each have an unlit and a fixed-epoch directional
lighting bank. This approximates diffuse illumination, without cast shadows
or reflected light. Elevation also has northwest cartographic relief, so its
brightness is not a second physical measurement. Orientation stays fixed at
the shared date; the package does not supply automatic body rotation. Drag,
zoom, surface fly-to, and world navigation use the shared camera. Surface hit
eligibility uses the actual prepared mesh; the shared fly-to trajectory remains
a trackball approximation.

The checked-in navigation image is reproduced from the same source map and
mesh by `radial-snapshot.mjs`, using the recipe in `source/manifest.json`.
Full preparation verifies its bytes before publishing scene assets.
