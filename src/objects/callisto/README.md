# Callisto

## Sources

- The **Monochrome** lens uses the public-domain USGS [Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km).

- The **Galileo color** lens uses the official USGS RGBA copy of NASA/JPL/DLR [PIA03456](https://science.nasa.gov/photojournal/global-callisto-in-color/), recorded in May 2001 and released on August 22, 2001.

- The infrared view uses [the registered Galileo NIMS archive](https://doi.org/10.17189/4sq6-x165), observations G8CNADLIND01A and G8CNGLOBAL02A, Minnaert-corrected CIOF products.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| enhanced | 17.7 → 23.9 kB |
| normal | 216.9 → 227.4 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/callisto/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Callisto; the same pinned inputs and the same decoders (`terrestrial-observation` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are now painted at one 8192 × 4096 density for every DPR (asset record (`prepared/assets.json`)); native 1 km mosaic 15,146 px wide. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js callisto --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/callisto/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced, infrared) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 6284).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

- The two training quadrants and two disjoint held-out quadrants are recorded in [source/validation/galileo-color-registration.json](source/validation/galileo-color-registration.json). An independent review sampled the original 15,138 × 7,569 reference at its exact GeoTIFF coordinates, without adjusting the fit: upper-right and lower-left unblurred correlations were 0.713 and 0.573.

- Focused checks are defined in the [unit tests](../../../tests/objects/unit/callisto) and the shared browser conformance harness.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Callisto (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 0° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude counts from the map’s left edge, which here coincides with the Gazetteer origin. The map edge was fixed by cropping the source raster at a landmark’s Gazetteer centre under both hypotheses (see the pull request that added the feature).

Feature notes: 12 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Original observations range from 400 m to 60 km per pixel. Coarse observed patches are retained; a fine grid spacing does not make those patches high resolution.

- **Galileo color:** These are published processed colors, not calibrated I/F, reflectance ratios or measured albedo. An explicit 65° emission limit retains **28.735%** of the sphere; unseen, grazing and nonopaque source regions remain missing.

- Local 0–1 pixel diagnostic offsets were never applied and do not establish a global absolute positional accuracy. The scene is a mean-radius sphere, not a measured terrain mesh: the astronomy package supplies 2,410.3 km.

- **Infrared:** This is a partial spectral-color view, not natural color or a mineral-abundance map.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

Callisto (`504`) is a standalone satellite of Jupiter. The package uses the shared object runtime, controls, input, camera and lighting contracts.

## Surface

The original GeoTIFF is pinned in `source/manifest.json`: 15,138 × 7,569 pixels, one 8-bit band, approximately 1 km grid spacing.

USGS describes [Lunar–Lambert normalization and linear overlap matching](https://astrogeology.usgs.gov/search/map/callisto_voyager_galileo_image_mosaic_map) in this mosaic family. We retain that processing. We do not run a second, unconstrained flattening over a mosaic without its contributing image geometry. Photographed crater relief and residual seams remain. The shared Shadows control adds approximate globe illumination; it is available and retains its established behavior. Shadows off keeps the shared curvature layer. No atmospheric halo is rendered for the moon's extremely tenuous exosphere.

The GeoTIFF declares `GDAL_NODATA=0`. Only exact zero and pixels whose resampling footprint includes that no-data are treated as missing. Preparation interpolates premultiplied validity and withholds partially covered pixels, then paints the shared neutral gray grid. Nonzero dark terrain stays observed terrain. No texture or color is invented for gaps. No elevation product is supplied.

## Galileo color

The [USGS release](https://www.usgs.gov/media/images/callisto-galileo-ssi-color-mosaic) marks it public domain. The original 646 × 653 PNG, release receipt, contemporaneous C30 GREEN label, PDS image catalog and Gazetteer are retained beside the source. No new radiometric correction or normalization is applied. The roughly 640-pixel disk supplies approximately 8 km class detail near its center; foreshortening worsens it toward the edge. Photographed shading, soft detail and color fringing remain.

A frozen perspective camera registers the published plate to the independent controlled USGS monochrome mosaic. Eight Gazetteer landmarks, including Vili, Valfodr, Alfr, Bran and Loni, match the same visible impact structures. The original diagnostic scripts retain their working paths for audit history; only the pinned conversion recipe is the reproduction entry point.

The derived 1,440 × 720 PixelIsArea RGBA GeoTIFF uses 0–360° east longitude, north-to-south rows, center longitude 180° and a 2,410,300 m sphere. That camera radius is deliberately distinct from the reference mosaic’s 2,409,300.0488 m cartographic radius. The converter samples only the original plate, bilinearly in display-byte space, requiring every nonzero-weight contributor to have alpha 255. It never reads reference-map texture while generating colors. Output no-data is all-zero RGBA, with `GDAL_NODATA=0`; a valid all-zero RGB collision causes conversion to fail. Valid dark terrain and pixels with only one zero color channel are retained. The shared observation pipeline then resamples by the actual source georeference and withholds any missing native contributor before painting the gray grid. There is no globally filled color map. The 8,192-pixel runtime atlas adds display sampling, not source resolution. Selecting this lens faces the observed hemisphere.

Reproduce the small checked-in source derivative with Python 3, numpy, Pillow and rasterio:

`python3 src/objects/callisto/source/preparation/prepare-galileo-color.py`

The script checks the original and registration hashes before writing, and emits `source/validation/galileo-color-conversion-proof.json` with the source, recipe, generator, TIFF and raw RGBA hashes, grid, validity count and spherical coverage. Use `--output-directory /tmp/callisto-reproduction` for an isolated comparison. The raw RGBA/grid identity is portable; exact compressed TIFF bytes also depend on the recorded GDAL/codec versions. Checked-in source files permit a normal body bake without installing Python or regenerating this derivative.

## Coordinates and prepared assets

The source sphere radius is 2,409,300.0488 m. GeoTIFF projected x increases east from 0° to 360°, centered on 180°; image rows run north to south. This is distinct from the west-positive longitude *labels* in USGS's older catalog description. For an independent landmark, [Valhalla](https://planetarynames.wr.usgs.gov/Feature/6284) is at 14.7° N, 56° W (304° E), on the right side of the source raster. The source prime meridian constant, 259.51° at J2000, agrees with the vendored IAU model.

Preparation downsamples to an 8,192 × 4,096 lossless map, bakes the projective latitude bands with proportionally scaled gutters, and prepares 1,024-pixel polar caps. These are selected once at every DPR. The physical sphere radius and map's original cartographic reference radius are kept distinct. No relief, bathymetry or interior model is inferred.

The existing astronomy package supplies JPL parent-relative orbital elements, Jupiter's heliocentric position and IAU rotation at the shared prepared epoch. The orbital period is about 16.69 days and mean distance from Jupiter about 1,883,000 km. [NASA's facts](https://science.nasa.gov/jupiter/jupiter-moons/callisto/facts/) provide the brief introductory content. A possible subsurface ocean is uncertain.

## Checks and source restoration

The original TIFF and font remain reacquirable, ignored inputs. Runtime assets are independently described by `runtime-assets.json`. Publication and isolated installation are separate from local source verification.

## Preparation ownership

This package contains authored JSON recipes, source provenance, and generated JSON. Reusable observation masking, projection, lighting, celestial, and retained-scene operations live in `tools/objects/terrestrial-layers/`. The source-only registered color converter above produces a standard GeoTIFF; there is no body-specific runtime or alternate body preparation path.

Delivery keeps the prepared HD texture dimensions. The photographic normal and enhanced polar sprites sample their pinned source grids directly with a 2 × 2 footprint and retain lossless WebP encoding. Latitude-band and non-photographic prepared assets retain their existing encodings; source maps remain lossless. Lighting stays lossless.

## B6 mapped science

Following the archive guide, RGB selects same-parity bands near 0.77, 2.25 and 3.66 µm. The exact band centers vary slightly between observations and are pinned in `source/nims/prepare-composite.json`. Fixed I/F display ranges are R 0–0.45, G 0–0.45, B 0–0.2. The regional Asgard/Lindr observation has priority in overlap. Source geometry follows the USGS 2013 registration grid.

Exact bytes, coordinates and validity rules are in the intake plans and receipts. Reproduction: `tools/objects/acquisition/MAPPED-SCIENCE.md`.

The official USGS archive browser maps Individual Investigations to its working CloudFront endpoint in [main.js](https://pdsimage2.wr.usgs.gov/index-style/js/main.js). The original guides prescribe registered GeoTIFF geometry rather than COC backplanes. Unobserved cells remain the shared gray grid; no gap fill is used.

See [NOTICE.md](NOTICE.md) for credits.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 2410.3 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 16.6904-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera).

</details>
