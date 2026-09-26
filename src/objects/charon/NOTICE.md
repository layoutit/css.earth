# Charon credits

Imagery and terrain: NASA/Johns Hopkins University Applied Physics Laboratory/
Southwest Research Institute; Paul Schenk, Lunar and Planetary Institute;
New Horizons team; USGS Astrogeology. Retain these author credits on reuse.
Original US mission imagery is public domain. The views are processed scientific
presentations, not NASA endorsement or globally uniform-resolution photography.

Orbits and orientation: NASA/JPL Solar System Dynamics and NAIF. Title font:

## B6 sources

The added views derive from credited public USGS/NASA scientific products. Preserve the source authors, PDS citation and processing qualifications recorded in README.md and the source manifest. No endorsement is implied.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.

Lighting: the globe's lighting is the published lunar-Lambert law of Buratti et al. (2017), doi:10.1016/j.icarus.2016.11.012, whose value is transcribed as a fact in `source/photometry/buratti-2017-lunar-lambert-lorri.json` and cited in `source/manifest.json`.

Feature caption notes: 7 lead summaries from the English Wikipedia (Wikipedia contributors, CC BY-SA 4.0), joined to the Gazetteer through Wikidata (CC0); each note links its article in `source/features/notes.json`.

## LEISA ice absorption

The water-ice and ammonia views derive from NASA PDS New Horizons LEISA products
`0299175509_charon_cube::1.0` and `0299171308_charon_cube::1.0` in the
`nh_derived:plutosystem_composition` collection. Retain NASA/JHUAPL/SwRI, the New
Horizons team and PDS attribution. Native FITS, companion geometry/wavelength
arrays and unmodified PDS4 labels are pinned in the source manifest.

The ammonia band ratio and Organa coordinate follow W. M. Grundy et al.,
*Surface compositions across Pluto and Charon*, Science 351 (2016),
DOI 10.1126/science.aad9189, supplementary methods p. 3 and Fig. S6.
The supplementary paper is retained as a method reference, not relicensed or
delivered as a runtime asset. Organa is an informal mission name. cssEarth's
band-map preparation, water-depth diagnostic and display recipes are MIT.
