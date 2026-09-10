# Io attribution

Surface imagery: NASA/JPL/USGS, from Voyager ISS and Galileo SSI. USGS catalogs
classify these public scientific products as public domain with no use constraints.
See [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits).
Prepared reprojection, coverage indicators and texture packaging retain this credit.
The enhanced source is a published USGS color-ratio merge; it is not true color.
Its interpolated polar color is withheld. No new image synthesis is applied.

Jupiter parent image: NASA, ESA, STScI, and Amy Simon. See the pinned original in
`source/manifest.json` and NASA media usage guidance. Only a prepared observational
marker is used; the image must retain all listed partner credits.

Milky Way: ESO/S. Brunier, CC BY 4.0. Star catalogue: David Nash / Astronexus,
HYG v4.1, CC BY-SA 4.0. Source license records are in `source/stars/`.
Title font: Inter, Rasmus Andersson, SIL Open Font License 1.1.

Scientific geometry uses the repository's vendored astronomy/JPL/IAU source
closure. See `README.md` for map projection, source processing and limitations.

VLT/MUSE numerical spectral maps: Oliver King (2024), [data v0.1.0](https://doi.org/10.5281/zenodo.11402374),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Scientific interpretation:
[King et al. (2025)](https://doi.org/10.1029/2024JE008511). cssEarth reorders the
released samples under a documented coordinate interpretation, withholds mask
edges, rounds to float32 and prepares false-color display assets. Original
values, observations from different nights and scientific limitations remain
documented in `source/muse/INTERPRETATION.md`.
