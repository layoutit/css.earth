# Io

The navigation marker uses its existing source map as a stylized identifier. The [marker recipe](source/preparation/navigation.json) crops and resizes it, then prepares a circular alpha edge and the shared full-phase curvature shading (35% ambient, 65% diffuse). It is not an observer projection or a view at the scene epoch.

## Sources

- **Monochrome:** USGS [Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_global_mosaic_1km), `Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif`.

- **False color:** USGS [Voyager/Galileo false-color global mosaic](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_false_color_global_mosaic_1km), the Galileo SSI global false-color mosaic.

- The Geology view uses the original `Io_GeoUnits` polygon/attribute/projection members from [USGS SIM3168](https://pubs.usgs.gov/sim/3168/), Williams et al. (2011), at 1:15,000,000.

- The VLT/MUSE views use original July 2019 measured maps from King et al. The [source interpretation](source/muse/INTERPRETATION.md) defines units, coordinate evidence, first-valid-night coverage, registration limits and residual night differences.

- **Volcanic heat:** our night-side 4.8 µm map from Juno JIRAM RDR images ([JNO-J-JIRAM-3-RDR-V1.0](https://atmos.nmsu.edu/PDS/data/jnojir_2041/CATALOG/JNO_JIRAM_RDR_DS.CAT), PDS Atmospheres Node) and NAIF Juno kernels. Six visits span April 2022–July 2023, including close passes 51 and 53. Registration uses Io's triaxial ellipsoid and a Lambertian sunlit-disc model following [Mura et al. (2024)](https://doi.org/10.3389/fspas.2024.1369472); their Figure 2 supplies the fixed 0–0.15 W sr⁻¹ m⁻² color scale. A cold-night column background is subtracted before per-visit medians suppress single-frame particle hits; each map cell uses the finest available visit. [The recipe](source/science/jiram/recipe.json) names every product; [the receipt](source/science/jiram/receipt.json) records registration, measured byte identities and native EDR detector masks for the new close passes. This is band radiance, not temperature.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; the 8K latitude-band images from #151, geometry and lighting are retained. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| enhanced | 247.3 → 244.8 kB |
| normal | 118.5 → 118.9 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/c13f3643b53171523dbf59dc92fc7ce49e9c0e24/src/planets/io/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](inventory.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Photographic refresh, 12 September 2026, on base `3efdf2c9`:
[monochrome detail](evidence/photographic-detail/monochrome.png) and
[the Pele hemisphere in false color](evidence/photographic-detail/pele-hemisphere.png)
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
structure. It increased photograph sampling to 4096 × 2048 and 8192 × 4096; only the 8192 × 4096 map ships now.
It also corrects the feature catalogue's map origin from 180° to 0° E: the
photograph decoder already outputs 0–360° E. The previous origin put all 260
named features on the opposite hemisphere. Pele now selects its red deposit
at 18.71° S, 104.72° E, consistent with the [Gazetteer](https://planetarynames.wr.usgs.gov/Feature/4638).

Earlier run at base `53b262bd` (12 September 2026): `node tools/objects/dist/prepare-authored.js io --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/io/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced, geology, spectral-slope, visible-absorption) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 3459).

The earlier map-edge claim was incorrect for Io: it confused the native GeoTIFF edge with the decoded output edge. The current check uses the decoder coordinates and the mounted photographic deposit.

- Six distributed anchors, exact source hashes, hole/seam behavior, and categorical exclusion rules are exercised by the focused geology/source tests.

- Focused checks are defined in the [unit tests](https://github.com/layoutit/css.earth/tree/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/io).

### Close-pass volcanic heat (27 September 2026)

Screened 38 frames from May 16 (orbit 51) and 43 from July 31 (orbit 53).
The existing ellipsoid and registration policy qualified 18 and 13 respectively;
their projected detector scale is roughly 7.6–15.5 km near nadir, finer than the
old visits' 13.5–27 km. The delivered map now has 1440 × 720 cells at 0.25°,
about 8 km at the equator. This is sampling, not a claim of uniform resolution.
Geometry, the runtime and the color scale are unchanged.

The matching raw EDR products were checked against each RDR's identity, exposure,
mode and sample layout. The 136 M-band samples at or above **10,000 DN** are
withheld, following the detector linearity bound in Mura et al., Section 2.1.
All six visits use the column-background correction described below. Cells still need at
least three valid frames from one visit, emission within 75° and two projected
pixel footprints of clearance from the terminator. There is no gap filling.

The final map contains 240,067 valid cells (23.15% of its rectangular grid,
24.12% weighted by spherical cell area), from 65 accepted frames on six visits.
The new visits supply 134,512 cells. Coverage reaches 11.125°S; it remains poor
in the south. Of 41 local peaks above 0.03 W sr⁻¹ m⁻², 35 lie within 3° of a
Davies et al. (2024) catalogue hot spot, versus nine with longitude mirrored.
Six peaks remain 3–6° from that catalogue; the comparison validates orientation
and approximate locations, not every peak or subpixel registration.

The strong curved bands in the initial close-pass map originated in the detector
frames. [Perry et al. (2025), Section 2](https://doi.org/10.3847/PSJ/adbae3) describe
reflections along columns from bright hot spots and remove that background when
measuring hot spots. Here each registered frame subtracts its column's median
from at least 32 finite night-side samples, using the same 75° emission limit
and two-footprint terminator clearance as the map. The 32-sample requirement
(one quarter of the detector height) is our conservative processing choice.
Daylight never sets the baseline; unsupported columns are withheld. A median
assumes hot spots occupy less than half the qualified column, so this method is
not suitable for a column dominated by extended thermal emission.

This correction suppresses the prominent reflection bands while preserving
local hot-spot contrast. Negative residuals remain in the float map and take
the lowest display color; there is no spatial smoothing or gap filling. The
map reports radiance **above the cold background**, whose surface emission is
below JIRAM's detection limit (Mura et al., Section 4.2). It retains 98.63% of
the initial map's valid grid cells; unsupported edge columns account for the
lost coverage. Neither total heat flow nor absolute radiometric accuracy is
qualified by this correction.

See the [measured positions](evidence/jiram-close-passes/final-map-check.json) and
[screened fits](evidence/jiram-close-passes/close-receipt.json).

The 17 orbit-57 and 22 orbit-58 images did not yield three overlapping qualified
night-side frames per cell. Their [December](evidence/jiram-close-passes/orbit57-receipt.json)
and [February](evidence/jiram-close-passes/orbit58-receipt.json) trials are retained;
their sparse partial-disc fits are not promoted by relaxing the registration
policy. The investigated archive has no volumes 59 or 60. The ledger records
these limits and the other indexed visits not reduced in this change.

Reproduce with `node tools/objects/juno/jiram-mosaic.mts src/objects/io/source/science/jiram/recipe.json --frames output/jiram/frames --fetch`.
The larger generated float map is restored from the source cache; Git retains
its recipe, label and measured receipt.

### Four-visit baseline (21 September 2026)

The following results describe the four-visit version at
`943c34c8bac83509725d55ab91b48832fd65a4e8`. Its decoding and registration method
still applies; its integrated-output comparison is not reused as validation of
the new dates or finer map.

- **Frames.** The M-band frames of the four orbits in Mura et al. (2024), Table 1: 59 frames, which match their passes in time and distance. The orbit 43, 47 and 49 frames name no target in their labels; we found them by projecting Io through each frame's SPICE camera.
- **Which half is M.** A 256-line frame holds the L band in its first 128 lines and the M band in its last 128 (the imager's two filters, Mura et al. 2024, Section 2.1). Sunlit Io, divided by the cosine of incidence, reads 0.023 to 0.030 W sr⁻¹ m⁻² in the first half and 0.014 in M-band-only frames of nearby dates, the ratio of sunlight at 3.3–3.6 µm to 4.5–5.0 µm. The kernels' L-band frame also places the first-half disc within 13 lines.
- **Pointing.** The fitted offsets are constant within an orbit: about 5 lines for orbits 41 and 43, and about 530 lines (7°) for orbits 47 and 49, after JIRAM stopped using its despinning mirror from orbit 44 (Mura et al. 2024, Section 2.1). Good fits sit within 4 lines of their orbit's offset; false fits, on nearly empty frames, sit 13 or more away. Frames more than 8 lines from their orbit's offset are rejected.
- **Accepted.** 34 frames, at 13.5 to 27 km per pixel, median correlation 0.92. Rejected: 8 with too little sunlit disc, 7 off their orbit's offset, 7 below a correlation of 0.5, 3 with the best offset on the search edge. [One registered frame per orbit](evidence/volcanic-heat/registration.png) shows the fitted limb (red) and terminator (blue).
- **Against the paper's figure.** [Our four per-orbit maps under Figure 2A](evidence/volcanic-heat/figure-2.png), on its axes and scale: the hot spots fall in the same places at similar brightness.
- **Against the paper's numbers.** Table 3 of Mura et al. (2024) gives each hot spot's total M-band output. Integrating our radiance within 2.5° of each, above the local background, gives a median ratio of 1.06 (middle half 0.72 to 1.32) over 94 measurements in the per-orbit maps, and 0.83 (0.46 to 1.11) for the 46 hot spots fully inside the merged map, where spots can be stitched from different orbits ([test](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/io/volcanic-heat.test.mts), [table extract](source/science/mura-2024/table3-m-band.json)).
- **Against an independent catalogue.** Of 24 local peaks above 0.03 W sr⁻¹ m⁻², 22 lie within 3° of a hot spot in Table A1 of [Davies et al. (2024)](https://doi.org/10.3847/PSJ/ad4346) (Galileo, Keck, Gemini and JIRAM detections); with longitudes mirrored, 4 do. The unmatched peaks are Monan Patera, Volund B and Kotar Patera in Mura et al.'s Table 2, which Davies et al. place 3 to 5° away.

Edge meridian, 13 September 2026: the Normal and Enhanced GeoTIFFs span 360° of longitude, and their recipe now declares `wrapLongitude`. Before, the 2× maps kept one missing column at 180°, filled by the gray coverage grid. A [matched crop](evidence/wrap-longitude/crop.json) of the Normal 2× map, taken from main's published file and from this version, has 33 of 36,864 pixels over the Pixelmatch threshold of 0.1 ([report](evidence/wrap-longitude/change.json)). The largest change is 36 levels at the 180° column; no other column changes by more than 7, which is WebP re-encoding. The [comparison](evidence/wrap-longitude/comparison.png) shows the map pixels and this version in the browser.

## Known problems

The existing atlas seams can remain visible at extreme close zoom. This change
retains the geometry and its packing layout.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Io (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the decoded map’s left edge at 0° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude now shares the Gazetteer origin.

Feature notes: 44 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- **False color:** USGS superimposed color from Galileo violet, green and near-infrared (756 nm) images; this is false color, not a visual true-color measurement. Io changed between the Voyager and Galileo observations; the mosaic is not a single-date snapshot, and spatial/brightness/color boundaries remain visible.

- USGS explicitly states that color lacks coverage within approximately 5° of both poles and that merged polar color was interpolated. We therefore withhold color at |latitude| ≥ 85° before resampling. Independently valid monochrome replaces missing or withheld color. The shared neutral gray grid appears only where neither source provides valid imagery.

- **Geology:** Colors are authored categorical choices, not measured color, chemical abundance or elevation.

- **Geology source audit:** The separate label-point layer differs from final polygon classifications at 43 of 1,498 comparable points.

- The scene is a mean-radius sphere, not a topographic shape model.

- **Volcanic heat covers about 24% of Io's surface.** Only the observed night side is kept. The added May and July close passes improve detail, with coverage extending only to about 11°S. Gray grid marks the remaining gaps; this is not a global heat map.
- **Night side only.** Mura et al.'s maps also keep the day side and remove reflected sunlight afterwards with their photometric model. We do not model sunlight, so the day side is left out.
- **Smear and residual artifacts remain.** Column-background subtraction removes the prominent reflection bands, but cannot recover resolution lost to spacecraft motion. Mura et al. use super-resolution and smear correction; we take medians of registered frames. A hot spot is often smaller than one detector pixel. Peaks must not be read as resolved lava boundaries. The old integrated-output agreement above does not establish absolute calibration for the new visits.
- **Volcanic heat mixes dates.** Each cell comes from the orbit that saw it sharpest, between April 2022 and July 2023. Hot spots vary, so the composite does not describe a single observation date.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

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

Both GeoTIFFs contain 11445 × 5723 samples on a 1000 m grid. Actual monochrome detail varies from approximately 1–10 km per pixel. Color detail varies from 1.3–21 km per pixel; the published false-color product combines Galileo near-infrared, green and violet color ratios with Voyager/Galileo monochrome detail. This is an existing USGS derived observation product, not a new detail transfer in cssEarth.

USGS reports calibration, geometric control, Lunar–Lambert limb-darkening correction with coefficient 0.7, and seam matching in production of these products. We preserve the published display values, with no second photometric correction or brightness fit. Photographed terrain shadows remain possible. Our existing **Shadows** control remains active for both lenses; its globe lighting is approximate and cannot infer relief hidden in a photographed shadow.

## Coordinates and validity

The GeoTIFF georeference, rather than the catalog's positive-west coordinate labels, defines raster sampling. Both products use a simple cylindrical sphere of radius 1821460 m, center longitude 0°, origin (-5723000, 2862000) m and pixel increments (+1000, -1000) m. East increases to the right, north is up. Preparation maps each canonical output pixel centre through the actual metric origin and increments, using native bilinear interpolation. The outer longitude is −180.022479853° and the map spans 360.013503743°; those fractional bounds are preserved rather than rounded to an integer roll or stretched to a full globe. Output longitude remains 0–360° positive-east, without horizontal reflection. [Pele's](https://planetarynames.wr.usgs.gov/Feature/4638) large red deposit at 18.71° S, 104.72° E (255.28° W) is an independent orientation landmark. The 30 m difference from the current astronomical mean radius is not interpreted as terrain.

`GDAL_NODATA=0` marks missing raster data. Monochrome uses exact zero; false color requires the complete RGB tuple to be zero. Low but nonzero observed dark terrain is retained. Every native contributor with nonzero bilinear weight must be valid; incomplete or masked interpolation footprints are withheld. This coordinate correction replaces the earlier whole-image resize and roll, so prepared image bytes change while the original source values remain unchanged.

This is a conservative geographic cut based on the published approximate coverage boundary, not a recovered per-image observation mask. No synthetic terrain or extrapolated pole color is used.

## Prepared delivery

The shared raster lane now samples the original 11,445 × 5,723 photographs into
one 8,192 × 4,096 map before packing, the only density shipped
(asset record (`prepared/assets.json`)). That map has roughly
1.4 km equatorial texel spacing; source areas coarser than that remain coarse.
Pole sprite dimensions, geometry, scientific maps and lighting are unchanged.
Canonical assets are selected once per mount, independently of DPR. Runtime only
decodes and transports prepared assets.

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
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 1821.49 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 1.7627-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera).

</details>
