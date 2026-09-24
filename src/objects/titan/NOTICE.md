# Titan notices

- Cassini ISS mosaic: NASA/JPL-Caltech/Space Science Institute/USGS,
  Weller et al. (2026), DOI 10.5066/P14FAEKS. USGS releases this dataset under
  CC0 1.0. Resampling, source-informed missing-data annotation and texture
  projection are prepared derivatives; original scientific processing remains.
- Radar mosaic: NASA/JPL-Caltech/ASI, Cassini RADAR Team and USGS
  (Randolph L. Kirk), MIDR V1.0, S00 through T126. Original PDS3 files are
  reacquired from Cornell. Prepared derivatives preserve the incidence-corrected
  source levels and mark documented no-data; they do not fill missing terrain.
- Physical and orbital context: NASA/JPL and IAU/WGCCRE through the vendored
  astronomy package. Editorial information: NASA Science.

B2 additions: Cassini RADAR GTDR, Paul Corlies/Cornell University, NASA PDS. Derived measured/interpolated topography and distance maps retain original missing values.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the shared prepared Lambert row bank follows the OpenSpace globebrowsing shading model (MIT, snapshot 56e29b54) as recorded in `source/preparation/raster.json`; no OpenSpace pixels are shipped.

Landing, touchdown and impact sites (1): compiled from NASA NSSDCA, PDS and LROC pages, agency releases and cited papers; each site's source, rights and quoted sentence are in `source/features/sites.json`. NASA content is not subject to copyright; other publishers are cited for facts only.

Feature caption notes: 58 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.
