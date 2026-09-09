# Sun

Route: `/sun/`. Maps assembled from solar observations, with separate imagery
beyond the visible disk.

## Sources

| What is shown | Source and treatment | Limits |
| --- | --- | --- |
| Photosphere | Colorized SDO/HMI continuum images, assembled from central-meridian strips across Carrington Rotation 2311. | Limb normalization and continuation beyond observed polar latitudes are display approximations. |
| Magnetic field | JSOC `hmi.mrsynop_small_720s[2311]`, a 720 × 360 radial magnetic-field map. Preparation resamples its sine-latitude grid to equal latitude and applies a bipolar color scale. | Colors represent the magnetic quantity, not visible surface color. |
| Chromosphere | NASA SDO AIA 304 Å CR2311 FITS map, 3,600 × 1,080. | A rotation-spanning map with a false-color display. |
| Corona | NASA SDO AIA 171 Å CR2311 FITS map, 3,600 × 1,080. | A rotation-spanning map with a false-color display. |
| Imagery outside the disk | Separate AIA browse observations from 27 May 2026, used only with their matching views. | Stationary image plates behind the globe, not rotating global maps. |

CR2311 covers 12 May–9 June 2026. Each global map combines observations across
one rotation. The views are not simultaneous or live. Missing AIA samples are
filled from the nearest valid latitude in the same map.

[SOURCE.md](SOURCE.md) explains projection, polar treatment and the preparation
of the visible disk edge. The [manifest](source/manifest.json) records exact
files, source URLs, sizes and hashes; [NOTICE.md](NOTICE.md) contains credits
and terms. The [descriptor](object.json), [prepared provenance](prepared/provenance.json)
and [runtime inventory](runtime-assets.json) identify the processing and outputs.

## Evidence

This documentation change did not rerun the Sun's scientific, preparation,
installation or browser tests. It records no new passing result.

| Available record | What it establishes | What it does not establish |
| --- | --- | --- |
| [Prepared provenance](prepared/provenance.json) | Recorded sources and processing for generated files. | A fresh source download, independent scientific accuracy or a browser pass. |
| [Unit tests](../../../tests/objects/unit/sun) | The existing executable checks to run for a relevant change. | Test code alone is not a passing run. |
| [Browser profile](../../../tests/objects/browser/sun/browser-profile.mjs) | The Sun's cases for the shared browser harness. | A new visual review or successful installation. |

## Known limits

Polar continuation, missing-sample filling and color choices affect the display.
Read their definitions before interpreting the view scientifically. No fresh
installation or inspected visual result is established by this documentation
work; save and link those results when the relevant checks are run.
