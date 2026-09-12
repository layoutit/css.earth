# Ganymede credits and reuse

Surface imagery: NASA/JPL/USGS, Voyager 1 and 2 and Galileo SSI, USGS global
monochrome and enhanced-color mosaics. Published processing includes geometric,
photometric and overlap-level corrections; cssEarth reprojects/downsamples the
maps and replaces the documented synthesized-red sector with observed monochrome.
USGS public scientific imagery policy:
https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits

Jupiter context photograph: NASA, ESA, STScI, and Amy Simon. NASA media guidance:
https://www.nasa.gov/nasa-brand-center/images-and-media/

Sky photograph: ESO/S. Brunier, CC BY 4.0. See
`source/stars/ESO-IMAGE-LICENSE.md`. Star catalogue: David Nash / Astronexus,
HYG v4.1, CC BY-SA 4.0; see `source/stars/LICENSE.md`.

Title font: Inter by Rasmus Andersson, SIL Open Font License 1.1. Physical/orbital
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

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the shared prepared Lambert row bank follows the OpenSpace globebrowsing shading model (MIT, snapshot 56e29b54) as recorded in `source/preparation/raster.json`; no OpenSpace pixels are shipped.
