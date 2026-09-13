# Titan global geomorphology

The original six unit shapefiles are Ashley Schoenfeld’s version 2 release
(10 March 2026), DOI https://doi.org/10.17632/f6jrtyfp66.2, under CC BY 4.0.
Also cite Lopes et al. (2020), *A global geomorphologic map of Saturn’s moon
Titan*, https://doi.org/10.1038/s41550-019-0917-6.

The release distinguishes plains (Pl), dunes (Dn), hummocky/mountainous terrain
(Mt), lakes and basins (Ba), labyrinth terrain (Lb) and craters (Cr).
Ba includes areas now or formerly occupied by methane/ethane liquids. It is
not a present-day liquid-coverage mask. The map is an interpretation combining
Cassini radar and infrared observations; correlations extend units beyond
areas directly observed by radar. Units do not encode elevation, liquid depth,
age, composition fractions or visible color.

All nine records across six shapefiles are preserved. Their GCS_Titan_2000
uses a 2,575,000 m sphere and degree coordinates over -180..180 longitude and
-90..90 latitude. Original geometry is rasterized at pixel centers into a
2048×1024 categorical grid. Rings/holes remain intact; conflicting categories
and uncovered cells remain missing. No unit priority paints over a conflict.
The 815 missing grid cells include 495 overlaps. These are planar pixel counts,
not area percentages. Fine boundaries below this display grid may disappear.

The app palette adapts the six colors of NASA/JPL/ASU’s PIA23174 reference:
https://www.jpl.nasa.gov/images/pia23174-first-global-geologic-map-of-titan/.
This derived view uses an equirectangular grid, not the published Mollweide
illustration. Original ArcGIS style/metadata files are retained as source
records but are not used as scene imagery.

Reproduce from this directory’s pinned originals:

    python tools/objects/acquisition/geology-grid.py src/objects/titan/source/geology/prepare-grid.json

Use the scientific Python versions in tools/objects/acquisition/requirements-mapped-science.txt.
The original downloadable files and exact SHA-256 hashes are in release-files.json;
the shared acquisition recipe group is cassini-atlas. The compact output TIFF
is checked in, so ordinary installation needs no scientific source processing.
