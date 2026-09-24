# Credits and reuse

- Measured nucleus and derived geometry/shape imagery: **ESA/Rosetta/NAVCAM; ESA/RMOC**. [ESA release and license statement](https://blogs.esa.int/rosetta/2015/11/30/new-comet-shape-model/). Creative Commons Attribution-ShareAlike 3.0 IGO: https://creativecommons.org/licenses/by-sa/3.0/igo/ . Changes: mesh reduction, neutral material, prepared normal/shadow shading and context rendering. These derived shape assets retain the same license.
- Original 20 July 2015 NAVCAM photograph: **ESA/Rosetta/NAVCAM**, CC BY-SA 3.0 IGO. [Original observation page](https://blogs.esa.int/rosetta/2015/07/28/cometwatch-20-july/). The original image is not painted onto the nucleus.
- OSIRIS August 2014 and October–November 2015 observations and image derivatives: **ESA/Rosetta/MPS for OSIRIS Team MPS/UPD/LAM/IAA/SSO/INTA/UPM/DASP/IDA**, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), as stated in [ESA's complete archive release](https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Rosetta_image_archive_complete). Changes: quality/geometry withholding, source-calibrated radiance-factor conversion, bounded disk and approximate phase normalization, overlap brightness matching, grayscale stretch, source-surface projection, prepared flood/Sun lighting, atlas packing and small preview assets. The original GEO and L4 quality files remain byte-identical to the archive. Their `SOFTWARE_LICENSE_TYPE` field describes the calibration software, not image reuse terms.
- Authored neutral input and preparation/runtime code: repository license. ESA data are not relicensed under the repository license. No endorsement by ESA, NASA or DLR is implied.

- VIRTIS MTP006 scientific map tables: **ESA/Rosetta/VIRTIS; Capaccioni and the VIRTIS team; Filacchione et al. (2016); Ciarniello et al. (2016)**. [Original archive](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-virtis-5-67p-maps-v1.0/), [ESA public scientific-data release](https://blogs.esa.int/rosetta/2015/08/03/first-release-of-rosetta-comet-phase-data-from-four-orbiter-instruments/). Original tables and labels are retained byte-for-byte. Changes: explicit-coordinate sampling, physical-range and geometric-ambiguity withholding, documented unit conversion, false-color palettes, RMOC surface transfer and prepared lighting. Public archive access is documented; no blanket CC license is inferred for the numerical products. These data are not relicensed as MIT. The existing RMOC geometry and its derivatives retain their share-alike terms.
- Published SHAP5 SPC reference: **ESA/Rosetta; LAM/PSI SPC SHAP5 team; Jorda et al.** [ESA PSA shape archive](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/). Used only to cross-check angular ambiguity during preparation; it does not replace the rendered RMOC mesh. The released model is later than the VIRTIS pipeline’s SHAP5 v1.1, so this is not a claim of exact original geometry.

SHAP7 region cells: Thomas et al. (2018), Mendeley Data version 1,
https://doi.org/10.17632/2845znt54k.1, Creative Commons Attribution 4.0:
https://creativecommons.org/licenses/by/4.0/. cssEarth recolors and transfers
original region IDs to the RMOC display mesh.

Geological paths and feature locations: European Space Agency, 2021,
ESA-AURORA_67P-GEOMAP_OSIRIS_V1.0, https://doi.org/10.5270/esa-kokoti7;
Leon-Dasi et al. (2021), https://doi.org/10.1051/0004-6361/202140497.
Attribution follows Product User Guide §2.1. No additional Creative Commons
license is asserted for these ESA archive products. cssEarth projects and
rasterizes their coordinates; line and point sizes are cartographic symbols.

Landing, touchdown and impact sites (2): compiled from NASA NSSDCA, PDS and LROC pages, agency releases and cited papers; each site's source, rights and quoted sentence are in `source/features/sites.json`. NASA content is not subject to copyright; other publishers are cited for facts only.
