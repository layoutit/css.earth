# Ceres imagery attribution

Credit both surface products to **NASA/JPL-Caltech/UCLA/MPS/DLR/IDA**.
The monochrome mosaic is distributed by USGS Astrogeology and was produced by
Th. Roatsch and colleagues at DLR, JPL, and UCLA. The enhanced-color image is
NASA Photojournal product PIA19977, based on Dawn Framing Camera observations.

See the [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/)
and [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits).
Preserve the supplied credit with derived textures and any displayed imagery.
No NASA, JPL, DLR, or partner endorsement is implied. The repository's software
license does not replace these image-use terms.

Original images are downloaded from their public sources, verified against the
local manifest, and excluded from Git. Prepared imagery is published in the Ceres runtime asset inventory. Enhanced
color remains labeled as false color; monochrome is not described as true color.
Identified south-polar gaps are displayed as a neutral gray cartographic grid,
using Pluto's shared missing-coverage treatment. The grid is not inferred terrain.

Elevation: DLR / Dawn Team, distributed by USGS Astrogeology, HAMO global DTM
(2016). Retain this scientific-data credit with the derived map. The source
record preserves the reference sphere, units, and withheld polar coverage.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the globe's lighting is the published Hapke law of Li et al. (2019), doi:10.1016/j.icarus.2018.12.038, whose parameter values are transcribed as facts in `source/photometry/li-2019-hapke-749nm.json` and cited in `source/manifest.json`.

Feature caption notes: 31 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.

Clay band: Dawn VIR derived Ceres global mosaics V1.0, DAWN-A-VIR-5-DDR-CERES-MOSAIC-V1.0 (De Sanctis, M.C., M.T. Capria, E. Ammannito, A. Frigeri, F. Tosi, M. Giardino, S. Fonte, F. Zambon, NASA Planetary Data System, 2018). Public NASA PDS scientific data; retain this credit with the derived maps. The color scales are sampled from Frigeri et al. (2019), Icarus 318, 14–21, Figure 7 (doi:10.1016/j.icarus.2018.04.019); only the sampled colors are used, not the figure. The ammonium result is Ammannito et al. (2016), Science 353, aaf4279.

Ammonium band: our reduction of Dawn VIR calibrated infrared spectra, DAWN-A-VIR-3-RDR-IR-CERES-SPECTRA-V1.0 (M. C. De Sanctis; NASA Planetary Data System, Small Bodies Node, volumes DWNCSVIR_I1B and DWNCHVIR_I1B), public NASA mission data, with NAIF Dawn SPICE kernels. The processing follows Frigeri, A. et al. (2019), "The spectral parameter maps of Ceres from NASA/DAWN VIR data", Icarus 318, 14–21, [doi:10.1016/j.icarus.2018.04.019](https://doi.org/10.1016/j.icarus.2018.04.019), whose Figure 7 color bar supplies the palette.

Clay band centre and Ammonium band centre: native `CMT_MOSAIC-BI_CENTER` and
`CMT_MOSAIC-BII_CENTER`, from the same Dawn VIR global mosaics V1.0 release
credited above. Numeric display ranges follow Ammannito et al. (2016),
[LPSC 3020, Figure 2](https://www.hou.usra.edu/meetings/lpsc2016/pdf/3020.pdf).
The heat palette is authored; no paper figure is redistributed.

Gravity, gravity uncertainty, Bouguer anomaly and geoid: JPL Dawn Gravity Science Team (A. S. Konopliv, R. S. Park, S. W. Asmar), model CERES18D, from Park, Konopliv, Asmar and Buccino (2025), Dawn Ceres Gravity Science Derived Data Bundle 1.0, NASA Planetary Data System Small Bodies Node, [doi:10.17189/c2eg-7x61](https://doi.org/10.17189/c2eg-7x61) (PDS3 `DAWN-A-RSS-5-CEGR-V4.0`). Public NASA PDS scientific data; retain this credit with the derived maps. The archived values are shown unchanged, one colour per 1° cell.

Surface elements (hydrogen, iron, neutron counts): T. H. Prettyman and N. Yamashita (Planetary Science Institute), DAWN GRaND Ceres Bundle 1.0, NASA Planetary Data System Small Bodies Node, 2021, [doi:10.26033/hf9h-pt31](https://doi.org/10.26033/hf9h-pt31) (PDS3 `DAWN-A-GRAND-5-CERES-HYDROGEN-MAP_V1.0`, `DAWN-A-GRAND-5-CERES-IRON_MAP_V1.0`, `DAWN-A-GRAND-5-CERES-TPE-COUNTS-V1.0`); methods in Prettyman et al. (2017), Science 355, 55–59, [doi:10.1126/science.aah6765](https://doi.org/10.1126/science.aah6765). Public NASA PDS scientific data; retain this credit with the derived maps. The archived values are shown unchanged, one colour per 20° pixel.
