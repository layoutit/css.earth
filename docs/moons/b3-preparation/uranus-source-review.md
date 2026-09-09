# B3 Uranus GIS source review

Checked 2026-09-09 against merged B2 `ef07fac2d`. This is source intake, not a qualified globe view.

## Exact releases recovered

Both previous access blockers are resolved through normal public API access. [Miranda 20817533](https://zenodo.org/records/20817533) and [Titania 20819132](https://zenodo.org/records/20819132) are Thomson–Baynham releases dated 2026-06-23, CC BY 4.0. All 51 selected ZIP/style/preview files were downloaded; byte lengths and publisher MD5 checksums match, and local SHA-256 pins are retained in [acquisition](uranus-gis-acquisition.json). Original inputs and release metadata are beside each body under `source/science/geology-2026/`. No GIS data have been uploaded or substituted from a third-party mirror.

Miranda's `Miranda map 1.gdb.zip` is 224,923 bytes, SHA-256 recorded in the receipt. Titania's `Titania Map 2.gdb.zip` is 126,593 bytes, SHA-256 `6a2a2020440a3def8b9d014b95588badf9ac26d16a45251e4a93fd2da8632bbf`.

## Coordinate defect: the declared CRS is not a usable moon registration

Fiona/GDAL successfully enumerated every feature class; see [inventory](uranus-gis-inventory.json). Both databases declare an orthographic projection on **Earth WGS84**, centred at 40°N, 75°W, in metres. Polygon bounds are around 0.3–5.1 units. Applying that WKT literally would place a few-metre drawing on Earth, not geologic units across these moons. Body names in the projection title do not repair the coordinate system.

The release previews show the actual historical south-polar maps, including cardinal longitude labels and (on Titania) latitude graticules. The [project's own LPSC abstract](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1331.pdf) identifies the historical maps as Croft & Soderblom (1991). Its planned registered analysis-ready products are not proof that this particular June ZIP already supplies them. The original raster basemaps referenced by the layer files are local desktop paths and absent from the release.

## Reconstructed registration under investigation

An exploratory independent alignment compares vector outlines to the publisher's preview using multiple colored units. It solves pixel X = sx × page X + tx, pixel Y = ty − sy × page Y. This is a diagnostic fit, not an accepted coordinate calibration. The script currently records the original local intake path; it must be turned into a pinned reproducible preparation step before use.

Miranda's 5,958 sampled boundary residuals have median 1.35 preview pixels, 90th percentile 2.37, and RMS 2.34. Titania's 2,779 samples have median 1.07 pixels and 90th percentile 3.93, but RMS **14.81** and maximum **92.93**: source category overlap/style differences create large outliers. Those outliers cannot be discarded to claim a uniformly good fit. Exact per-body results are retained beside this report.

A preliminary south-polar stereographic interpretation of the preview's graticule agrees with multiple independent [USGS Titania](https://planetarynames.wr.usgs.gov/Page/TITANIA/target) crater centres at roughly 1–3°; [Miranda](https://planetarynames.wr.usgs.gov/Page/MIRANDA/target) Alonso, Gonzalo and Stephano centres similarly provide independent checks. These are preliminary identities/centroids, not held-out registration qualification. The publisher's page geometry, the older cartographic control network, and current source mosaics have distinct errors. A correctly digitized historical map is not a newly measured composition or age map.

## Semantics and topology

Miranda has 18 nonempty styled polygon-unit datasets, plus archived old/empty versions and linework. Titania has 10 styled polygon-unit datasets plus intermediates, lines and empty feature classes. Layer-file dataset names, visibility and stack order must be reconciled to the published preview: at least some preview colors differ from the exported styles. Preserve empty classes and alternate versions as source history without drawing duplicates. The geometry has Z coordinates, but no released measured elevation semantics; do not use Z as terrain relief.

Before implementation: bind the published map's coordinate system and projection scale; select explicit fit controls and independent held-out landmarks; resolve layer priority, category dictionary and coverage; preserve unmapped regions and holes; report sampling and registration limitations beside the historical Geology lens. A new preparation capability is justified only by those closed source requirements. Current SOURCE.md/recipes remain unchanged until this is qualified.
