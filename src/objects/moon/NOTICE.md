# Moon notices

- Moon surface: LROC WAC Global Morphologic Map v1.3, NASA/GSFC/Arizona State University. PDS archive data are public domain under [LROC terms](https://lroc.im-ldi.com/about/terms). The app resamples the map and adjusts brightness; see README.md.
- Moon navigation sprite: NASA SVS CGI Moon Kit, LRO/LROC and LOLA. NASA media usage guidelines.
- Physical and orbital facts: NASA JPL Solar System Dynamics.
- Elevation lens: LRO LOLA LDEM16 numeric grid, David E. Smith and NASA GSFC LRO LOLA team; NASA PDS Geosciences Node.
- Crustal thickness lens: NASA GSFC Scientific Visualization Studio; GRAIL. NASA media usage guidelines.
- Lighting model formulation adapted from the OpenSpace globe shader (MIT,
  OpenSpace Team); implemented and documented in this repository.

## B6 sources

Lucey et al. (2021), corrected Diviner Christiansen-feature map, DOI 10.5281/zenodo.4558194, is adapted under CC-BY-4.0. Sampling and display changes are described in README.md. USGS geology is public-domain scientific mapping.

## B10 sources

Powell et al. (2023), LRO Diviner GHRM temperature, temperature-anomaly and rock-abundance products, NASA PDS Geosciences Node. The corresponding [author dataset](https://doi.org/10.25346/S6/LFAVXU) is CC0 1.0. Retain source attribution and exact product identities; processing and interpretation limits are described in README.md. The journal article itself is not redistributed or relicensed.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Feature caption notes: 1749 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.

Landing, touchdown and impact sites (80, 2 traverses): compiled from NASA NSSDCA, PDS and LROC pages, agency releases and cited papers; each site's source, rights and quoted sentence are in `source/features/sites.json`. NASA content is not subject to copyright; other publishers are cited for facts only.
