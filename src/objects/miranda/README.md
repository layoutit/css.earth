# Miranda

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Miranda uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images and updated control networks. Both original ISIS3 cubes contain 6294 × 3147 floating-point samples on a 240 m simple-cylindrical grid. Grid spacing is not uniform effective image or elevation resolution. The release's [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) is retained as text in [the retained author notes](source/observations/aaReadMe_uranian_MAP_DEM.txt).

**Monochrome** uses `mumap-cyl-180180.cub`. Its ISIS history includes `photomet` normalization (2020-02-17, ellipsoid angles, maximum emission 83°, maximum incidence 89.9°). We retain that corrected product and apply one linear display stretch from 0–2400 DN to 0–255. This is a display of the published mosaic, not newly calibrated reflectance. Local cast shadows, camera marks and mosaic seams remain; no detail is invented beneath them.

**Elevation** uses `mudem-ZT-cyl.cub`, the merged stereogrammetry and photoclinometry product. Values are kilometres relative to the published reference ellipsoid described in the author's README, not sea level or the application's mean-radius sphere. The displayed scale spans −6 to +7 km and includes the observed extrema (approximately −5.51 to +6.36 km). Shared northwest hillshade uses the actual kilometre-to-metre conversion and latitude-dependent pixel spacing. It supplies slope detail without reusing photographic shadows or altering the numerical color scale. Source errors and smooth lower-resolution patches remain visible; this visualization is not an uncertainty-qualified geophysical analysis.

**Geology** uses Thomson and Baynham's [2026 digitized historical map](https://zenodo.org/records/20817533), released under CC BY 4.0. The exact GIS database, layer styles, publisher preview and release metadata are retained in `source/science/geology-2026/`. This is an interpretation of Voyager-era surface units, not measured composition, a new terrain model or newly controlled imagery.

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| normal | 149.2 → 164.4 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/miranda/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](inventory.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Miranda; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 3200 × 1600 (DPR 1) and 6400 × 3200 (DPR 2) — retired 6400 × 3200 atlas; native cube 6294 × 3147. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js miranda --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/miranda/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, elevation, geology) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 2704).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

The checked Miranda landmark differences are 1.3–3.3° (approximately 5–14 km); these are not uncertainty bounds for every unit boundary.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Miranda (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Inverness, Arden and Elsinore coronae on the prepared minimap (the Voyager mosaic is a ±180° cylindrical cube) coincide with the imagery.

Feature notes: 3 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

ISIS special pixels remain missing before interpolation. Gray grid marks unobserved areas and missing DEM measurements. Valid black pixels are not mistaken for gaps. No northern hemisphere is synthesized, mirrored or borrowed.

Geology’s sampled, cosine-weighted reference-sphere coverage is approximately 44.2%; unmapped northern terrain remains unknown.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="surface-interpretation"></a>
<a id="historical-geology"></a>
<a id="dataset-survey"></a>

<details>
<summary>Methods and source notes</summary>

**Surface interpretation**

The cube labels declare a 240400 m equatorial mapping radius, 232900 m polar radius, planetocentric latitude and positive-east longitude. Their longitude origins differ: the mosaic covers −180…180° with x origin −1510560 m, while the DEM covers 0…360° with x origin −755280 m; both retain projection center 180°, y origin 377760 m and 240 m pixels. Shared preparation decodes ISIS3 tiles and registers both into the application's 0…360° map. Independent numeric checks use the original cubes at [USGS Gazetteer](https://planetarynames.wr.usgs.gov/SearchResults?Target=98_Miranda) centres: Elsinore (257.1° E, 24.8° S), Arden (73.7° E, 29.1° S), and Inverness (325.7° E, 66.9° S).

All three lenses use a 6400 × 3200 prepared sampling grid, projective atlas gutters and 1024-pixel pole tiles. The shared 450-face sphere retains the vendored mean radius of 235.7 km; elevation is a lens, not exaggerated geometry. Shared flood curvature and optional directional Shadows apply to all three lenses. The default camera faces observed southern terrain (315° E, 60° S).

The minimaps and thumbnails come from these same prepared maps. The navigation/context marker samples observed terrain from the corrected mosaic and adds shared full-phase curvature. It is an illustrative terrain crop, not a newly observed full disc. Native source cubes are preserved byte-for-byte inside gzip, with original and compressed hashes in the manifest. A content-addressed source mirror avoids the release server's browser challenge during automated restoration. Large source binaries are excluded from Git and runtime installation.

**Historical geology**

The archive stores page-sized XY coordinates under an incompatible Earth WGS84 orthographic CRS. Preparation does not apply that declaration as moon geography. The independently reviewed `registration.json` maps positive-east, normalized south-polar stereographic coordinates into the original GIS page. Titania uses six identified crater centroids for fitting and four separate named craters for validation. Miranda uses six publisher-graticule intersections for fitting and six interleaved intersections for validation, followed by three independently identified crater checks.

The lens includes 18 nonempty styled polygon categories with their original unit names and colors. Source Z coordinates are not heights. Structural linework and annotation are not turned into terrain or extra polygon units. Publisher-preview overlap evidence establishes only a partial layer order; combinations with no unique supported winner remain missing. Original polygon holes are preserved. The nearest-neighbor categorical conversion uses a 1440 × 720 display grid, with no interpolation between classes, relief or artificial boundary detail. Valid black material is distinct from no-data code 65535.

Reproduce the categorical input with `python tools/objects/prepare-geologic-categories.py src/objects/miranda/source/preparation/geology-conversion.json`, using the dependency versions in the converter's header. The recipe pins the archive and registration, checks feature populations and archived CRS identity, and records ambiguous overlaps and the exact output hash in `categories.receipt.json`. Original release MD5 and acquisition SHA-256 receipts remain alongside the sources. Shared preparation then consumes the checked-in categorical input through the existing scientific GeoTIFF path. The runtime receives prepared images only.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

Physical/orbital values come from the vendored astronomy package: JPL satellite elements and IAU/NAIF rotation at the shared epoch. [NASA's overview](https://science.nasa.gov/uranus/moons/miranda/) supplies editorial facts. No atmospheric shell is supported.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 235.7 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 1.4138-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 23.02° initial pitch, -48.20° yaw, taken from the retired lane's camera).

</details>
