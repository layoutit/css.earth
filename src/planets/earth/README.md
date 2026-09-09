# Earth

Route: `/earth/`. Archival global imagery, scientific maps and prepared geographic detail.

## Sources

| What is shown | Source and treatment | Limits |
| --- | --- | --- |
| Surface | NASA Blue Marble Next Generation, July 2004, from the pinned 21,600 × 10,800 cloud-free JPEG. Preparation applies a display-only midtone lift. | Archival imagery. The brightness adjustment is not radiometric calibration. |
| Clouds | NASA Blue Marble Clouds, from the pinned 8,192 × 4,096 TIFF. | A separate source product, not current weather or a simultaneous observation with every surface layer. |
| Elevation | GEBCO_2026 numeric land, ice-surface and seafloor height data, prepared as a scientific map. | See the source record for the datum, coverage, sampling and display choices. |
| Night lights | NASA Black Marble VJ146A4 Collection 2, 2025 annual snow-free radiance, from Jurij Stare's public numerical mosaic. Numeric samples are area-averaged and shown with a logarithmic color scale. | Coverage is 75° N–65° S. The mirror lacks quality bands. This is neither live lighting nor ground-level sky brightness. |
| Atmosphere | OpenSpace's Earth atmosphere parameters supply the physical model; recorded presentation parameters control its appearance. NASA PSG supplies the spectral and vertical-profile charts. | Prepared model output. Display choices and normalized response metadata are described in SOURCE. |
| Geographic detail | Prepared geometry and the corresponding Terrascope WMTS imagery pages. | A global dataset name does not show that every remote page is available. |

The annual night-light product is `VJ146A4.002`, year 2025. Its floating-point
values come from an already processed annual radiance product; “unrendered data”
does not mean raw detector measurements. The Blue Marble mosaics and GEBCO height
model also have upstream processing. Our color scales, averaging and atmosphere
display are additional steps. Each layer keeps its own dates and physical meaning.

[SOURCE.md](SOURCE.md) explains these sources and the additional interior,
tomography, local noise and navigation data, including calculations and missing
coverage. [NOTICE.md](NOTICE.md) contains the credits and terms. The
[manifest](source/manifest.json) records exact input files, download locations,
sizes and hashes. The [descriptor](object.json) selects preparation, the
[prepared provenance](prepared/provenance.json) traces the outputs, and the
[runtime inventory](runtime-assets.json) identifies the installed images.

## Evidence

The reports below describe their own tested versions. No scientific, browser
or installation tests were rerun for this documentation change.

| Check | Recorded result or limit | Report |
| --- | --- | --- |
| Cloud-free surface and clouds | Selected source restoration, 179-file image installation and browser checks. Read the report's full-suite failures and checks left out. | [Cloud-free default](../../../docs/earth/cloud-free-default/README.md) |
| Elevation | Evidence for the numeric height layer, including its datum, tested version and coverage. | [Elevation](../../../docs/evidence/earth-elevation/README.md) |
| Annual night radiance | Source interpretation and processing of the annual product. | [Night lights](../../../docs/earth-night-lights.md) |
| Geographic paging and remote files | Separate coverage and download records. Installing image assets alone does not verify complete geographic paging. | [Global coverage](../../../docs/global-earth-coverage.md) |

## Known limits

The layers come from different dates and include observations, derived data and
models. They do not form one simultaneous snapshot. Night lights retain source
artifacts and missing coverage. Source restoration, image installation and remote
geographic coverage are separate checks; use the dated reports before claiming
that any of them passed for a new version.
