# Ariel

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Ariel uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images and revised cartographic control. The original [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) is retained in [the retained author notes](source/observations/aaReadMe_uranian_MAP_DEM.txt).

**Monochrome** displays the source-corrected Voyager mosaic. [Schenk and Moore (2020)](https://doi.org/10.1098/rsta.2020.0102) describes lunar-Lambert normalization of the best-resolved images to reduce planetary shading; the result approximates normal reflectance and is not a true albedo map. Ariel's best mosaic has approximately 1 km image samples, with two smeared terminator images replaced by desmeared versions supplied by Stryk and Stooke. Cast shadows, camera marks, seams, and unequal local resolution remain. No additional photometric recovery is claimed.

**Elevation** displays the release's merged stereogrammetric and photoclinometric DEM. The author README also identifies limb-profile contributions to Ariel's DEM. Values are kilometres above the published reference ellipsoid, not sea level or the application sphere. Fixed cartographic relief uses those actual height units and latitude-dependent pixel spacing. The unshaded numeric legend describes elevation; shading describes slopes. Image-derived errors and smoother lower-resolution patches remain, and the release author recommends contacting him before scientific analyses or proposal use.

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| normal | 119.9 → 132.8 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/ariel/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Ariel; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — native ISIS cube 3652 × 1826; the retired 5760 × 2880 atlas was an upsample (2880/2 = 1440 is not a multiple of 64). Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js ariel --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/ariel/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, elevation) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 6638).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

Kachina Chasmata's Gazetteer centre has mosaic imagery but no valid DEM sample, which the numeric regression preserves.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ariel (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Kachina Chasmata and the named craters on the prepared minimap (±180° cylindrical cube) coincide with the imagery.

Feature notes: 5 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

Only source-valid samples are interpolated. ISIS special pixels become the shared neutral grid. Low intensity is not by itself a missing-data rule. The northern region unseen by Voyager is not reconstructed, mirrored, or filled with another body's texture. The paper discusses faint Uranus-shine observations of northern terrain; their existence is not treated as global mapped coverage.

The DEM contains sparse curved limb-profile tracks outside the denser image-derived terrain coverage; those are real source-valid samples, not continuous regional coverage. They remain visible without filling their surroundings.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="selected-interpretation"></a>
<a id="source-grid-and-preparation"></a>
<a id="dataset-survey"></a>

<details>
<summary>Methods and source notes</summary>

**Source grid and preparation**

The selected original files are `aumap-cyl-180180.cub` and `audem-ZTL-cyl-180180.cub`. Both are 3652 × 1826 ISIS3 Real/Lsb cubes tiled in 332 × 166 samples. Their labels declare simple cylindrical projection, planetocentric latitude, positive-east longitude, a −180…180° range, center longitude 180°, equatorial mapping radius 581100 m, polar radius 577700 m, upper-left origin (−3652000, 913000) m, and 1000 m pixels. The shared loader registers these into the application's 0…360° maps before preparing retained surface and pole atlases.

The mosaic's own ISIS history records `photomet` on 2020-02-22 with ellipsoid angles, maximum emission 70°, maximum incidence 89.9°, followed by the release's low/high-frequency mosaicking and display stretch. Preparation retains this supplied processing and applies one linear 0–3000 DN display stretch, clamping display endpoints while keeping valid dark samples valid. This is a display choice, not a conversion to physical reflectance. The source values span approximately −895 to 8699 DN; bright outliers exceed the display range. Small-map comparisons at upper bounds 2400, 3000, and 3600 DN informed the selected contrast.

The DEM's numeric extrema are approximately −7.024 and +5.796 km. Its displayed scale is −8 to +6 km. Northwest cartographic lighting uses a unit direction (−0.5 east, +0.5 north, +0.7071 up), ambient 0.25, and the actual 1000 m/km height conversion without height exaggeration.

Both lenses use the same fixed 5760 × 2880 prepared sampling bank, 64-pixel projective gutters and 1024-pixel pole tiles independently of DPR. This density supports the retained projective mapping and does not add native detail. The shared 450-face sphere uses the vendored 578.9 km mean radius; elevation colors do not displace its geometry. Both views support shared flood curvature and optional directional Shadows. The default camera targets 270° E, 50° S.

Minimaps and thumbnails use the same prepared interpretation. The navigation/context marker is a purpose-sized crop of observed southern terrain, with shared full-phase curvature; it is not a new full-disc observation. Its original normalized-map crop is (2200, 1100), 700 × 700 pixels. Original cube bytes are retained unchanged inside gzip with both original and compressed hashes in the manifest. Content-addressed source URLs allow automated restoration without the upstream browser challenge; large source binaries are excluded from Git and runtime installation.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

Physical/orbital values come from the vendored astronomy package: JPL satellite elements and IAU/NAIF Ariel rotation at the shared epoch. [NASA's Ariel overview](https://science.nasa.gov/uranus/moons/ariel/) supplies editorial and discovery facts. No atmospheric shell is supported.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 578.9 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 2.5207-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 37.55° initial pitch, -104.50° yaw, taken from the retired lane's camera).

</details>
