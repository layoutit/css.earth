# Ganymede

The navigation marker uses its existing source map as a stylized identifier. The [marker recipe](source/preparation/navigation.json) crops and resizes it, then prepares a circular alpha edge and the shared full-phase curvature shading (35% ambient, 65% diffuse). It is not an observer projection or a view at the scene epoch.

## Sources

- [USGS Voyager/Galileo monochrome mosaic, 1 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_global_mosaic_1km): 16539 × 8270, one unsigned-byte band.

- [USGS Voyager/Galileo color mosaic, 1.4 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km): 11520 × 5760, three unsigned-byte bands.

- **DLR mosaic**: [DLR_Ganymede_Voyager-Galileo-Juno_V1.0](https://doi.org/10.57780/esa-fcj5pf3), the DLR JANUS team's 2022 global mosaic in the ESA Planetary Science Archive ([data set page](https://www.cosmos.esa.int/web/psa/dlr_ganymede_voyager-galileo-juno_v1.0) · [product guide](https://archives.esac.esa.int/psa/ftp/Guest-Storage-Facility/DLR_Ganymede_Voyager-Galileo-Juno_V1.0/PUG-DLR-Ganymede-v2.pdf)): 46080 × 23040, one unsigned-byte band, 128 pixels per degree (358.77 m) on a 2,631.2 km sphere. It re-projects 118 Voyager and 88 Galileo images on the [Zubarev et al. (2016)](https://doi.org/10.1134/S0038094616050087) control network ([Kersten et al. 2021](https://doi.org/10.1016/j.pss.2021.105310)) and lays JunoCam images from the 7 June 2021 flyby on top ([Kersten et al. 2022](https://doi.org/10.5194/epsc2022-450)). NASA Trek serves a re-encoded copy as “Voyager Multi Instruments, Galileo SSI, and Juno JunoCam Mosaic 359m, Global”. Licence CC BY-NC 3.0 IGO under the [ESA Space Science Archive terms](https://www.cosmos.esa.int/web/esdc/terms-and-conditions); credit ESA/DLR and cite “European Space Agency, 2022, DLR_Ganymede_Voyager-Galileo_Juno_V1.0, 10.57780/esa-fcj5pf3”. See [DLR mosaic](#dlr-mosaic).

- The Geology view uses the global geologic map of Collins et al. (2013), [USGS SIM 3237](https://doi.org/10.3133/sim3237), at 1:15,000,000, in the authors’ own GIS colors. See [Geologic map](#geologic-map).

- The VLT/MUSE views use original July 2019 measured maps from King et al. The [source interpretation](source/muse/INTERPRETATION.md) defines units, coordinate evidence, first-valid-night coverage, registration limits and residual night differences.

- The mapped VLT/SPHERE MCMC composition release of [King and Fletcher (2022)](https://doi.org/10.1029/2022JE007323), is pinned as [Zenodo 6390469](https://doi.org/10.5281/zenodo.6390469). Its **Ice fraction** and **Dark material** views are withheld from publication until reuse terms for the numerical data are explicit (see Known problems). The native source and conversion record are [fit_SPHERE.json.gz](https://github.com/ortk95/king-2022-global-modelling-ganymede-surface-composition/blob/1ff2f7069a194f6ce356604072077352b4c78f4a/fit_SPHERE.json.gz) and [model-conversion.json](source/composition/model-conversion.json).

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json). NASA Photojournal figures PIA01232 and PIA00500 were checked on 2026-09-28 as possible map views. None qualified: each lacks a labelled map grid, a colour scale with units, or both. The ledger gives the reason for each.

## Geologic map

**Geology** shows the interpreted units of the global geologic map of Ganymede by
Collins et al. (2013), [USGS SIM 3237](https://doi.org/10.3133/sim3237), mapped on
the USGS Voyager/Galileo 1 km mosaic. The unit polygons are the `GeologyUnits`
shapefile from the SIM 3237 GIS download
([database ZIP](https://pubs.usgs.gov/sim/3237/downloads/Ganymede_SIM3237_Database.zip)),
kept in `source/science/geology-sim3237/`: 3,046 polygons in signed east-positive
planetocentric degrees on the 2,632.345 km `GCS_Ganymede_2000` sphere.

**Units and colors.** Each polygon is colored by its `UNITNAME` attribute, the field
the authors' own ArcMap project (`Ganymede_Geology_SIM3237_ArcMap10.mxd` in the same
ZIP) symbolizes. That project holds four copies of the unit layer, all with the same
25 values and colors. ArcMap stores colors as CIE L\*a\*b\*; converted with the
ArcGIS rule (Apple RGB primaries, gamma 1.8, D65 white) every one lands within
6 × 10⁻⁷ of a whole RGB value, and the 20 units that NASA Trek also serves match
Trek's published RGB exactly. Unit names and symbols are the Description of Map
Units on the [map sheet](https://pubs.usgs.gov/sim/3237/pdf/sim3237_mapsheet.pdf);
`UNITNAME` keeps the three palimpsest classes (p1, p2, pu) that the `Unit` symbol
field merges into `p`. The values, symbols, stored L\*a\*b\* and RGB are in
[display-categories.json](source/science/geology-sim3237/display-categories.json).
Colors mark map units, not surface color, brightness or composition.

The bake's shared shapefile sampler (`geologic-shapefile`, conflicts withheld) paints
the polygons at each output pixel centre. Unlike the Enceladus map, these polygons
tile the sphere without nesting, so no overlap rule is needed and no intermediate
grid is kept.

| Unit | Color | Polygons | Mapped km² | Shown km² |
| --- | --- | ---: | ---: | ---: |
| Young light grooved material (`lg3`) | `#bed2ff` | 272 | 5,048,863 | 5,049,000 |
| Intermediate light grooved material (`lg2`) | `#73b2ff` | 244 | 4,950,450 | 4,950,035 |
| Old light grooved material (`lg1`) | `#005ce6` | 111 | 2,096,119 | 2,096,315 |
| Young light subdued material (`ls3`) | `#beffe8` | 116 | 3,549,928 | 3,549,935 |
| Intermediate light subdued material (`ls2`) | `#73ffdf` | 174 | 4,365,787 | 4,365,129 |
| Old light subdued material (`ls1`) | `#00e6a9` | 284 | 6,745,581 | 6,745,201 |
| Young light irregular material (`li3`) | `#c29ed7` | 7 | 111,479 | 111,533 |
| Intermediate light irregular material (`li2`) | `#ca7af5` | 60 | 1,001,769 | 1,001,472 |
| Old light irregular material (`li1`) | `#aa66cd` | 100 | 1,986,828 | 1,986,407 |
| Light undivided material (`l`) | `#0084a8` | 132 | 21,979,484 | 21,972,525 |
| Reticulate material (`r`) | `#ed5192` | 30 | 394,166 | 394,155 |
| Dark lineated material (`dl`) | `#cd8966` | 118 | 2,112,722 | 2,112,696 |
| Dark cratered material (`dc`) | `#894444` | 145 | 19,738,208 | 19,738,105 |
| Dark undivided material (`d`) | `#d7b09e` | 297 | 5,858,623 | 5,865,549 |
| Fresh crater material (`c3`) | `#ffffd4` | 94 | 737,703 | 737,493 |
| Partially degraded crater material (`c2`) | `#ffebaf` | 201 | 1,785,780 | 1,785,845 |
| Degraded crater material (`c1`) | `#dc7e15` | 491 | 1,668,945 | 1,669,319 |
| Undivided crater material (`cu`) | `#988523` | 83 | 290,808 | 290,761 |
| Smooth basin material (`bs`) | `#ff7f7f` | 1 | 304,287 | 304,296 |
| Rugged basin material (`br`) | `#ff4500` | 1 | 471,369 | 471,294 |
| Basin interior plains material (`bi`) | `#fff5f5` | 1 | 14,513 | 14,521 |
| Young palimpsest material (`p2`) | `#89cd66` | 6 | 220,470 | 220,540 |
| Ancient palimpsest material (`p1`) | `#898944` | 34 | 672,225 | 672,133 |
| Undivided palimpsest material (`pu`) | `#5c8944` | 27 | 587,772 | 587,878 |
| Palimpsest interior plains material (`pi`) | `#ffffff` | 17 | 32,261 | 32,266 |

Mapped km² is each unit's polygon area on the source sphere (87,075,400 km²);
shown km² counts the sampled cells at the 8192 × 4096 prepared density. The
polygons cover 99.60% of the sphere. Gray covers 0.40%: 0.21% beyond 80° N and
0.18% beyond 80° S, where the map has no polygons. Cells where polygons of two
units overlap cover 0.001% and are withheld. Details:
[units.json](evidence/geology/units.json).

**Registration.** Gazetteer centres of features the map text names fall in the
expected unit in 13 of 15 cases when longitudes are read east-positive, and 3 of
15 when read west-positive ([features.json](evidence/geology/features.json)):
Galileo, Nicholson, Barnard, Marius and Perrine Regiones in dark cratered material,
Uruk Sulcus in light material, Osiris and Tros in fresh crater material, Gilgamesh
in basin interior plains, and Epigeus, Zakar, Teshub and Hathor in young palimpsest
material or its interior plains, as the pamphlet lists them. The two misses are
large features whose centre point lands on a neighbour: Harpagia Sulcus centres on
lg2 while ls2, which the pamphlet names there, is the largest unit within 350 km;
Xibalba Sulcus centres on a c2 crater inside light material. Over the monochrome
mosaic, dark units average 54–63 DN, light units 74–85 DN and fresh craters and
Gilgamesh 95–110 DN ([flat map](evidence/geology/units-flat.png) ·
[over the mosaic](evidence/geology/units-over-mosaic.webp), both 0–360° E, north up).
This checks the frame and gross registration; it is not a measured offset.

## DLR mosaic

**What Juno adds.** Comparing the producer's two 2 km previews (with and without Juno) locates the Juno images: 13.0% of the globe, about 310° to 60° east and 14° S to 70° N, around Tros crater. The product guide calls this the leading side; the measured footprint is centred at 357° E, 25° N. There the Juno photographs show craters and grooves that the USGS mosaic and DLR's own Voyager–Galileo version blur ([footprint](evidence/dlr-juno/footprint-usgs-dlr-dlr-without-juno.webp) · [close-up](evidence/dlr-juno/detail-usgs-dlr-dlr-without-juno.webp), each USGS | DLR with Juno | DLR without Juno, one pixel per prepared texel, about 2 km). Fine detail (high-pass RMS over local contrast) inside the footprint is 0.55 against 0.50 for the USGS mosaic, and 0.60 against 0.45 between DLR's previews with and without Juno. Outside the footprint the DLR mosaic is no sharper than the USGS one (0.52 against 0.54).

**Coverage.** On the prepared 8192 × 4096 grid the DLR mosaic has imagery on 99.88% of the sphere and the USGS mosaic on 99.57%. The DLR map adds 0.39%, mostly the caps above about 87°; it lacks 0.08% that the USGS map has, near the south pole. Juno itself fills 0.013% of the sphere that the USGS map leaves empty ([coverage map](evidence/dlr-juno/coverage.webp): green added, red lost, blue the Juno images).

**Why a separate view.** The DLR map is a different control network. Tile-by-tile correlation against the USGS mosaic finds shifts of a median 7 texels (14 km), 90th percentile 15 texels (30 km), up to 28 texels (57 km); near Anat, the crater that defines Ganymede's longitude, the east–west shift is within one texel and the north–south shift about three. The False color view fills missing color with Monochrome pixels, and the Geology polygons and the labels follow the USGS frame, so replacing Monochrome would put its fallback and those overlays tens of kilometres off. Pixelmatch (threshold 0.1) flags 40.6% of texels between the two maps, 12.4 million of them outside the Juno footprint: the whole base changes, not only the Juno area.

**Preparation.** The recipe reads the GeoTIFF with the byte-monochrome GeoTIFF route (`geotiff-byte-monochrome`), which checks the grid, origin, sphere and no-data value and keeps the 8-bit values (display range 0–255). Run on this file on 28 September 2026, the bake's decoder produced a map identical to the scratch bilinear check (0 mask or value differences, 1.38 GB peak memory). The resampled texture goes through the lossy lane like the other photographs. Measurements, inputs and hashes: [measure.json](evidence/dlr-juno/measure.json).

## Evidence

The 14 September 2026 composition preparation added **Ice fraction** and **Dark material** as a local preview. They are now withheld from publication until reuse terms are explicit; the evidence below records that preview. [Native-value evidence](evidence/composition/native-values.json) compares all 64,800 geographic nodes in each of four converted grids, including the two retained uncertainty products, with the original release. Values agree exactly after float32 rounding; missing samples and the periodic seam retain their source meaning. [Fresh restoration](evidence/composition/restoration.json) downloads the original archive into an empty source root and reproduces all seven composition manifest entries.

[Ice fraction](evidence/composition/ice-fraction.png) · [Dark material](evidence/composition/dark-material.png) · [Shadows](evidence/composition/dark-material-shadows.png) · [DPR 2](evidence/composition/ice-fraction-dpr2.png). The [browser receipt](evidence/composition/browser.json) pins the tested files above, viewport, camera, selected textures and inspected captures. Switching datasets retains the same 450 surface leaves. [Delivery evidence](evidence/composition/delivery.json) verifies the unchanged scene and prior assets; ten added image files total 350,918 bytes.

Focused checks pass: numeric conversion/acquisition (15), body behavior and content (14 across both moons), source/provenance (30), source-usage conservation (1), and strict preparation/tool TypeScript. The new provenance check follows converted grids through their pinned recipes to the native archive. Eight shared startup-fixture/import-closure failures across the two bodies were reproduced; these remain outside this surface change. Full application checks and public asset installation are not qualified. The local preview omits six unavailable unrelated nebula context banks; see the browser receipt. The texture bake receipt retains its original source hashes; later content and provenance refreshes do not claim another full bake.

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| enhanced | 282.3 → 294.1 kB |
| normal | 217.6 → 226.2 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches the previous main version; [the raster recipe](source/preparation/raster.json) and [asset inventory](inventory.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Earlier shared-lane migration (12 September 2026): the terrestrial solid-observation lane was retired for Ganymede; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are now painted at one 8192 × 4096 density for every DPR (asset record (`prepared/assets.json`)). That migration's pull request records its package, source-closure, minimap and browser conformance checks; the nomenclature recipe and map edge were unchanged and the labels were re-drawn against the new atlas. The composition addition retains this geometry.

Earlier run, 2026-09-12: [`node tools/objects/dist/prepare-authored.js ganymede --write`](https://github.com/layoutit/css.earth/blob/0f0384e90c/tools/objects/prepare-authored.ts) (now [`site/build/prepare/prepare-authored.ts`](../../../site/build/prepare/prepare-authored.ts)) prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/ganymede/*.test.mts` passed except the shared runtime-package and import-closure tests that failed identically on that main revision (recorded in the migration's pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced, geology, oxygen-signature) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 2161).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

Map edge correction (2026-09-28): the raster lane's photograph decoder writes this map from 0° E, but `source/presentation/surface-map.json` declared 180° E, so the globe, its labels and the status-bar longitude were drawn half a turn from the imagery. The earlier edge check cropped the source raster, which does not show where the prepared map starts. Read through its georeferenced source, the prepared normal map correlates 0.90 from 0° E and −0.07 from 180° E. The surface map now declares 0° E and the body was rebaked; the preparation now refuses a declared edge the source contradicts ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)).

- Six distributed point anchors, exact input hashes, and decoder failure cases are tested.

- Focused checks run from the shared runners in [tests/objects/unit](../../../site/test/runtime-package.test.mts) (runtime package and feature catalogue, scoped with `CSSEARTH_TEST_OBJECTS=ganymede`) and the shared browser conformance harness.

Composition conversion: the two withheld views consume posterior medians for `derived_total_ices` and `derived_total_synthetic`, respectively. The pinned 8,845,543-byte fit (`cd7843ce…9261c8e4`) contributes 38,473 valid and 26,327 missing native nodes to each lens. It is resampled only by reversing latitude, reordering east-positive longitudes and repeating the seam: no smoothing, gap fill, or abundance aggregation. [The conversion record](source/composition/model-conversion.json) pins the output hashes, value ranges and posterior-interval products.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ganymede (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 0° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude counts from the map’s left edge, 180° from the Gazetteer origin. The map edge is measured against the georeferenced source at every preparation (see the map edge correction above).

Feature notes: 68 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- **DLR mosaic:** its features sit a median 14 km (up to about 57 km) from the labels and the other views, because its control network differs. DLR cut or interpolated artefacts and matched brightness and contrast by hand, including on the Juno images; its guide also reports an unexplained shift along the 180° meridian. Brightness is not comparable with the USGS mosaic. The prepared texture keeps these producer edits. The CC BY-NC 3.0 IGO licence excludes commercial use without an ESA licence.

- **Photographic views:** Neither is presented as unlit calibrated albedo or natural eye color.

- **Color coverage:** In the 210–250° west sector, Voyager measurements supplied green/blue while red was synthesized. This package conservatively uses the observed monochrome base throughout that sector (110–150° east), without claiming its synthesized red as measured color. The shared neutral cartographic grid appears only where no valid surface observation remains.

- The rendered shape is a mean-radius sphere, not a resolved terrain mesh.

- **Composition lenses:** The input coordinates are latitude north-positive and longitude east-positive. The paper uses an equirectangular product, but the 1° node grid is a resampling container, not 1° scientific resolution: SPHERE resolves roughly 100–150 km features. Ice fraction and dark material are fitted MCMC model abundances, with 16th/84th-percentile bounds in the release; they are not direct detections of individual chemicals. The prepared lens keeps source no-data visible.

- **Ganymede fit metadata:** `fit_SPHERE.json.gz` names only the 2015 observation. Its valid mask is, apart from five omitted 2015 nodes, exactly the union of the four released 2015/2021 SPHERE reflectance masks. [The footprint comparison](evidence/composition/registration.json) supports combined coverage but does not establish each cell's contributing epoch or weight. The original header is preserved.

- **Reuse:** Zenodo exposes the release as open/`other-open`, while the tag has no explicit data licence and the paper's availability statement does not grant rights to the numerical files. The two composition views are therefore withheld: they have no lens, surface recipe or dataset text, and no composition asset is published. The pinned source, conversion record and evidence stay so the views can return once explicit reuse terms exist.

- **Geology attributes:** four polygons carry a `UNITNAME` that differs from their `TERRAIN` and `Unit` fields and from the separate label points: record 1946 (545,327 km², south-west of Barnard Regio) is young light grooved material by `UNITNAME` but dark cratered by the other three; records 1843 (306,748 km², light subdued 3 against light undivided), 1786 (22,953 km²) and 2101 (5,803 km²) are the others. A fifth, record 2924 (31,394 km²), has `Unit` `l` against light grooved material in both name fields. The lens follows `UNITNAME`, the field the authors' map project colors; the mosaic inside record 1946 averages 72.8 DN, between the dark (62.5) and young light grooved (78.8) means, so it does not settle the question. [units.json](evidence/geology/units.json) lists them.
- **Geology label points:** the separate point labels disagree with the colored polygon unit at 129 of 3,042 comparable locations, the 124 found against `Unit` plus the five points inside the records above; 870 ejecta labels have no polygon unit. The audit keeps them.
- **Geology symbology files:** `layerSymbology/GanymedeUnits.lyr` in the same ZIP is an older lookup (one palimpsest value, a crater-ejecta value) that does not match the shipped attributes; its shared colors equal the project's. NASA Trek's layer uses different colors for p1, p2, pu, pi and reticulate material. Neither is used.
- **Geology structures:** contacts, grooves, furrows, crater rims and other line and point symbols are not shown. Geology has not been baked or checked in a browser since the color change.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

Ganymede is Jupiter's largest moon. This standalone package uses the common object runtime, camera, controls and retained surface. It does not mount other moons or a second scene.

## Sources and coordinates

The pinned inputs are recorded in `source/manifest.json`. Runtime installation requires prepared assets, not these source TIFFs. Source byte counts are recorded in the manifest.

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

This package contains authored JSON recipes, source provenance, and generated JSON. Reusable observation masking, projection, lighting, celestial, and retained-scene operations live in `packages/bake/src/objects/layers/terrestrial/`; no package-local executable preparer or runtime is required.

Delivery keeps the prepared HD texture dimensions. The photographic normal and enhanced polar sprites sample their pinned source grids directly with a 2 × 2 footprint and retain lossless WebP encoding. Latitude-band and non-photographic prepared assets retain their existing encodings; source maps remain lossless. Lighting stays lossless.

## Interpreted geology

The original `GeologyUnits` SHP/DBF/PRJ files retain 3,046 records and 25 `UNITNAME` values. Structure lines and ejecta point symbols are outside this base-unit view.

`source/science/geology-sim3237/` retains raw members, readme/metadata, archive member integrity receipts, the unit symbology record and independent label-point anchors. Coordinates are signed east-positive planetocentric degrees in `GCS_Ganymede_2000`, on the 2,632,345 m source sphere and RAND November 1999 control. Mapping those angles onto the existing 2,631,200 m displayed sphere adds no 1,145 m elevation offset. Only unambiguous polygons are colored; uncovered polar areas remain missing.

Record 3,023 contains one degenerate one-point ring and 90 valid rings. The decoder explicitly excludes that pinned zero-area ring while preserving the valid multipart region, and rejects any undeclared degeneracy.

The colors were read from the `.mxd` member by HTTP byte range (the 743,424-byte file is not vendored). Each unique-value symbol is an ESRI `RgbColor` record holding three little-endian doubles (L\*, a\*, b\*); the fill that precedes each label is the unit color and the shared 110-gray outline is skipped. The extractor is proposed as a shared tool; until it lands, the record in `display-categories.json` is the checked-in result.

## Visible spectral surface views

Every conversion is offline; the scene geometry remains unchanged.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 2631.2 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 7.1556-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera).

</details>
