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

Title outlines derive from Inter by Rasmus Andersson, under the SIL Open Font
License 1.1.

Elevation: DLR / Dawn Team, distributed by USGS Astrogeology, HAMO global DTM
(2016). Retain this scientific-data credit with the derived map. The source
record preserves the reference sphere, units, and withheld polar coverage.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the shared prepared Lambert row bank follows the OpenSpace globebrowsing shading model (MIT, snapshot 56e29b54) as recorded in `source/preparation/raster.json`; no OpenSpace pixels are shipped.

Feature caption notes: 31 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.

Clay band: Dawn VIR derived Ceres global mosaics V1.0, DAWN-A-VIR-5-DDR-CERES-MOSAIC-V1.0 (De Sanctis, M.C., M.T. Capria, E. Ammannito, A. Frigeri, F. Tosi, M. Giardino, S. Fonte, F. Zambon, NASA Planetary Data System, 2018). Public NASA PDS scientific data; retain this credit with the derived maps. The color scales are sampled from Frigeri et al. (2019), Icarus 318, 14–21, Figure 7 (doi:10.1016/j.icarus.2018.04.019); only the sampled colors are used, not the figure. The ammonium result is Ammannito et al. (2016), Science 353, aaf4279.

Ammonium band: our reduction of Dawn VIR calibrated infrared spectra, DAWN-A-VIR-3-RDR-IR-CERES-SPECTRA-V1.0 (M. C. De Sanctis; NASA Planetary Data System, Small Bodies Node, volumes DWNCSVIR_I1B and DWNCHVIR_I1B), public NASA mission data, with NAIF Dawn SPICE kernels. The processing follows Frigeri, A. et al. (2019), "The spectral parameter maps of Ceres from NASA/DAWN VIR data", Icarus 318, 14–21, [doi:10.1016/j.icarus.2018.04.019](https://doi.org/10.1016/j.icarus.2018.04.019), whose Figure 7 color bar supplies the palette.
