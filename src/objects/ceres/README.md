# Ceres

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

| Input | Source and use |
| --- | --- |
| Monochrome | [USGS Dawn FC global mosaic, 140 m/pixel](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_140m), sampled through WMS at 4096 × 2048 over 0–360° east, 90°N–90°S. Visible-light grayscale, not an unlit albedo map. |
| Enhanced color | [NASA PIA19977](https://science.nasa.gov/resource/hints-at-ceres-composition-from-color/), 3078 × 1537. False color from 920, 750, and 440 nm filters. South-polar gaps use a neutral gray cartographic grid. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/CERES/target) Ceres centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

- The [DLR/USGS Dawn HAMO DTM](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc2_hamo_global_dtm_137m) contains 21,600 × 10,800 signed 16-bit samples at 60 pixels/degree.

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| enhanced | 684.8 → 671.3 kB |
| normal | 365.2 → 357.9 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/ceres/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Ceres; the same pinned inputs and the same decoders (`terrestrial-observation`, `terrestrial-scientific` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — retired 4096 × 2048 atlas. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js ceres --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/ceres/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal, enhanced, elevation) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 15341).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

- [source/manifest.json](source/manifest.json) pins acquisition URLs, byte counts, checksums, credits, and consumers.

- Focused checks are defined in the [unit tests](../../../tests/objects/unit/ceres) and [browser profile](../../../tests/objects/browser/ceres/browser-profile.mts).

## Registration and coverage

The Dawn FC2 global mosaic is an orthorectified, body-fixed product. The
[PDS dataset record](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=DAWN-A-FC2-5-CERESMOSAIC-V1.0)
records that its bundle-block adjustment uses the Dawn orbit and
attitude, the high-resolution Ceres shape model for ray intersections, and the
same Kait-anchored longitude system used by the Dawn shape/topography work.
The selected 140 m mosaic therefore has a documented image-to-Ceres frame; it
does not depend on a visual crater match performed by cssEarth. The DTM is a
separate derived product and is described as elevation, not as photographic
texture. The false-color PIA19977 image is retained as a distinct map
interpretation rather than being presented as calibrated monochrome.

This closes the registration finding for the normal Dawn FC2 mosaic. PIA19977
retains its published equirectangular map frame, but this review does not assert
a pixel-for-pixel pairing with the DTM; it remains a separate false-color
interpretation.
It does not imply complete coverage: the PDS release states that the extreme
south pole was not illuminated and that the mosaics contain gaps. The existing
gray-grid treatment remains the explicit missing-coverage signal. Published
shadows and mosaic seams remain visible.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ceres (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 0° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude counts from the map’s left edge, which here coincides with the Gazetteer origin. The map edge was fixed by cropping the source raster at a landmark’s Gazetteer centre under both hypotheses (see the pull request that added the feature).

Feature notes: 31 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Coverage decision: both pinned rasters have three color channels and no alpha or accompanying validity mask. Southern-edge-connected exact black is used as a conservative indication of fill in each of these map images. This is a heuristic, not a surveyed coverage boundary.

- **Elevation:** The publisher describes approximately 98% surface coverage and interpolation in permanently shadowed polar areas, but supplies no validity mask separating interpolation from stereo samples. To avoid showing that fill as observed terrain, the lens withholds both caps at |latitude| ≥60°. This is our conservative display boundary, not the source's observation boundary.

- **Lighting:** The optional Shadows setting adds approximate directional illumination of the spherical model. With Shadows off, a fixed curvature overlay gives the globe depth. Neither mode reconstructs unlit albedo or physically relights the photographed crater shadows.
- The last two columns of the PIA19977 enhanced-color source map are brighter than their neighbours (mean brightness 173 and 193 against about 135). A thin light line can show along 0° at close zoom.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="ceres-sources"></a>

Originals are acquired from their publishers, not other objects.

| Input | Source and use |
| --- | --- |
| Title | Pinned Inter variable font; shared title outline preparation. |
| Physical/orbit data | Vendored `@cssearth/astronomy` JPL body data, Kepler state vectors and IAU rotation. Mean radius 469.7 km; fixed geometry epoch 2026-09-03T00:00:00 TT. |
| Facts | [NASA Ceres facts](https://science.nasa.gov/dwarf-planets/ceres/facts/), summarized in `tools/prepare-content.mjs`: asteroid-belt location, Dawn observations, about nine hours per rotation, no moons. |

The maps share a global equirectangular grid. As with Pluto, exactly black pixels connected to the southern source border are identified before interpolation. The shared preparation helper marks those gaps with a neutral gray grid; it does not infer terrain. Enclosed black terrain and nonzero JPEG edge pixels remain untouched, so a dark edge fringe can remain.

In particular, JPEG compression can make fill pixels nonzero. We preserve those uncertain pixels instead of raising a brightness threshold that could erase observed dark terrain. The shared grid defines the presentation, not scientific validity for every dataset.

Preparation creates 452 retained surface leaves, polar textures and a lighting atlas. The mesh uses a spherical mean radius; no resolved Ceres shape or elevation model is claimed. The runtime only loads prepared assets and publishes shared view state.

Surface bands are reprojected for their projective trapezoids before packing; linear image latitude cannot be stretched directly over projective UVs. Polar textures use the cap geometry and hemisphere-specific longitude direction. Both use bilinear source sampling and lossless encoding. Original source files remain unchanged. Prepared maps mark only the identified gaps; the runtime lighting is a separate prepared overlay. The shared perspective camera converts PolyCSS geometry to world units without an extra zoom multiplier. Lighting fits that same projected radius, and its prepared disc stays within the atlas frame. The low-polygon surface still has small geometric facets; the overlay does not represent an atmosphere.

Lighting decision: retain the published Dawn observations, including their original crater shadows. This limitation is explained in both lens descriptions.

## Elevation lens

Values are meters above a 470 km sphere, including the body's overall shape; they are not heights above a fitted ellipsoid. The GeoTIFF is centered on 180°E and its left edge is 0°E. No-data is −32768. Preparation samples the published model without filling missing values and maps heights to a fixed −30 to +20 km color scale.

The shared gray grid marks withheld or missing samples; no terrain is invented.

Preparation also derives terrain shading from neighboring model heights at the delivered 4096 × 2048 grid spacing. Central differences account for Ceres's 470 km radius and longitude spacing at each latitude. Fixed northwest light at 45° altitude and 25% ambient light reveal slopes without height exaggeration. Level terrain retains its base color; shading changes brightness, so the legend shows the unshaded height scale. Samples beside missing or withheld neighbors keep their base color; neither heights nor coverage are interpolated to shade gaps.

The map and its numeric legend are prepared together. The surface uses the existing Ceres band/pole projection. Generic prepared material selection keeps the same globe curvature shading on every lens. Shadows switches it to approximate directional illumination; it does not change the fixed terrain light direction. No runtime controller or runtime scientific-data parser is added.

Delivery keeps the prepared HD texture dimensions. The photographic normal and enhanced polar sprites sample their pinned source grids directly with a 2 × 2 footprint and retain lossless WebP encoding. Latitude-band and non-photographic prepared assets retain their existing encodings; source maps remain lossless. Lighting stays lossless.

Preparing elevation requires the original 466.6 MB DTM. The runtime asset installer downloads prepared maps only and does not require that source file. Raw binaries and prepared images are excluded from Git; runtime assets use the existing publisher.

See [NOTICE.md](NOTICE.md) for credits.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 469.7 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 0.3781-day prograde rotation (JPL/NASA 9.074 h rotation (factsheet-review)) and a 4.04° tilt to its orbit. The tilt is computed here, not transcribed: the angle between the Dawn pole the astronomy package uses (RA 291.418°, Dec 66.764°, NAIF `dawn_ceres_v05.tpc`) and the normal of the pinned JPL Horizons ICRF orbit at JD 2461041.5 (i = 0.4745853864 rad, node = 0.4074666524 rad). Both serve the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 40.00° initial pitch, 0.00° yaw, taken from the retired lane's camera). 

</details>
