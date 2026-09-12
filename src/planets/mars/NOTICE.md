# Mars source notice

This package combines prepared material derived from the following sources:

- OpenSpace scene configuration (globe, atmosphere and kernel assets), MIT
  licensed by the OpenSpace Team. The pinned license text is included as
  `LICENSE.OPENSPACE-MIT`. The atmosphere material is derived from the pinned
  `RenderableAtmosphere` parameters.
- USGS Astrogeology and NASA/PDS Mars surface, MOLA, and THEMIS products.
  These United States government data products are credited in `README.md`
  and `source/manifest.json`.
- JPL Solar System Dynamics physical and orbital tables, cited per fact in
  `source/editorial/factsheet-review.json`.
- NASA GSFC Planetary Spectrum Generator output and NASA Science editorial
  information.
- The HYG v4.1 registration subset is by David Nash/Astronexus under
  CC-BY-SA-4.0. The ESO `eso0932a` full-sky panorama is credited to
  ESO/S. Brunier under CC-BY-4.0. Their checked license texts are retained in
  `source/stars/`.
- The Sun billboard follows the shared clean-room directional-sun standard.
  That standard cites the earlier Google Earth Pro Mars behavioural
  measurements retained in `source/sky/google-earth-pro-contract.json`; no
  Google sky, shader, or Sun pixels are shipped, and Mars preparation no longer
  reads that record.
- [Mars in opposition 2016](https://esahubble.org/images/heic1609a/), released
  by ESA/Hubble under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The prepared
  navigation marker is cropped and resized. Credit: NASA, ESA, the Hubble
  Heritage Team (STScI/AURA), J. Bell (ASU), and M. Wolff (Space Science
  Institute).

NASA, ESA/Hubble, and USGS names and source credits do not imply endorsement.
NASA and ESA/Hubble logos are not reused.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.
