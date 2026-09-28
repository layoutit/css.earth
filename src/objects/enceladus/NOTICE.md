# Enceladus attribution

Cassini observations: NASA/JPL-Caltech/Space Science Institute.
Maps and terrain model: Paul M. Schenk and William B. McKinnon (2024), LPI/USRA.
Distributed by USGS Astrogeology and NASA PDS; archive use constraint: cite authors.
See README.md and source/manifest.json for product-specific evidence.

Physical and orbital metadata: vendored JPL / IAU/WGCCRE astronomy records.

B2 additions: Corrected JPL SSD Enceladus v2 SPC shape; retain Park et al. (2024), JPL/Cassini, SpiceyPy and NAIF SPICE credits. The old v1 model is excluded.

Cassini VIMS spectral observations: NASA / Caltech-JPL / University of Arizona /
Osuna-CNRS-Nantes Université, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
as stated on the [Nantes data policy](https://vims.univ-nantes.fr/about).
cssEarth derives fixed-channel indices, partial geographic maps and display
textures. Original archive processing, attribution and missing-data limits remain
documented in `source/vims-chemistry/INTERPRETATION.md`.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Feature caption notes: 43 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.

PIA24027 global infrared composite (2020): NASA/JPL-Caltech/University of Arizona/LPG/CNRS/University of Nantes/Space Science Institute.
Infrared maps: Robidel et al. (2020), doi:10.1016/j.icarus.2020.113848.
ISS detail: Bland et al. (2018), doi:10.1029/2018EA000399.
Used under the [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/);
cssEarth resamples and encodes the published display composite.

Geologic map units: Crow-Willard and Pappalardo (2015), Structural
mapping of Enceladus and implications for formation of tectonized regions,
JGR Planets 120, 928–950, doi:10.1002/2015JE004818. GIS layer
"Cassini ISS Geologic Map Units, Global" served by NASA Solar System Treks (JPL).
cssEarth rasterizes the published polygons and keeps their unit names and colors.
