# Credits and reuse

- Surface mosaic: Paul Schenk, Lunar and Planetary Institute / USRA, 2020; NASA/JPL Voyager 2 observations. Cite Schenk and Moore (2020), DOI [10.1098/rsta.2020.0102](https://doi.org/10.1098/rsta.2020.0102), and retain the release README. The public scientific release states no explicit license; this package does not assert one. See the [release](https://repository.hou.usra.edu/handle/20.500.11753/1687).
- Mission imagery: NASA/JPL; retain attribution and follow the [JPL image-use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/). No endorsement is implied.

Exact source hashes, transformation notes, credits and restoration paths are recorded in `source/manifest.json` and `source/preparation/acquisition.json`.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the shared prepared Lambert row bank follows the OpenSpace globebrowsing shading model (MIT, snapshot 56e29b54) as recorded in `source/preparation/raster.json`; no OpenSpace pixels are shipped.

Feature caption notes: 2 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.
