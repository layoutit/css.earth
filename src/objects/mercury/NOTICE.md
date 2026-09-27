# Mercury notice

NASA, NASA Solar System Treks, NASA/JHU APL/Carnegie, NASA/PDS, USGS Astrogeology, and NASA GSFC data are credited in the interface and source manifest. Their inclusion does not imply endorsement.

Native BDR, LOI and enhanced-color maps: Applied Coherent Technology Corporation; MESSENGER team; Arizona State University; Johns Hopkins Applied Physics Laboratory; Carnegie Science; published by USGS Astrogeology, edition 1 (2016). USGS states no access restrictions and requests author credit. cssEarth reduces the original GeoTIFFs for display and marks missing coverage. The legacy NASA Trek BDR snapshot remains in the interior illustration.

The global MESSENGER MASCS spectrum is derived from M. D'Amore's DLR dataset, DOI 10.5281/zenodo.7433033, under CC-BY-4.0. See `source/spectrum/LICENSE.md`.

The globe's lighting is the published KS3 law of Domingue et al. (2016), doi:10.1016/j.icarus.2015.11.040 (CC BY-NC-ND 4.0), whose parameter values are transcribed as facts. The cutaway's section lighting keeps a formulation adapted from the OpenSpace globe shader (MIT, OpenSpace Team); it is implemented and documented in this repository and no OpenSpace file is read.

Feature traces for rupes, dorsa and fossae are from Christian Klimczak, Paul Byrne and Kelsey Crane, “A Global Tectonic Map of Mercury”, version 2, Mendeley Data, DOI 10.17632/p43b9wttpj.2, licensed CC BY 4.0; preparation selected and decimated traces inside each feature’s published extent. See `source/features/tectonic/manifest.json`.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Feature caption notes: 486 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.

Landing, touchdown and impact sites (1): compiled from NASA NSSDCA, PDS and LROC pages, agency releases and cited papers; each site's source, rights and quoted sentence are in `source/features/sites.json`. NASA content is not subject to copyright; other publishers are cited for facts only.

Numeric MESSENGER global DEM v2 (2016): USGS Astrogeology and the NASA/JHU APL/Carnegie MESSENGER team. cssEarth samples native cells, converts half-metre DNs to heights above the 2,439.4 km reference sphere, and applies its own matching palette and legend.
