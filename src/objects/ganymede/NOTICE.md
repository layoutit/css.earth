# Ganymede credits and reuse

Surface imagery: NASA/JPL/USGS, Voyager 1 and 2 and Galileo SSI, USGS global
monochrome and enhanced-color mosaics. Published processing includes geometric,
photometric and overlap-level corrections; cssEarth reprojects/downsamples the
maps and replaces the documented synthesized-red sector with observed monochrome.
USGS public scientific imagery policy:
https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits

Physical/orbital
data and rotation models retain the pinned astronomy package's JPL and
IAU/WGCCRE attribution. Exact inputs and license evidence are in the source
manifest. The application license does not replace these source terms.

VLT/MUSE numerical spectral maps: Oliver King (2024), [data v0.1.0](https://doi.org/10.5281/zenodo.11402374),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Scientific interpretation:
[King et al. (2025)](https://doi.org/10.1029/2024JE008511). cssEarth reorders the
released samples under a documented coordinate interpretation, withholds mask
edges, rounds to float32 and prepares false-color display assets. Original
values, observations from different nights and scientific limitations remain
documented in `source/muse/INTERPRETATION.md`.

VLT/SPHERE composition fits: Oliver King and Leigh Fletcher (2022), [Global
Modelling of Ganymede's Surface Composition](https://doi.org/10.1029/2022JE007323),
[Zenodo 6390469](https://doi.org/10.5281/zenodo.6390469), and tagged
[v1.0.1 source](https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/tree/v1.0.1).
cssEarth converts released posterior medians and preserves no-data; the maps are
model outputs, not direct mineral detections. The numerical release has no located
explicit reuse licence. It is retained only for local preview and a private draft PR;
no public composition asset is published.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the shared prepared Lambert row bank follows the OpenSpace globebrowsing shading model (MIT, snapshot 56e29b54) as recorded in `source/preparation/raster.json`; no OpenSpace pixels are shipped.

Feature caption notes: 68 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.
