# Miranda

Miranda uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images and updated control networks. Both original ISIS3 cubes contain 6294 × 3147 floating-point samples on a 240 m simple-cylindrical grid. Grid spacing is not uniform effective image or elevation resolution. The release's [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) is retained as text in `source/observations/aaReadMe_uranian_MAP_DEM.txt`.

## Surface interpretation

**Monochrome** uses `mumap-cyl-180180.cub`. Its ISIS history includes `photomet` normalization (2020-02-17, ellipsoid angles, maximum emission 83°, maximum incidence 89.9°). We retain that corrected product and apply one linear display stretch from 0–2400 DN to 0–255. This is a display of the published mosaic, not newly calibrated reflectance. Local cast shadows, camera marks and mosaic seams remain; no detail is invented beneath them.

**Elevation** uses `mudem-ZT-cyl.cub`, the merged stereogrammetry and photoclinometry product. Values are kilometres relative to the published reference ellipsoid described in the author's README, not sea level or the application's mean-radius sphere. The displayed scale spans −6 to +7 km and includes the observed extrema (approximately −5.51 to +6.36 km). Shared northwest hillshade uses the actual kilometre-to-metre conversion and latitude-dependent pixel spacing. It supplies slope detail without reusing photographic shadows or altering the numerical color scale. Source errors and smooth lower-resolution patches remain visible; this visualization is not an uncertainty-qualified geophysical analysis.

The cube labels declare a 240400 m equatorial mapping radius, 232900 m polar radius, planetocentric latitude and positive-east longitude. Their longitude origins differ: the mosaic covers −180…180° with x origin −1510560 m, while the DEM covers 0…360° with x origin −755280 m; both retain projection center 180°, y origin 377760 m and 240 m pixels. Shared preparation decodes ISIS3 tiles and registers both into the application's 0…360° map. Independent numeric checks use the original cubes at [USGS Gazetteer](https://planetarynames.wr.usgs.gov/SearchResults?Target=98_Miranda) centres: Elsinore (257.1° E, 24.8° S), Arden (73.7° E, 29.1° S), and Inverness (325.7° E, 66.9° S).

ISIS special pixels remain missing before interpolation. Gray grid marks unobserved areas and missing DEM measurements. Valid black pixels are not mistaken for gaps. No northern hemisphere is synthesized, mirrored or borrowed. Both lenses use a 6400 × 3200 prepared sampling grid, projective atlas gutters and 1024-pixel pole tiles. The shared 452-face sphere retains the vendored mean radius of 235.7 km; elevation is a lens, not exaggerated geometry. Shared flood curvature and optional directional Shadows apply to both lenses. The default camera faces observed southern terrain (315° E, 60° S).

The minimaps and thumbnails come from these same prepared maps. The navigation/context marker samples observed terrain from the corrected mosaic and adds shared full-phase curvature. It is an illustrative terrain crop, not a newly observed full disc. Native source cubes are preserved byte-for-byte inside gzip, with original and compressed hashes in the manifest. A content-addressed source mirror avoids the release server's browser challenge during automated restoration. Large source binaries are excluded from Git and runtime installation.

## Historical geology

**Geology** uses Thomson and Baynham's [2026 digitized historical map](https://zenodo.org/records/20817533), released under CC BY 4.0. The exact GIS database, layer styles, publisher preview and release metadata are retained in `source/science/geology-2026/`. This is an interpretation of Voyager-era surface units, not measured composition, a new terrain model or newly controlled imagery.

The archive stores page-sized XY coordinates under an incompatible Earth WGS84 orthographic CRS. Preparation does not apply that declaration as moon geography. The independently reviewed `registration.json` maps positive-east, normalized south-polar stereographic coordinates into the original GIS page. Titania uses six identified crater centroids for fitting and four separate named craters for validation. Miranda uses six publisher-graticule intersections for fitting and six interleaved intersections for validation, followed by three independently identified crater checks. The checked Miranda landmark differences are 1.3–3.3° (approximately 5–14 km); these are not uncertainty bounds for every unit boundary.

The lens includes 18 nonempty styled polygon categories with their original unit names and colors. Source Z coordinates are not heights. Structural linework and annotation are not turned into terrain or extra polygon units. Publisher-preview overlap evidence establishes only a partial layer order; combinations with no unique supported winner remain missing. Original polygon holes are preserved. The nearest-neighbor categorical conversion uses a 1440 × 720 display grid, with no interpolation between classes, relief or artificial boundary detail. Valid black material is distinct from no-data code 65535. Its sampled, cosine-weighted reference-sphere coverage is approximately 44.2%; unmapped northern terrain remains unknown.

Reproduce the categorical input with `python tools/objects/prepare-geologic-categories.py src/planets/miranda/source/preparation/geology-conversion.json`, using the dependency versions in the converter's header. The recipe pins the archive and registration, checks feature populations and archived CRS identity, and records ambiguous overlaps and the exact output hash in `categories.receipt.json`. Original release MD5 and acquisition SHA-256 receipts remain alongside the sources. Shared preparation then consumes the checked-in categorical input through the existing scientific GeoTIFF path. The runtime receives prepared images only.

## Dataset survey

| Candidate | Disposition |
| --- | --- |
| Schenk/LPI 2020 corrected mosaic | Included as Monochrome; replaces the lower-density JPL display map. |
| Schenk/LPI 2020 merged numeric DEM | Included as Elevation with its own validity, datum, scale and relief. |
| [JPL simulator `ura5vuu2.tif`](https://space.jpl.nasa.gov/tmaps/uranus.html), 1440 × 720 | Superseded; not a duplicate Monochrome lens. |
| [PIA01490 south-polar press mosaic](https://science.nasa.gov/photojournal/south-polar-view-of-miranda/) and color press views | Excluded from mapped lenses: a rendered disc or press image alone does not establish usable surface registration or global color coverage. |
| [2026 digitized geological map](https://zenodo.org/records/20817533) | Included as historical Geology after page-coordinate reconstruction and independent landmark checks; original coverage and degree-scale registration limits remain explicit. |
| [USGS Voyager control network](https://astrogeology.usgs.gov/search/map/miranda_voyager_image_control_network) | Registration support, not a separate surface measurement or lens. |

Physical/orbital values come from the vendored astronomy package: JPL satellite elements and IAU/NAIF rotation at the shared epoch. [NASA's overview](https://science.nasa.gov/uranus/moons/miranda/) supplies editorial facts. No atmospheric shell is supported. No body-specific controller is added.

Restore sources with `node tools/objects/dist/operations.js acquire miranda`; verify with `pnpm acquire:planets -- --verify-only --object=miranda`. Prepare with `node tools/objects/dist/prepare-authored.js miranda --write`, then shared navigation/world context. Runtime-only installation is `pnpm setup:assets --object=miranda`; neither numeric source cubes nor other bodies' textures are required.
