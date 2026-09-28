# Io attribution

Surface imagery: NASA/JPL/USGS, from Voyager ISS and Galileo SSI. USGS catalogs
classify these public scientific products as public domain with no use constraints.
See [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits).
Prepared reprojection, coverage indicators and texture packaging retain this credit.
The enhanced source is a published USGS color-ratio merge; it is not true color.
Its interpolated polar color is withheld. No new image synthesis is applied.

Scientific geometry uses the repository's vendored astronomy/JPL/IAU source
closure. See `README.md` for map projection, source processing and limitations.

VLT/MUSE numerical spectral maps: Oliver King (2024), [data v0.1.0](https://doi.org/10.5281/zenodo.11402374),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Scientific interpretation:
[King et al. (2025)](https://doi.org/10.1029/2024JE008511). cssEarth reorders the
released samples under a documented coordinate interpretation, withholds mask
edges, rounds to float32 and prepares false-color display assets. Original
values, observations from different nights and scientific limitations remain
documented in `source/muse/INTERPRETATION.md`.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the shared prepared Lambert row bank follows the OpenSpace globebrowsing shading model (MIT, snapshot 56e29b54) as recorded in `source/preparation/raster.json`; no OpenSpace pixels are shipped.

Feature caption notes: 44 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.

Volcanic heat: Juno JIRAM imager reduced data records (PDS3 data set `JNO-J-JIRAM-3-RDR-V1.0`, A. Adriani and R. Noschese, INAF-IAPS; NASA Planetary Data System, Atmospheres Node), public NASA mission data. The previous six-visit version reduced the night-side M-band frames into `source/science/jiram/` with `tools/objects/juno/jiram-mosaic.mts`, using NAIF Juno SPICE kernels. The method follows, and the color scale is sampled from Figure 2 of Mura, A. et al. (2024), "The temporal variability of Io's hotspots", Frontiers in Astronomy and Space Sciences 11, [doi:10.3389/fspas.2024.1369472](https://doi.org/10.3389/fspas.2024.1369472), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); its Table 3 hot-spot outputs are transcribed in `source/science/mura-2024/` to check the map. Hot-spot positions used only to check the map come from Table A1 of Davies, A.G. et al. (2024), Planetary Science Journal 5, 121, [doi:10.3847/PSJ/ad4346](https://doi.org/10.3847/PSJ/ad4346), CC BY 4.0, kept unchanged in `source/science/davies-2024/`.

The cold-night column-background correction addresses the downtrack reflections described by Perry, J. E. et al. (2025), “Hot Spot Detections and Volcanic Changes on Io during the Juno Epoch: Orbits PJ5 to PJ55”, Planetary Science Journal 6, 84, [doi:10.3847/PSJ/adbae3](https://doi.org/10.3847/PSJ/adbae3). The per-column median estimator and its sample threshold are cssEarth processing choices.

The current map uses the processed M-band FITS release accompanying Perry, J. E., Davies, A. G., Williams, D. A. and Nelson, D. M. (2025), from the [Ronald Greeley Center for Planetary Studies at Arizona State University](https://rgcps.asu.edu/juno/), [doi:10.3847/PSJ/adbae3](https://doi.org/10.3847/PSJ/adbae3). Original article content is under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the inputs are public Juno mission data. cssEarth transfers the released geometry, withholds the published detector masks, subtracts its cold-column background and combines qualified night-side observations. The optional author flat-field correction is not applied. The recipe and measured receipt identify the selected products and transformations.

Elevation: stereo digital elevation model by White, O. L., Schenk, P. M., Nimmo, F. and Hoogenboom, T. (2014), "A new stereo topographic map of Io: Implications for geology from global to local scales", Journal of Geophysical Research: Planets 119, 1276–1301, [doi:10.1002/2013JE004591](https://doi.org/10.1002/2013JE004591), from Voyager and Galileo images (NASA/JPL). Served by NASA Solar System Treks as product `IoDEM`; the Trek record states no reuse terms, so they are unresolved. cssEarth samples the original heights, colors them and adds relief lighting; see `source/manifest.json`.
