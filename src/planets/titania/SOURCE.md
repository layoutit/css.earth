# Titania

Titania uses Paul Schenk's 2020 [Uranian Satellites — Global Mosaics and
DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2
images with updated control networks. The original author's README is retained
in `source/observations/aaReadMe_uranian_MAP_DEM.txt`. The release reference is
[Schenk and Moore (2020)](https://doi.org/10.1098/rsta.2020.0102).

## Selected views

**Monochrome** uses `tumap-cyl-180180.cub`, the registered CLEAR-filter mosaic.
Its recorded `photomet` operation ran on 2020-03-01 with ellipsoid angles,
maximum emission 81°, maximum incidence 89.7°, and no DEM. The external
`eu_pho10.pvl` model file is not part of this release, so this package does not
claim an independently reproduced photometric calibration. The cube history
also includes lowpass and highpass processing. We retain the published product
and apply a linear display stretch from 0–3000 DN to 0–255. Negative valid
samples and bright outliers clip at the display endpoints; they are not turned
into coverage gaps. Photographed shadows, image seams, camera marks, and varying
detail remain. This is a visualization of a corrected observation mosaic,
not newly measured albedo or reconstructed terrain.

**Elevation** uses `tudem-ZL-180180.cub`. The author describes Titania's
image-derived model as stereogrammetry alone, with published limb-profile data
included. It is not Miranda's or Ariel's photoclinometric model. Values are
kilometres relative to the release's reference ellipsoid, not sea level.
The cube's mapping and NAIF radius fields are 788.9 km. The −8 to +8 km color
scale contains the observed numeric extrema, approximately −7.4973 and
+7.9025 km. Preparation adds fixed northwest hillshade using the actual
kilometre-to-metre conversion and latitude-dependent pixel spacing. The
unshaded legend encodes the same numeric scale. Hillshade does not change
elevation, and it does not provide an uncertainty estimate. Stereo noise,
smooth areas, limb-profile interpolation, and source registration errors remain.

Both original cubes have 1722 × 861 single-band, little-endian Real samples,
stored in 287 × 287 tiles. The native simple-cylindrical grid spacing is 2880 m;
this is not uniform effective image or elevation resolution. Labels declare
planetocentric latitude, positive-east longitude, longitude bounds −180…180°,
projection center 180°, equal 788900 m equatorial/polar mapping radii, and
upper-left origin (−4959360, 1241280) m. Shared preparation normalizes the
longitude bounds and samples both products into the application's 0…360° map.
The DEM's final `map2map` history explicitly matches the selected mosaic grid.

Only non-finite values and ISIS special pixels are missing. Complete bilinear
footprints are required at coverage edges. The raw source masks cover
approximately 44.8% of Titania for the mosaic and 27.7% for elevation, with
cosine-weighted source-row estimates recorded in
`source/observations/source-inspection.json`; resampling can slightly reduce
those fractions at boundaries. Gray grid marks real gaps. No missing north or
unmeasured height is filled from neighboring observations or another body.

The shared 452-face sphere uses the astronomy package's 788.9 km mean radius.
Elevation is a scientific color-and-relief view, not displaced geometry. A fixed
6400 × 3200 sampling atlas, 64-pixel gutters, and 1024-pixel pole tiles support
projective texture registration on the retained mesh; the oversized sampling
grid adds no source detail. The same canonical assets are selected independent
of DPR. Both lenses retain shared flood curvature and optional directional
Shadows. Their minimaps and thumbnails use the same prepared interpretation.
The navigation/context marker is an observed terrain crop with prepared
full-phase curvature, not a new full-disc observation.

## Source survey

| Candidate | Disposition |
| --- | --- |
| Schenk/LPI 2020 registered monochrome mosaic | Included as Monochrome: updated control network, numeric validity and documented source correction. |
| Schenk/LPI 2020 stereo plus limb DEM | Included as Elevation with its own coverage, datum, numeric scale and relief. |
| [JPL/USGS Voyager display map](https://space.jpl.nasa.gov/tmaps/uranus.html), 1440 × 720 | Superseded by the registered numeric LPI mosaic; not a duplicate lens. |
| [Nathan, Head and Huber (2024)](https://iopscience.iop.org/article/10.3847/PSJ/ad04d6/pdf), deblurred imagery and geologic mapping | Excluded as a direct mapped replacement. Appendix p. 9 explicitly states that the workflow discards geospatial information and requires registration to another map. The supporting data are paper figures/tables and a processing tutorial; a qualified registered raster was not identified. A future re-registration could improve visual interpretation. |
| [PDS OPUS](https://opus.pds-rings.seti.org/) Voyager frames, including `vg-iss-2-u-c2683649` used by Nathan et al. | Authoritative acquisition archive; selected LPI products already provide controlled mosaicking and DEMs. Reprocessing individual images requires its own calibration/registration evidence. |
| [NASA color composite](https://science.nasa.gov/uranus/moons/titania/) | Useful visual reference, excluded as a map lens: a published disc composite does not establish registered global color coverage. |
| [USGS Gazetteer](https://planetarynames.wr.usgs.gov/Page/TITANIA/target) | Coordinate and nomenclature reference, not a separate observation lens. Named sample locations also appear in Nathan et al. Table A1. |

No complete mapped color, geology or composition lens is claimed. The newer
deblurring/geologic work remains useful for a separately registered view, not
evidence that such information does not exist.

## Reproduction and proof boundaries

Original ISIS3 files are retained byte-for-byte inside deterministic gzip.
The manifest pins compressed and original hashes and names each official
bitstream. Content-addressed source mirrors support automated restoration
without the LPI server's browser challenge. Large source binaries are not
runtime assets. The original release has no explicit license statement; retain
author/mission attribution and the README's advice to consult the author before
scientific analyses. No new license is asserted for these data.

Independent NumPy untile/coordinate samples in `source-inspection.json` check
Ursula, Gertrude, Messina Chasmata, Bona, the zero meridian, southern coverage,
missing northern coverage, and a valid negative mosaic sample. Focused package
tests compare the shared decoder and sampler against those original-source
values. These checks prove numeric registration and coverage handling;
they do not establish mounted visual acceptance or browser conformance.

Physical values and synchronous spin come from the vendored astronomy package,
using JPL satellite elements and IAU/NAIF rotation at the shared epoch.
[NASA's overview](https://science.nasa.gov/uranus/moons/titania/) supplies the
editorial facts. No visible atmosphere or body-specific controller is added.

Restore sources with `node tools/objects/dist/operations.js acquire titania`;
verify with `node tools/objects/dist/operations.js acquire titania --verify-only`.
Prepare through `node tools/objects/dist/prepare-authored.js titania --write`
and the shared navigation/world preparation. Runtime-only installation uses
`pnpm setup:assets --object=titania` and does not need the raw source cubes.
