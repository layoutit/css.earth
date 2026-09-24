# Sources and reuse

Veverka et al. (1996), Galileo imaging team. Numerical scientific facts; independent cssEarth tessellation MIT. Cite the original paper.

Scientific sources are linked in source/measurements.json. This package does not redistribute paper prose or figures.

On 2026-09-14, the [publisher's Veverka article page](https://www.sciencedirect.com/science/article/pii/S0019103596900457)
identifies its open-archive license as [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/).
That does not establish permission to publish a reprojected texture made from
the paper figure. The supplied PDF and extracted JPEGs remain local references;
the map-review report records numerical measurements and source identities.
The independently archived original NASA exposure is a separate source under
the mission notices below.

The native Galileo SSI images, PDS labels and detector-quality records retained
under `evidence/galileo/native/` are public NASA mission scientific data from
NASA/JPL/Galileo SSI, distributed by the PDS Small Bodies Node. The scan-platform
CK and mission PCK come from NASA/JPL NAIF; their original embedded notices are
preserved. The crop PNGs are declared display derivatives for source inspection.
Keep the mission credit and native file identities in `evidence/galileo/inputs.json`.
These files do not supply an enabled photographic surface.

The original VICAR image and label under `evidence/registration/native/` come
from NASA/JPL's PDS Imaging Node GO_0016 release. The accompanying mission
catalog document, SCLK and LSK are NASA/JPL records; their original notices are
retained. `evidence/registration/inputs.json` pins these files and the previously
retained SSI instrument definition. The orientation overlays are measurement
diagnostics on uncalibrated image DN, not additional observations or a qualified
texture. The independent CSPICE numerical fixture is under
`tests/objects/fixtures/dactyl/`. Paper values are cited numerical facts; no
paper prose or figures are redistributed.

The retained Celestia catalog and candidate orbit parameters derived from it retain GPL-2.0-or-later, with the full copyright header and license in source/reference/.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.
