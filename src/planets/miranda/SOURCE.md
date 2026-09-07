# Miranda

Miranda uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images and updated control networks. Both original ISIS3 cubes contain 6294 × 3147 floating-point samples on a 240 m simple-cylindrical grid. Grid spacing is not uniform effective image or elevation resolution. The release's [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) is retained as text in `source/observations/aaReadMe_uranian_MAP_DEM.txt`.

## Surface interpretation

**Monochrome** uses `mumap-cyl-180180.cub`. Its ISIS history includes `photomet` normalization (2020-02-17, ellipsoid angles, maximum emission 83°, maximum incidence 89.9°). We retain that corrected product and apply one linear display stretch from 0–2400 DN to 0–255. This is a display of the published mosaic, not newly calibrated reflectance. Local cast shadows, camera marks and mosaic seams remain; no detail is invented beneath them.

**Elevation** uses `mudem-ZT-cyl.cub`, the merged stereogrammetry and photoclinometry product. Values are kilometres relative to the published reference ellipsoid described in the author's README, not sea level or the application's mean-radius sphere. The displayed scale spans −6 to +7 km and includes the observed extrema (approximately −5.51 to +6.36 km). Shared northwest hillshade uses the actual kilometre-to-metre conversion and latitude-dependent pixel spacing. It supplies slope detail without reusing photographic shadows or altering the numerical color scale. Source errors and smooth lower-resolution patches remain visible; this visualization is not an uncertainty-qualified geophysical analysis.

The cube labels declare a 240400 m equatorial mapping radius, 232900 m polar radius, planetocentric latitude and positive-east longitude. Their longitude origins differ: the mosaic covers −180…180° with x origin −1510560 m, while the DEM covers 0…360° with x origin −755280 m; both retain projection center 180°, y origin 377760 m and 240 m pixels. Shared preparation decodes ISIS3 tiles and registers both into the application's 0…360° map. Independent numeric checks use the original cubes at [USGS Gazetteer](https://planetarynames.wr.usgs.gov/SearchResults?Target=98_Miranda) centres: Elsinore (257.1° E, 24.8° S), Arden (73.7° E, 29.1° S), and Inverness (325.7° E, 66.9° S).

ISIS special pixels remain missing before interpolation. Gray grid marks unobserved areas and missing DEM measurements. Valid black pixels are not mistaken for gaps. No northern hemisphere is synthesized, mirrored or borrowed. Both lenses use a 6400 × 3200 prepared sampling grid, projective atlas gutters and 1024-pixel pole tiles. The shared 452-face sphere retains the vendored mean radius of 235.7 km; elevation is a lens, not exaggerated geometry. Shared flood curvature and optional directional Shadows apply to both lenses. The default camera faces observed southern terrain (315° E, 60° S).

The minimaps and thumbnails come from these same prepared maps. The navigation/context marker samples observed terrain from the corrected mosaic and adds shared full-phase curvature. It is an illustrative terrain crop, not a newly observed full disc. Native source cubes are preserved byte-for-byte inside gzip, with original and compressed hashes in the manifest. A content-addressed source mirror avoids the release server's browser challenge during automated restoration. Large source binaries are excluded from Git and runtime installation.

## Dataset survey

| Candidate | Disposition |
| --- | --- |
| Schenk/LPI 2020 corrected mosaic | Included as Monochrome; replaces the lower-density JPL display map. |
| Schenk/LPI 2020 merged numeric DEM | Included as Elevation with its own validity, datum, scale and relief. |
| [JPL simulator `ura5vuu2.tif`](https://space.jpl.nasa.gov/tmaps/uranus.html), 1440 × 720 | Superseded; not a duplicate Monochrome lens. |
| [PIA01490 south-polar press mosaic](https://science.nasa.gov/photojournal/south-polar-view-of-miranda/) and color press views | Excluded from mapped lenses: a rendered disc or press image alone does not establish usable surface registration or global color coverage. |
| [2026 digitized geological map](https://zenodo.org/records/20817533) | A distinct interpretive candidate, deferred. Its vector units, projection and coverage need separate qualification; this pass does not claim every available dataset is implemented. |
| [USGS Voyager control network](https://astrogeology.usgs.gov/search/map/miranda_voyager_image_control_network) | Registration support, not a separate surface measurement or lens. |

Physical/orbital values come from the vendored astronomy package: JPL satellite elements and IAU/NAIF rotation at the shared epoch. [NASA's overview](https://science.nasa.gov/uranus/moons/miranda/) supplies editorial facts. No atmospheric shell is supported. No body-specific controller is added.

Restore sources with `node tools/objects/dist/operations.js acquire miranda`; verify with `pnpm acquire:planets -- --verify-only --object=miranda`. Prepare with `node tools/objects/dist/prepare-authored.js miranda --write`, then shared navigation/world context. Runtime-only installation is `pnpm setup:assets --object=miranda`; neither numeric source cubes nor other bodies' textures are required.
