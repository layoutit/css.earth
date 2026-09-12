# Titania

Titania uses Voyager 2 mosaics and terrain reconstruction, plus digitized historical geology.

## Sources

| View or quantity | Source |
| --- | --- |
| Monochrome and elevation | [Schenk's 2020 mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), described by [Schenk and Moore (2020)](https://doi.org/10.1098/rsta.2020.0102) |
| Geologic categories | [Thomson and Baynham (2026)](https://zenodo.org/records/20819132), digitized Voyager-era interpretations |
| Physical placement and spin | JPL satellite elements and IAU/NAIF rotation |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/TITANIA/target) Titania centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

Lane change (this PR): the terrestrial solid-observation lane was retired for Titania; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — native ISIS cube 1722 × 861; the retired 6400 × 3200 atlas was an upsample. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js titania --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/titania/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, elevation, geology) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 2150).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

The [retained source inspection](source/observations/source-inspection.json) provides independent NumPy coordinate and value samples. Geology registration uses held-out crater checks. These address numeric registration and coverage; no dated browser acceptance is cited.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Titania (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Gertrude and Messina Chasmata on the prepared minimap (±180° cylindrical cube) coincide with the imagery.

Feature notes: 5 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Approximate source coverage is 44.8% for monochrome and 27.7% for elevation before interpolation; the unobserved north stays missing.
- Monochrome processing depends on an unavailable photometric parameter file. DN values are not calibrated albedo.
- Terrain spacing is not accuracy; stereo noise and mapping artifacts remain. Geology records historical interpretations, not measured composition.
- The mosaic/DEM release states no explicit license. Its author asks to be consulted before scientific analysis.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Voyager observations, processing and coverage</summary>

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

</details>

<details>
<summary>Historical geology and registration method</summary>

## Historical geology

**Geology** uses Thomson and Baynham's [2026 digitized historical map](https://zenodo.org/records/20819132), released under CC BY 4.0. The exact GIS database, layer styles, publisher preview and release metadata are retained in `source/science/geology-2026/`. This is an interpretation of Voyager-era surface units, not measured composition, a new terrain model or newly controlled imagery.

The archive stores page-sized XY coordinates under an incompatible Earth WGS84 orthographic CRS. Preparation does not apply that declaration as moon geography. The independently reviewed `registration.json` maps positive-east, normalized south-polar stereographic coordinates into the original GIS page. Titania uses six identified crater centroids for fitting and four separate named craters for validation. Miranda uses six publisher-graticule intersections for fitting and six interleaved intersections for validation, followed by three independently identified crater checks. The checked Titania landmark differences are 0.33–0.83° (approximately 4.5–11.4 km); these are not uncertainty bounds for every unit boundary.

The lens includes 10 nonempty styled polygon categories with their original unit names and colors. Source Z coordinates are not heights. Structural linework and annotation are not turned into terrain or extra polygon units. Publisher-preview overlap evidence establishes only a partial layer order; combinations with no unique supported winner remain missing. Original polygon holes are preserved. The nearest-neighbor categorical conversion uses a 1440 × 720 display grid, with no interpolation between classes, relief or artificial boundary detail. Valid black material is distinct from no-data code 65535. Its sampled, cosine-weighted reference-sphere coverage is approximately 35.3%; unmapped northern terrain remains unknown.

Reproduce the categorical input with `python tools/objects/prepare-geologic-categories.py src/planets/titania/source/preparation/geology-conversion.json`, using the dependency versions in the converter's header. The recipe pins the archive and registration, checks feature populations and archived CRS identity, and records ambiguous overlaps and the exact output hash in `categories.receipt.json`. Original release MD5 and acquisition SHA-256 receipts remain alongside the sources. Shared preparation then consumes the checked-in categorical input through the existing scientific GeoTIFF path. The runtime receives prepared images only.

</details>

<details>
<summary>Source survey and alternatives</summary>

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

No complete mapped color or composition lens is claimed. The historical Geology view retains its own mapped coverage and registration limits; it does not turn the newer deblurring study into a registered observation product.

</details>

<details>
<summary>Source restoration, checks and limits</summary>

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

Shared acquisition, preparation and installation commands are in the
[contributor guide](../README.md).

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 788.9 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 8.7065-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 30.03° initial pitch, -26.72° yaw, taken from the retired lane's camera). The heliocentric view keeps the orbit around Uranus and the parent marker now comes from the shared navigation atlas.

</details>
