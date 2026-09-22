# Ganymede

## Sources

- [USGS Voyager/Galileo monochrome mosaic, 1 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_global_mosaic_1km): 16539 × 8270, one unsigned-byte band.

- [USGS Voyager/Galileo color mosaic, 1.4 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km): 11520 × 5760, three unsigned-byte bands.

- The Geology view uses [USGS SIM3237](https://pubs.usgs.gov/sim/3237/), Collins et al. (2013), at 1:15,000,000.

- The VLT/MUSE views use original July 2019 measured maps from King et al. The [source interpretation](source/muse/INTERPRETATION.md) defines units, coordinate evidence, first-valid-night coverage, registration limits and residual night differences.

- The mapped VLT/SPHERE MCMC composition release of [King and Fletcher (2022)](https://doi.org/10.1029/2022JE007323), is pinned as [Zenodo 6390469](https://doi.org/10.5281/zenodo.6390469). Its **Ice fraction** and **Dark material** views are withheld from publication until reuse terms for the numerical data are explicit (see Known problems). The native source and conversion record are [fit_SPHERE.json.gz](https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/blob/1ff2f7069a194f6ce356604072077352b4c78f4a/fit_SPHERE.json.gz) and [model-conversion.json](source/composition/model-conversion.json).

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

The 14 September 2026 composition preparation added **Ice fraction** and **Dark material** as a local preview. They are now withheld from publication until reuse terms are explicit; the evidence below records that preview. [Native-value evidence](evidence/composition/native-values.json) compares all 64,800 geographic nodes in each of four converted grids, including the two retained uncertainty products, with the original release. Values agree exactly after float32 rounding; missing samples and the periodic seam retain their source meaning. [Fresh restoration](evidence/composition/restoration.json) downloads the original archive into an empty source root and reproduces all seven composition manifest entries.

[Ice fraction](evidence/composition/ice-fraction.png) · [Dark material](evidence/composition/dark-material.png) · [Shadows](evidence/composition/dark-material-shadows.png) · [DPR 2](evidence/composition/ice-fraction-dpr2.png). The [browser receipt](evidence/composition/browser.json) pins the tested files above `f8fbdaa0b`, viewport, camera, selected textures and inspected captures. Switching datasets retains the same 450 surface leaves. [Delivery evidence](evidence/composition/delivery.json) verifies the unchanged scene and prior assets; ten added image files total 350,918 bytes.

Focused checks pass: numeric conversion/acquisition (15), body behavior and content (14 across both moons), source/provenance (30), source-usage conservation (1), and strict preparation/tool TypeScript. The new provenance check follows converted grids through their pinned recipes to the native archive. Eight shared startup-fixture/import-closure failures across the two bodies were reproduced on base `a15706943`; these remain outside this surface change. Full application checks and public asset installation are not qualified. The local preview omits six unavailable unrelated nebula context banks; see the browser receipt. The texture bake receipt retains its original source hashes; later content and provenance refreshes do not claim another full bake.

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| enhanced | 282.3 → 294.1 kB |
| normal | 217.6 → 226.2 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/ganymede/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Earlier shared-lane migration (12 September 2026): the terrestrial solid-observation lane was retired for Ganymede; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are now painted at one 8192 × 4096 density for every DPR ([asset record](prepared/assets.json)). That migration's pull request records its package, source-closure, minimap and browser conformance checks; the nomenclature recipe and map edge were unchanged and the labels were re-drawn against the new atlas. The composition addition retains this geometry.

Earlier run, 2026-09-12: `node tools/objects/dist/prepare-authored.js ganymede --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/ganymede/*.test.mts` passed except the shared runtime-package and import-closure tests that failed identically on that main revision (recorded in the migration's pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced, geology, oxygen-signature) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 2161).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

- Six distributed point anchors, exact input hashes, and decoder failure cases are tested.

- Focused checks are defined in the [unit tests](../../../tests/objects/unit/ganymede) and the shared browser conformance harness.

Composition conversion: the two withheld views consume posterior medians for `derived_total_ices` and `derived_total_synthetic`, respectively. The pinned 8,845,543-byte fit (`cd7843ce…9261c8e4`) contributes 38,473 valid and 26,327 missing native nodes to each lens. It is resampled only by reversing latitude, reordering east-positive longitudes and repeating the seam: no smoothing, gap fill, or abundance aggregation. [The conversion record](source/composition/model-conversion.json) pins the output hashes, value ranges and posterior-interval products.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ganymede (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude counts from the map’s left edge, 180° from the Gazetteer origin. The map edge was fixed by cropping the source raster at a landmark’s Gazetteer centre under both hypotheses (see the pull request that added the feature).

Feature notes: 68 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- **Photographic views:** Neither is presented as unlit calibrated albedo or natural eye color.

- **Color coverage:** In the 210–250° west sector, Voyager measurements supplied green/blue while red was synthesized. This package conservatively uses the observed monochrome base throughout that sector (110–150° east), without claiming its synthesized red as measured color. The shared neutral cartographic grid appears only where no valid surface observation remains.

- The rendered shape is a mean-radius sphere, not a resolved terrain mesh.

- **Composition lenses:** The input coordinates are latitude north-positive and longitude east-positive. The paper uses an equirectangular product, but the 1° node grid is a resampling container, not 1° scientific resolution: SPHERE resolves roughly 100–150 km features. Ice fraction and dark material are fitted MCMC model abundances, with 16th/84th-percentile bounds in the release; they are not direct detections of individual chemicals. The prepared lens keeps source no-data visible.

- **Ganymede fit metadata:** `fit_SPHERE.json.gz` names only the 2015 observation. Its valid mask is, apart from five omitted 2015 nodes, exactly the union of the four released 2015/2021 SPHERE reflectance masks. [The footprint comparison](evidence/composition/registration.json) supports combined coverage but does not establish each cell's contributing epoch or weight. The original header is preserved.

- **Reuse:** Zenodo exposes the release as open/`other-open`, while the tag has no explicit data licence and the paper's availability statement does not grant rights to the numerical files. The two composition views are therefore withheld: they have no lens, surface recipe or dataset text, and no composition asset is published. The pinned source, conversion record and evidence stay so the views can return once explicit reuse terms exist.

- **Geology:** The separate point labels disagree with final polygon categories at 124 of 3,042 comparable locations; 870 ejecta labels are outside that comparison. The audit retains those disagreements.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

Ganymede is Jupiter's largest moon. This standalone package uses the common object runtime, camera, controls and retained surface. It does not mount other moons or a second scene.

## Sources and coordinates

The pinned inputs are recorded in `source/manifest.json`. Runtime installation requires prepared assets, not these source TIFFs. Source byte counts and SHA-256 identities are recorded in the manifest.

- The source observations have varying resolution, approximately 400 m–20 km/pixel. Coarse observed imagery is not replaced with invented high-resolution detail.

- False color from near-infrared, green and violet is merged with sharper monochrome structure; the map grid is finer than some original color observations.

- Pinned ISIS and PDS labels describe both map products. Both GeoTIFFs are simple cylindrical/equirectangular, planetocentric, centered at 180° with north at the top. Positive map x runs eastward. The monochrome ISIS label expresses longitude west-positive (decreasing along x); the color label is east-positive. No horizontal mirror is applied. Output longitude runs 0–360° east. The map sphere is 2632.345 km in radius.

Preparation maps canonical output pixel centres through each GeoTIFF's actual metric origin and increments using native bilinear interpolation. The monochrome outer longitude is −0.017414018° and its width spans 360.013060514°; the enhanced map also retains its own source bounds. Neither grid is stretched to an assumed 360° extent or rounded to an integer column shift.

## Appearance and coverage

**Monochrome** preserves the USGS observation mosaic. **False color** shows its independent near-infrared/green/violet interpretation.

[USGS map I-2762](https://pubs.usgs.gov/imap/i2762/) and the [USGS globe description](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_image_mosaic_globe) describe radiometric calibration, empirical Lunar–Lambert photometric normalization, and linear brightness corrections fitted to overlapping images. We retain this published processing; there is no additional guessed global photometric model. Photographed terrain shadows and varying source resolution can remain. The shared Shadows control adds approximate spherical lighting in both lenses.

The USGS color product maps SSI 991 nm to red, 559 nm to green and 413 nm to blue. Published monochrome polar coverage remains monochrome. No terrain is painted or extrapolated.

Both GeoTIFFs declare GDAL_NODATA=0. The monochrome zero value, or a missing color band, supplies the validity mask. Very dark nonzero terrain remains valid. Every native contributor with nonzero bilinear weight must be valid; incomplete or masked interpolation footprints are withheld. This replaces the earlier whole-image resize and roll, so prepared image bytes change while source values remain unchanged. Missing/withheld color uses co-located observed monochrome.

## Preparation and geometry

Prepared maps are 8192 × 4096 (about 2.02 km per equatorial texel), downsampled from the source. The canonical projective atlases are fixed across DPR. Poles use separate 1024-pixel disks sampled from the same map; each latitude band uses the shared inverse mapping for the retained spherical mesh. Proportional atlas gutters preserve the shared texture registration at this density.

Its 2631.2 km mean radius, pole/spin model, synchronous orbit and epoch come from the pinned astronomy package (JPL satellite elements and IAU/WGCCRE rotation). The small cartographic reference-radius difference remains a source-map fact, not a change to Ganymede's physical radius.

[NASA Ganymede facts](https://science.nasa.gov/jupiter/jupiter-moons/ganymede/facts/) support the introduction, ocean interpretation, thin oxygen atmosphere and approximately 1.07 million km orbit. The tenuous atmosphere is factual content; it does not justify a visible atmospheric halo. No rings, terrain-height lens, magnetosphere illustration or speculative layer is included.

## Preparation ownership

This package contains authored JSON recipes, source provenance, and generated JSON. Reusable observation masking, projection, lighting, celestial, and retained-scene operations live in `tools/objects/terrestrial-layers/`; no package-local executable preparer or runtime is required.

Delivery keeps the prepared HD texture dimensions. The photographic normal and enhanced polar sprites sample their pinned source grids directly with a 2 × 2 footprint and retain lossless WebP encoding. Latitude-band and non-photographic prepared assets retain their existing encodings; source maps remain lossless. Lighting stays lossless.

## Interpreted geology

The original `GeologyUnits` SHP/DBF/PRJ files retain 3,046 records and 23 `Unit` symbols. The archive combines palimpsest age subdivisions under `p`; no finer age interpretation is invented. Colors are authored categorical display choices, not measured brightness, composition or relief. Structure lines and ejecta point symbols are outside this base-unit view.

`source/science/geology-sim3237/` retains raw members, readme/metadata, archive member integrity receipts, and independent label-point anchors. Coordinates are signed east-positive planetocentric degrees in `GCS_Ganymede_2000`, on the 2,632,345 m source sphere and RAND November 1999 control. Mapping those angles onto the existing 2,631,200 m displayed sphere adds no 1,145 m elevation offset. Only unambiguous polygons are colored; uncovered polar areas remain missing.

Record 3,023 contains one degenerate one-point ring and 90 valid rings. The decoder explicitly excludes that pinned zero-area ring while preserving the valid multipart region, and rejects any undeclared degeneracy. Prepared visual qualification belongs to the B2 record.

## Visible spectral surface views

Every conversion is offline; the scene geometry remains unchanged.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 2631.2 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 7.1556-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera).

</details>
