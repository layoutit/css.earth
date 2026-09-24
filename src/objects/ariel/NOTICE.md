# Credits and reuse

- Ariel mosaic and digital elevation model: Paul Schenk, Lunar and Planetary Institute/USRA; NASA/JPL Voyager 2 imagery. Cite [Schenk and Moore (2020)](https://doi.org/10.1098/rsta.2020.0102) and the [LPI data release](https://repository.hou.usra.edu/handle/20.500.11753/1687). The release does not assert an explicit data license; its original author README accompanies the inputs. The paper's publication license is not asserted to license separate repository cubes.
- Retain mission and author credit. The [JPL image-use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/) applies to the underlying mission imagery. No NASA/JPL or author endorsement is implied.

Original and authored input identities, credits and restoration URLs are recorded in `source/manifest.json` and `source/preparation/acquisition.json`.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the shared prepared Lambert row bank follows the OpenSpace globebrowsing shading model (MIT, snapshot 56e29b54) as recorded in `source/preparation/raster.json`; no OpenSpace pixels are shipped.

Feature caption notes: 5 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.
