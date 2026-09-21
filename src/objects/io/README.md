# Io

## Sources

- **Monochrome:** USGS [Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_global_mosaic_1km), `Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif`.

- **Enhanced color:** USGS [Voyager/Galileo false-color global mosaic](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_false_color_global_mosaic_1km), the Galileo SSI global false-color mosaic.

- The Geology view uses the original `Io_GeoUnits` polygon/attribute/projection members from [USGS SIM3168](https://pubs.usgs.gov/sim/3168/), Williams et al. (2011), at 1:15,000,000.

- The VLT/MUSE views use original July 2019 measured maps from King et al. The [source interpretation](source/muse/INTERPRETATION.md) defines units, coordinate evidence, first-valid-night coverage, registration limits and residual night differences.

- **Volcanic heat:** Table A1 of [Davies et al. (2024), Planetary Science Journal 5, 121](https://doi.org/10.3847/PSJ/ad4346) (CC BY 4.0), in its [machine-readable form](https://content.cld.iop.org/journals/2632-3338/5/5/121/revision1/psjad4346t10_mrt.txt): 343 thermal sources ranked by power, with latitude, west longitude and power in GW. Per the table notes it combines the estimates of Veeder et al. (2015), Keck and Gemini detections, and new Juno JIRAM detections up to Juno's orbit PJ49; the paper's Figure 1 caption calls it nearly 30 years of observations. The symbol classes, colors and sizes are the paper's Figure 1, drawn over the Monochrome mosaic as the figure draws them over a grayscale Io.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; the 8K latitude-band images from #151, geometry and lighting are retained. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| enhanced | 247.3 → 244.8 kB |
| normal | 118.5 → 118.9 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/c13f3643b53171523dbf59dc92fc7ce49e9c0e24/src/planets/io/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Photographic refresh, 12 September 2026, on base `3efdf2c9`:
[monochrome detail](evidence/photographic-detail/monochrome.png) and
[the Pele hemisphere in enhanced color](evidence/photographic-detail/pele-hemisphere.png)
were inspected in Chrome, 1280 × 720, with Shadows on/off and DPR 1 and 2.
The native color mosaic remains soft around Pele; increasing the atlas size
cannot recover detail absent from the observations.

Preparation build/type checks, source-record generation and unchanged
scene/geometry checks pass. The feature refresh reproduces 260 names from the
same Gazetteer snapshot with the corrected map origin. Only the feature
catalogue pin changes in the runtime definition. The ten photographic files
total 5.22 MB, previously 2.30 MB; the largest decoded atlas is 195 MiB.
Three unrelated scientific thumbnails were unavailable locally, and cross-body
search used a preview index of these three moons. This does not qualify all
scientific lenses or the aggregate application.

This photographic refresh preserves the source maps, masks, geometry and scene
structure. It increases photograph sampling to 4096 × 2048 and 8192 × 4096.
It also corrects the feature catalogue's map origin from 180° to 0° E: the
photograph decoder already outputs 0–360° E. The previous origin put all 260
named features on the opposite hemisphere. Pele now selects its red deposit
at 18.71° S, 104.72° E, consistent with the [Gazetteer](https://planetarynames.wr.usgs.gov/Feature/4638).

Earlier run at base `53b262bd` (12 September 2026): `node tools/objects/dist/prepare-authored.js io --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/io/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced, geology, spectral-slope, visible-absorption) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 3459).

The earlier map-edge claim was incorrect for Io: it confused the native GeoTIFF edge with the decoded output edge. The current check uses the decoder coordinates and the mounted photographic deposit.

- Six distributed anchors, exact source hashes, hole/seam behavior, and categorical exclusion rules are exercised by the focused geology/source tests.

- Focused checks are defined in the [unit tests](../../../tests/objects/unit/io).

Volcanic heat, September 2026:

- **Reading the table.** `tools/objects/terrestrial-layers/mrt-point-table.mts` checks the table's own column description (byte ranges, formats, units and wording, including "Degrees West longitude") against the recipe, then reads 343 rows in rank order ([unit tests](../../../tools/objects/terrestrial-layers/mrt-point-table.test.mts)).
- **Handedness.** West longitudes become east as 360° − W. Loki Patera (308.4°W), Pele (255.6°W), Janus Patera (39.0°W) and Pillan (241.5°W) then land within 2° of their [IAU Gazetteer](https://planetarynames.wr.usgs.gov/Page/IO/target) east longitudes, and nothing is drawn at the mirrored longitudes ([test](../../../tests/objects/unit/io/volcanic-heat.test.mts)).
- **Classes.** The legend's five classes are <1, 1 to 10, 10 to 100, 100 to 1000 and 1000 to 10,000 GW. A source exactly on a boundary goes to the higher class: Figure 1 shows 7 blue dots, the 7 sources under 1 GW, and Michabo Patera at exactly 1.0 GW is not among them. The table gives 7, 76, 150, 101 and 9 sources per class; we counted 7, 75, 138, 97 and 8 separate symbols of each color in the figure, where touching symbols merge.
- **In the browser.** [Volcanic heat](evidence/volcanic-heat/volcanic-heat.png) at the default camera, headless Chromium 148, 1440 × 900, DPR 1, Shadows off; the page loaded the lens's own surface and pole images with no console errors.

Edge meridian, 13 September 2026: the Normal and Enhanced GeoTIFFs span 360° of longitude, and their recipe now declares `wrapLongitude`. Before, the 2× maps kept one missing column at 180°, filled by the gray coverage grid. A [matched crop](evidence/wrap-longitude/crop.json) of the Normal 2× map, taken from main's published file and from this version, has 33 of 36,864 pixels over the Pixelmatch threshold of 0.1 ([report](evidence/wrap-longitude/change.json)). The largest change is 36 levels at the 180° column; no other column changes by more than 7, which is WebP re-encoding. The [comparison](evidence/wrap-longitude/comparison.png) shows the map pixels and this version in the browser.

## Known problems

The existing atlas seams can remain visible at extreme close zoom. This change
retains the geometry and its packing layout.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Io (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the decoded map’s left edge at 0° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude now shares the Gazetteer origin.

Feature notes: 44 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- **Enhanced color:** Its colors are enhanced and do not represent a visual true-color measurement. Io changed between the Voyager and Galileo observations; the mosaic is not a single-date snapshot, and spatial/brightness/color boundaries remain visible.

- USGS explicitly states that color lacks coverage within approximately 5° of both poles and that merged polar color was interpolated. We therefore withhold color at |latitude| ≥ 85° before resampling. Independently valid monochrome replaces missing or withheld color. The shared neutral gray grid appears only where neither source provides valid imagery.

- **Geology:** Colors are authored categorical choices, not measured color, chemical abundance or elevation.

- **Geology source audit:** The separate label-point layer differs from final polygon classifications at 43 of 1,498 comparable points.

- The scene is a mean-radius sphere, not a topographic shape model.

- **Volcanic heat symbols are not the size of the hot spots.** Most hot spots are far smaller than one symbol. The sizes are the paper's display classes, kept as fixed angles on the sphere, so on the flat map preview they widen toward the poles.
- **Volcanic heat layering.** Where symbols overlap, later rows in the table (the stronger sources) are drawn on top. The paper does not state its drawing order, and in at least one place (beside Tvashtar Paterae) its figure draws a 10 to 100 GW symbol over a 100 to 1000 GW one.
- **Volcanic heat is a composite of different epochs.** The table combines nearly 30 years of observations; a source's power is the paper's estimate, not a single-date measurement.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

Original false-color mosaic filename:

```text
Io_Galileo_SSI_Global_Mosaic_FalseColor_1km.tif
```

<a id="io-sources-and-preparation"></a>

Io is Jupiter's innermost Galilean moon. The scene uses the shared standalone object runtime, camera, shell and prepared lighting.

## Body and frame

The vendored astronomy package supplies Io's 1821.49 km mean radius, IAU/WGCCRE body rotation and JPL parent-relative orbit. Solar and sky directions use the shared J2000 ICRF/ecliptic registration and the same prepared presentation frame as the body.

NASA's [Io facts](https://science.nasa.gov/jupiter/jupiter-moons/io/facts/) support the introduction and facts: intense tidal volcanism, synchronous rotation, roughly 422,000 km distance from Jupiter, and a thin sulfur-dioxide atmosphere. The atmosphere does not justify a visible halo, so none is rendered. No simulated lava, plume, thermal measurement or elevation lens is supplied.

## Observed surfaces

Exact source byte lengths, SHA-256 identities, credits and direct restoration URLs are in `source/manifest.json`.

Both GeoTIFFs contain 11445 × 5723 samples on a 1000 m grid. Actual monochrome detail varies from approximately 1–10 km per pixel. Color detail varies from 1.3–21 km per pixel; the published enhanced product combines Galileo near-infrared, green and violet color ratios with Voyager/Galileo monochrome detail. This is an existing USGS derived observation product, not a new detail transfer in cssEarth.

USGS reports calibration, geometric control, Lunar–Lambert limb-darkening correction with coefficient 0.7, and seam matching in production of these products. We preserve the published display values, with no second photometric correction or brightness fit. Photographed terrain shadows remain possible. Our existing **Shadows** control remains active for both lenses; its globe lighting is approximate and cannot infer relief hidden in a photographed shadow.

## Coordinates and validity

The GeoTIFF georeference, rather than the catalog's positive-west coordinate labels, defines raster sampling. Both products use a simple cylindrical sphere of radius 1821460 m, center longitude 0°, origin (-5723000, 2862000) m and pixel increments (+1000, -1000) m. East increases to the right, north is up. Preparation maps each canonical output pixel centre through the actual metric origin and increments, using native bilinear interpolation. The outer longitude is −180.022479853° and the map spans 360.013503743°; those fractional bounds are preserved rather than rounded to an integer roll or stretched to a full globe. Output longitude remains 0–360° positive-east, without horizontal reflection. [Pele's](https://planetarynames.wr.usgs.gov/Feature/4638) large red deposit at 18.71° S, 104.72° E (255.28° W) is an independent orientation landmark. The 30 m difference from the current astronomical mean radius is not interpreted as terrain.

`GDAL_NODATA=0` marks missing raster data. Monochrome uses exact zero; enhanced color requires the complete RGB tuple to be zero. Low but nonzero observed dark terrain is retained. Every native contributor with nonzero bilinear weight must be valid; incomplete or masked interpolation footprints are withheld. This coordinate correction replaces the earlier whole-image resize and roll, so prepared image bytes change while the original source values remain unchanged.

This is a conservative geographic cut based on the published approximate coverage boundary, not a recovered per-image observation mask. No synthetic terrain or extrapolated pole color is used.

## Prepared delivery

The shared raster lane now samples the original 11,445 × 5,723 photographs into
4,096 × 2,048 and 8,192 × 4,096 maps before packing. The larger map has roughly
1.4 km equatorial texel spacing; source areas coarser than that remain coarse.
Pole sprite dimensions, geometry, scientific maps and lighting are unchanged.
Canonical assets are selected once per mount, independently of DPR. Runtime only
decodes and transports prepared assets.

Inter provides prepared title outlines.

Source restoration and prepared runtime installation are separate. The runtime inventory binds all assets needed by this package; installing prepared assets does not require acquiring the source GeoTIFFs.

## Preparation ownership

This package contains authored JSON recipes, source provenance, and generated JSON. Reusable observation masking, projection, lighting, celestial, and retained-scene operations live in `tools/objects/terrestrial-layers/`; no package-local executable preparer or runtime is required.

Delivery keeps the prepared HD texture dimensions. Surface and polar atlases use WebP quality 90 with full-quality alpha; source maps remain lossless. Lighting stays lossless.

## Interpreted geology

Fourteen base-unit categories distinguish plains, flows, patera floors and mountains. Five diffuse-deposit classes belong to a separate overlay and are not rendered here. No terrain displacement is derived from these polygons.

Exact raw members and archive/member CRC32/SHA-256 receipts are retained in `source/science/geology-sim3168/`. The actual SHP is signed east-positive planetocentric degrees on a 1,821,460 m sphere. West-longitude point attributes independently verify the sign: the same first point is −97.1448317468° in SHP X and +97.144831747° in `Long_W`. The displayed 1,821,490 m radius retains those angular positions; the 30 m radius difference is not height. `NoData` polygons, unmapped polar areas and conflicting overlapping categories remain missing.

These source discrepancies and the explicit `Pb/Pby`, `Pw/Pbw`, `T/Tb` aliases are retained in the registration audit, rather than forcing label points to replace the polygon `Unit` attribute. The [original preparation and browser qualification](https://github.com/layoutit/cssEarth/tree/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b2-preparation/) records retain the tested version and results.

## Visible spectral surface views

Every conversion is offline; the scene geometry remains unchanged.

</details>

<details>
<summary>Volcanic heat symbols</summary>

Each source is a circle on the sphere centred on its table position. The circle's angular diameter is the Figure 1 symbol width converted at the map's equator, where the Mollweide scale is 2033 pixels for 360° of longitude (5.647 pixels per degree) in the published high-resolution figure (`psjad4346f1_hr.jpg`, 2166 × 1219):

| Class | Symbol width in the figure | On the sphere | Color |
| --- | --- | --- | --- |
| <1 GW | 17 px | 3.01° | `#2a00f7` |
| 1 to 10 GW | 23 px | 4.07° | `#84ff2b` |
| 10 to 100 GW | 25 px | 4.43° | `#cb181b` |
| 100 to 1000 GW | 27 px and a 3 px black ring | 4.78° and 0.53° | `#e3b229` |
| 1000 to 10,000 GW | 40 px and a 3 px black ring | 7.08° and 0.53° | `#f3ff31` |

Widths are the median bounding-box width of the symbols of each color that stand alone; colors are the median centre pixel of those symbols; the ring is the dark run beyond the fill in horizontal profiles, and its color the median of those pixels (`#010101`). Pixels outside every symbol show the Monochrome lens at the same size. On Io, 1° is about 31.8 km.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 1821.49 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 1.7627-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera).

</details>
