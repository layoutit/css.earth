# Mars source notice

This package combines prepared material derived from the following sources:

- The surface limb law transcribed from Vincendon (2013),
  doi:10.1016/j.pss.2012.12.005, cited in `source/manifest.json`.
- USGS Astrogeology and NASA/PDS Mars surface, MOLA, and THEMIS products.
  These United States government data products are credited in `README.md`
  and `source/manifest.json`.
- JPL Solar System Dynamics physical and orbital tables, cited per fact in
  `source/editorial/factsheet-review.json`.
- NASA GSFC Planetary Spectrum Generator output and NASA Science editorial
  information. The limb halo profile (`source/atmosphere/psg-limb.json`) was
  computed with a local copy of the Planetary Spectrum Generator (nasapsg/psg
  container; Villanueva et al. 2018, 2022).
- The shared clean-room directional-sun standard cites the earlier Google Earth
  Pro Mars behavioural measurements retained in
  `source/sky/google-earth-pro-contract.json`; no Google sky, shader, or Sun
  pixels are shipped, and Mars preparation no longer reads that record.
- [Mars in opposition 2016](https://esahubble.org/images/heic1609a/), released
  by ESA/Hubble under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The prepared
  navigation marker is cropped and resized. Credit: NASA, ESA, the Hubble
  Heritage Team (STScI/AURA), J. Bell (ASU), and M. Wolff (Space Science
  Institute).

NASA, ESA/Hubble, and USGS names and source credits do not imply endorsement.
NASA and ESA/Hubble logos are not reused.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Feature caption notes: 644 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.

Landing, touchdown and impact sites (14, 2 traverses): compiled from NASA NSSDCA, PDS and LROC pages, agency releases and cited papers; each site's source, rights and quoted sentence are in `source/features/sites.json`. NASA content is not subject to copyright; other publishers are cited for facts only.

- Mars geology: Kenneth L. Tanaka and colleagues, USGS Scientific Investigations Map 3292 (2014); unit colours from the published map sheet.
- Odyssey GRS concentrations: William V. Boynton and colleagues (2007), NASA/PDS Geosciences Node, ODY-M-GRS-5-ELEMENTS-V1.0.
- Crustal magnetic model: Benoît Langlais and colleagues (2019), Zenodo 3876714; evaluated with pyshtools 4.14.1.
- Crust thickness: Mark A. Wieczorek and colleagues (2022), Zenodo 6477509; precomputed Figure 2 model, Khan2022-39-2900-2900.
Numeric MOLA global DEM: NASA Mars Global Surveyor MOLA team and USGS Astrogeology, 1999–2001 observations, elevations relative to the degree/order-50 GMM-2B areoid. cssEarth samples native cells and applies its own numeric palette and matching legend.
- TES albedo: Philip R. Christensen and colleagues (2001), NASA/JPL/ASU Mars Global Surveyor TES team, product GLOBAL_ALBEDO_8PPD distributed by USGS Astrogeology. cssEarth samples native cells and applies its own numeric palette and matching legend.
- TES thermal inertia: Nathaniel E. Putzig and Michael T. Mellon (2007), NASA/PDS Geosciences Node, MGS-M-TES-5-TIMAP-V1.0 product GLOBAL_TI_NIGHT_2007 and its interpolation mask. cssEarth withholds interpolated cells and applies its own numeric palette and matching legend.
- TES dust cover index: Steven W. Ruff and Philip R. Christensen (2002), Arizona State University; the author's VICAR release. cssEarth withholds the polar fill and applies its own numeric palette and matching legend.
- Landform and mineral catalogues, all served as GIS layers by NASA Solar System Treks (JPL); colours are each layer's published symbol or fill attribute unless the dataset says a colour is ours:
  - Dune fields: Rosalyn K. Hayward and colleagues, Mars Global Digital Dune Database MC2–MC29, USGS Open-File Report 2007-1158 (public domain).
  - Valley networks: Brian M. Hynek, Michael Beach and Monica R. T. Hoke (2010), JGR 115, E09008.
  - Alluvial fans: Jeffrey M. Moore and Alan D. Howard (2005), JGR 110, E04005; Erin R. Kraal and colleagues (2008), Icarus 194, 101–110.
  - Gullies: Tanya N. Harrison, Gordon R. Osinski, Livio L. Tornabene and Eriita Jones (2015), Icarus 252, 236–254.
  - Glacier-like forms: Colin Souness, Bryn Hubbard, Ralph E. Milliken and Duncan Quincey (2012), Icarus 217, 243–255.
  - Recessional glacier-like forms: Stephen Brough, Bryn Hubbard and Alun Hubbard (2016), Icarus 274, 37–49.
  - Supraglacial and proglacial valleys: Caleb I. Fassett and colleagues (2010), Icarus 208, 86–100.
  - Present-day changes: I. J. Daubar and colleagues (2013), Icarus 225, 506–516; Colin M. Dundas and colleagues (2014), JGR Planets 119, 109–127, and (2015), Icarus 251, 244–263; Alfred S. McEwen and colleagues (2014), Nature Geoscience 7, 53–58; Lujendra Ojha and colleagues (2014), Icarus 231, 365–376.
  - Hydrous minerals: J. Carter, F. Poulet, J.-P. Bibring, N. Mangold and S. Murchie (2013), JGR Planets 118, 831–858.
  - Aqueous mineral classes: Bethany L. Ehlmann and Christopher S. Edwards (2014), Annual Review of Earth and Planetary Sciences 42, 291–315.
  - Chloride deposits: Mikki M. Osterloo, F. Scott Anderson, Victoria E. Hamilton and Brian M. Hynek (2010), JGR 115, E10012.
  - Unmarked ground in these datasets shows the Viking MDIM 2.1 colour mosaic (credited above) at 40% brightness.
