# Vesta sources and interpretation

Vesta uses Dawn framing-camera mosaics, spectral ratios and a terrain model in the Claudia coordinate system.

## Sources

| View or quantity | Source |
| --- | --- |
| Visible color | [DLR Dawn HAMO mosaic](https://dawngis.dlr.de/data/Vesta/mosaic_vesta.php) from 650, 550 and 430 nm bands |
| Spectral ratios | [DLR Clementine-style mosaic](https://dawngis.dlr.de/data/Vesta/mosaics/HAMO/clementine/Vesta_clementine_HAMO-1-2_global.jp2), from the original PDS archive |
| Shape and elevation | [DLR HAMO 64-pixel-per-degree terrain model](https://dawngis.dlr.de/data/Vesta/dtm_vesta.php) |
| Physical placement | JPL Horizons solution #36 |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/VESTA/target) Vesta centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The record describes source decoding, registration and mesh reduction, but cites no dated test or browser-run report. Archive and release links are in the source survey below.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Vesta (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (this export ships no projection file, so the metadata datum is recorded and the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 9 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- The visible mosaic has clipped bright terrain and registration artifacts. The black-pixel mask is a heuristic that can hide valid dark pixels.
- Spectral ratios are not mineral-abundance measurements.
- Terrain values are radii, despite contradictory generic label wording. Polar interpolation is not independent stereo coverage.
- The 8 km simplification allowance is an approximation, not an error bound or source uncertainty. Placement uses osculating elements with limited temporal validity.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Source survey and selected products</summary>

Vesta is an asteroid. Its package uses the shared object contract, shell,
world camera, authored preparation, and retained CSS renderer.

## Source survey

| Candidate | Decision |
| --- | --- |
| [DLR Dawn HAMO natural color](https://dawngis.dlr.de/data/Vesta/mosaic_vesta.php) | Included. Calibrated and photometrically corrected 650/550/430 nm composite. The 26,704 × 13,080 PNG retains the publisher's bright-terrain clipping and some registration artifacts. |
| DLR HAMO corrected monochrome | Complementary candidate, excluded from this selection: natural color supplies the same broad surface interpretation; a separate grayscale view would duplicate it. |
| [DLR HAMO Clementine ratios](https://dawngis.dlr.de/data/Vesta/mosaics/HAMO/clementine/Vesta_clementine_HAMO-1-2_global.jp2) | Included from the publisher's original PDS ZIP. The three byte planes preserve the published 26,703 × 13,351 Clementine-style ratio composite. JP2 decoding is unnecessary. Ratios emphasize spectral differences, not mineral abundance. |
| [DLR Dawn HAMO 64 ppd terrain](https://dawngis.dlr.de/data/Vesta/dtm_vesta.php) | Included. 23,041 × 11,521 big-endian float grid, about 69.5 m spacing. The release page explicitly defines values as radii in meters. |
| [USGS 48 ppd terrain and relief](https://astrogeology.usgs.gov/search/map/vesta_dawn_fc_hamo_global_dtm_93m) | Excluded in favor of the higher-resolution DLR release and its original coordinate system. |
| [Le Corre et al. 2017 controlled color mosaics](https://www.hou.usra.edu/meetings/metsoc2017/pdf/6135.pdf) | Unresolved. The conference abstract describes improved registration and planned PDS delivery; this survey has not located a downloadable release corresponding to that work. |
| [NASA VIR mineral map](https://science.nasa.gov/photojournal/global-mineral-map-of-vesta/) | Excluded: a small explanatory press visualization, not the calibrated global scalar grid needed for a quantitative lens. |

</details>

<details>
<summary>Coordinates, coverage and spectral interpretation</summary>

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

## Spectral ratios

The Clementine-style display uses the DLR composite unchanged: red is 749/438 nm,
green is 749/917 nm, and blue is 438/749 nm. These are ratios of photometrically
corrected Dawn FC images, not true colors or calibrated mineral fractions.
No ratios, contrast stretches or color balancing are recomputed by cssEarth.

The 446,346,023-byte archive misleadingly names its member
`Ceres_clementine_HAMO-1-2_global.pds`; the attached label explicitly identifies
**VESTA**, DLR, the 255 km projection radius and the expected Claudia grid.
`source/reference/clementine.lbl` preserves that label unmodified. The byte
image begins at record 4 (80,109 bytes), with three band-sequential RGB planes.
The complete member is 1,069,615,368 bytes. The decoder checks target, encoding,
dimensions, exact projection offsets and complete extraction before rendering.

As in the existing natural-color view, exact all-channel black is treated as
likely fill before interpolation; the source supplies no independent validity
mask. This can also withhold photographed black. Single-channel zero is valid.
Original mosaic seams, color fringes and dark nonzero samples are retained.
The same 74.176493209759 pixels/degree and offsets 13351 / 6675 place this view
on the existing terrain. Missing coverage uses the common gray grid.

</details>

<details>
<summary>Physical registration and prepared display</summary>

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

The original radial model is sampled on a 64 × 128 grid into 16,128 source
triangles. Meshoptimizer 1.2.0 welds and compacts equal positions, then simplifies
that mesh to 800 retained triangles before texture and lighting preparation.
The `ErrorAbsolute` and `RegularizeLight` flags bound the estimated error and
discourage thin triangles; the source profile records the 8 km error limit.
This is the simplifier's approximate metric, not a guaranteed maximum surface
distance. The selected vertices retain their sampled source positions, with
one canonical vertex at each pole. Normals are recomputed for the final mesh.
See the [upstream simplifier documentation](https://github.com/zeux/meshoptimizer/blob/v1.2/js/README.md#simplifier).
Lighting leaves those positions unchanged; area-weighted vertex normals provide continuous
directional shading. The 8,192 × 4,096 normalized maps are sampled into fixed
2,048 × 6,400 atlases. PolyCSS prepares native `u` triangles in raster mode:
each leaf matches its 128 × 128 texel cell, with the inverse matrix scale
preserving the measured geometry. The cells are opaque; the native triangle
primitive supplies their boundary. Runtime mounts the prepared leaves and
does not construct geometry or lighting.

Natural color, spectral ratios and elevation each have an unlit and a fixed-epoch directional
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

</details>
