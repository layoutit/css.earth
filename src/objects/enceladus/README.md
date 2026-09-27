# Enceladus

The [navigation marker](source/preparation/navigation.json) retains its existing source-map crop and silhouette, with the shared prepared full-phase curvature shading (35% ambient, 65% diffuse). It is a stylized identifier, not an observer projection or illumination at the scene epoch.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

- The following two products are Schenk and McKinnon (2024), published in the USGS/PDS archive on 2024-08-12.

- Monochrome: [controlled Cassini mosaic](https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-mosaic-100m-schenk).

- Elevation: [terrain model](https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-dem-200m-schenk).

- The selected DSK is `cas_enceladus_ssd_spc_0256icq_v2.bds`, delivered in the Cassini SPICE archive in June 2026.

- Infrared color: [NASA PIA24027](https://science.nasa.gov/photojournal/enceladus-in-the-infrared-map-view/), the published Robidel (2020) infrared / Bland (2018) visible-camera composite.

- Ice absorption and Infrared ratio use six calibrated VIMS observations with matched navigation backplanes. The [source interpretation](source/vims-chemistry/INTERPRETATION.md) defines every channel, coordinate, mask, overlap rule and scientific limit.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Published global infrared mosaic

**Infrared color** uses NASA's original 8192 × 4096 RGB TIFF, released on
2020-09-29. [Robidel et al. (2020)](https://doi.org/10.1016/j.icarus.2020.113848)
corrected VIMS spectra for viewing and illumination geometry before mosaicking.
The release combines their 3.1/1.65 µm ratio (red), 2.0 µm reflectance (green)
and 1.8 µm reflectance (blue) with the controlled ISS camera detail of
[Bland et al. (2018)](https://doi.org/10.1029/2018EA000399).
The producer removed seams and artifacts to make the global display composite.
The red tint highlights ice-related spectral differences; it is not a heat,
ice-abundance or crystallinity scale. Camera texture is finer than the infrared
measurements. The release does not supply a validity mask or the numeric
spectral channels behind its stretched colors.

The [published coordinate grid](evidence/infrared-mosaic/published-grid.jpg)
places 0° at the image center, 90°W at one quarter, 90°E at three quarters,
and ±180° at the edges. North is up; the equator is halfway down. Its spherical
equirectangular projection has radius 252.1 km, so latitude maps directly to
our planetocentric surface directions. We checked those distributed grid
positions and both poles rather than using the mislabeled longitudes in the
original paper's Figures 9 and 11; see the
[corrigendum](https://doi.org/10.1016/j.icarus.2020.113954).
The [native-pixel check](evidence/infrared-mosaic/source-sampling.json) compares
nine geographic samples, including all four image corners, against direct RGB
reads from the original TIFF; all agree exactly. This checks texture addressing,
not spacecraft pointing. The shared reader rolls the zero-centered image into
its 0–360° texture frame.
Native 2 × 2 footprint sampling and the existing lossy image lane produce the
same retained triangle atlas used by the other photographic views.
No new recoloring, gap filling, photometric correction or geometry is applied.

This geographic placement preserves the published map. It does not make its
2018 ISS control solution identical to the corrected JPL v2 shape. Bland §2.3
also describes errors from projecting a triaxial body onto a sphere and omitting
libration. Local image-to-shape offsets and photographed shadows remain possible;
the existing globe Shadows control adds approximate lighting to the composite.

The six-observation **Ice absorption** and **Infrared ratio** views retain their
original partial coverage and interpretation. Expanding that custom mapping was
investigated but is not the source of the new view. The full
[Filacchione et al. (2022) paper](https://doi.org/10.1016/j.icarus.2021.114803)
provides a stronger basis for future quantitative maps: wavelength-dependent
photometric correction and median 0.5° footprint bins. Its Figure 11 still has
polar gaps and residual seams. We inspected its publisher and INAF releases but
have not retrieved the promised numeric map files. The
[Ntinos et al. (2025) abstract](https://doi.org/10.5194/epsc-dps2025-400)
describes further navigation and super-resolution work; a downloadable map was
not found in the inspected records. These findings and reopening conditions are
recorded in the investigation ledger.

### Delivery checks for this view

The 2026-09-27 checks used `b33089487811511e7015aa5a629e692f4a328e2d`
plus this PR's Enceladus source, recipe, reader text and inventory changes.
[Desktop](evidence/infrared-mosaic/globe.png) and
[south-polar](evidence/infrared-mosaic/south-pole.png) captures show the delivered
composite; the [browser record](evidence/infrared-mosaic/browser-checks.json)
records Chrome 153.0.8010.54, camera and settings. Desktop at 1440 × 900
(DPR 1 and 2) and the mobile panel at 390 × 844 (DPR 2) had no page errors or
failed HTTP responses. Shadows and globe rotation were inspected separately.
Fine triangle-boundary lines remain visible on the existing mesh, especially
with Shadows enabled.

The full Enceladus bake passed. All 19 affected source-reader and source-binding
tests and all three Enceladus runtime-package tests passed; the latter exercise
every lens and setting through the shared retained selection owner. Source-file
coverage, body-reference checks and the reader-text publisher/check passed.
The parsed scene is exactly equal to the published baseline, and existing globe
texture bytes are unchanged. The full bake also regenerated the normal and
elevation minimaps through the current shared preparation; those small previews
were inspected, not claimed byte-identical. The unchanged arrival image is retained.

All 56 runtime assets were published and
[freshly restored](evidence/infrared-mosaic/restoration.json) from R2 with the
standard installer's byte-count and SHA-256 checks: 32,151,471 bytes for the
whole Enceladus package. The final browser captures use those restored files.
Each cold browser case fetched the same 1,928,874-byte infrared surface texture;
this is the texture body size, not the full page transfer. No full-site build
was run. The all-object sprite preparation encountered an unrelated missing
Moon texture; it had already generated the Enceladus sprite.

## Evidence

The photographic atlas now samples each pinned original grid directly with a 2 × 2 texel footprint. It retains the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains the sampling and encoding controls.

| View | Original grid | Both lighting images, before → current |
| --- | --- | --- |
| normal | 16098 × 8049 | 8.31 → 12.18 MB |

Each atlas remains 2048 × 16000 pixels, with 2000 retained faces. The scene bytes match [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/enceladus/prepared). WebP quality is 95; decoded texture size is unchanged. Sampling details and output hashes are recorded in the prepared surface metadata (`prepared/surfaces.json`). Source resolution, gaps and existing registration limitations still apply.

The [browser comparison](evidence/native-source-sampling.png) uses identical camera
coordinates at 4× zoom, Shadows off, Chromium at DPR 1, on revision `3dc424757`.
It separates the previous quality-90 image, the same intermediate-map sampling
encoded at quality 95, and native-grid sampling at quality 95. The native result
retains finer fracture detail; some improvement also comes from encoding quality.
The selected view was also inspected with Shadows on. This checks visible output,
not scientific registration accuracy or full browser conformance.

A fresh [Pixelmatch comparison](evidence/native-pixelmatch/comparison.png) uses
Chrome 153.0.8010.12, 1280 × 720, DPR 1 and an unchanged 520 × 480 crop. It runs
on the merge of `e0487eff5` with main `c13f3643b`, whose renderer and scene are
retained. [Capture settings and byte pins](evidence/native-pixelmatch/capture.json)
identify the exact previous-main atlas and the encoding-only control.

Pixelmatch 7.2.0 uses threshold **0.1**, including anti-aliasing, without masks.

| Comparison | Mismatched pixels / 249,600 |
| --- | ---: |
| [Independent unchanged repeat](evidence/native-pixelmatch/repeat.json) | 0 |
| [Previous atlas → native sampling](evidence/native-pixelmatch/change.json) | 20 |
| [Quality-95 control → native sampling](evidence/native-pixelmatch/sampling.json) | 19 |

The repeat has zero mismatches after waiting for label fades. Only a few pixels
exceed the threshold; most photographic changes are subtle. Inspection shows
finer fracture texture. These counts do not measure sharpness or registration
accuracy.
The four input crops and three diffs are retained beside their reports. Reproduce
a comparison with `node tools/investigations/compare-visual-evidence.mts <reference.png>
<result.png> <diff.png> <report.json>` from the repository root.

- The formal pinned Python environment reproduced the exact ZIP hash (see [docs/moons/b2-preparation/enceladus-dsk-reproduction.json](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b2-preparation/enceladus-dsk-reproduction.json)).

- The visual-trial candidate uses 2,000 source-preserving native triangles with regularization and a 2,523 m rendering error ceiling. Four barycentric positions on every retained triangle gave a maximum one-way source distance of 1,822.01 m; source Cartesian extrema differ by at most 533 m. These rendering measurements are not source uncertainty or an exhaustive Hausdorff bound.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Enceladus (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 43 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- **Monochrome:** This is photographed brightness, not calibrated albedo. Source shadows and mosaic brightness differences remain. Missing observations receive the shared gray grid, never inferred terrain.

- **Elevation:** Values are **kilometres above the reference ellipsoid with semi-axes 256.2 × 251.4 × 248.6 km**, not heights above the 256.2 km cartographic sphere.

- **VIMS:** They preserve partial support and archive filtering; illumination is not photometrically corrected.

- **Corrected-v2 shape:** Qualification status: source intake and recipe proposal. Salih crater at −5° East and other identifiable features provide cross-solution registration checks; actual image-to-v2 alignment and prepared error remain qualification work. Browser limb and feature qualification remains pending.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="enceladus-sources-and-preparation"></a>

Enceladus (NAIF 602) is a standalone moon of Saturn. The astronomy package carries the [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 252.10 km; the recipe reference sphere uses the same value. The proposed corrected-v2 source mesh supplies shape geometry at finite display resolution. The older Schenk elevation datum uses semi-axes 256.2, 251.4 and 248.6 km; these are not full diameters or the new DSK mesh coordinates.

## Schenk scientific surfaces

Credit NASA/JPL-Caltech/Space Science Institute, Paul M. Schenk, William B. McKinnon, LPI/USRA. Archive access constraints: none; use constraint: please cite authors. Original source hashes, byte sizes and URLs are in `source/manifest.json`; original ISIS/PDS4 labels are retained beside the files.

- 16098 × 8049 float pixels, 100 m archive grid, Cassini ISS CL1/CL2 clear filter. More than 500 registered images; native image detail varies. Preparation uses one linear display stretch, DN 0–16500 to 0–255, and bilinear geographic sampling. Shared globe Shadows provide approximate additional lighting and remain available.

- 8049 × 4025 float pixels, 200 m archive grid. The display uses a blue–neutral–warm palette over −1 to +1 km, with zero at the neutral midpoint. The legend explicitly marks saturation at ≤−1 and ≥+1 km; underlying elevations are unchanged. About 98% of a uniform 1024 × 512 valid raster sample lies inside that display range. Shading converts kilometre heights to metres, uses the source cartographic radius and latitude-dependent spacing, northwest light [-0.5, 0.5, √0.5], ambient 0.25, and no height exaggeration. The shared globe overlay adds curvature shading; Shadows switches it to directional illumination, as on Monochrome. This approximate overlay does not change the fixed terrain light direction. The legend shows unshaded height colors. This is a derived terrain model, not a direct height photograph.

Both GeoTIFFs are east-positive, planetocentric, equirectangular, center longitude 180°, standard parallel 0°, cartographic radius 256200 m. Their actual origins are (-804900, 402500) m for imagery and (-805000, 402600) m for elevation. Native origins and resolutions are validated and consumed, rather than assuming an exact 2:1 source extent. Both prepare to 8192 × 4096: about 197 m per equatorial map texel (193.5 m on the 252.3 km display reference). The model's 200 m grid is slightly enlarged; this adds no detail. Runtime always uses this same bank, independent of DPR. Surface and pole display atlases use WebP Q90, with lossless alpha and unchanged dimensions. Source maps used for further preparation, raw observations, numeric heights and legend scales retain their original precision.

The exact PDS missing constant is -3.40282265508890445e38. No-data, non-finite values and ISIS float special values are excluded before display stretching. Observed zero and other dark values remain valid. Bilinear image samples require all four source neighbours; terrain shading does not fabricate missing neighbours. The archive model is retained as published; its grid spacing is not a claim of uniform observational resolution or uncertainty.

The archive has metadata inconsistencies: PDS prose interchanges the image/DEM descriptions, and catalog observation dates precede Cassini's Saturn arrival. The product-specific raster dimensions, pixel mapping and missing constants agree between TIFF and labels. We do not reuse the inconsistent dates/descriptions.

[Paper: Schenk and McKinnon, Icarus 408, 115827](https://doi.org/10.1016/j.icarus.2023.115827). [NASA facts](https://science.nasa.gov/saturn/moons/enceladus/) describe the icy surface, global ocean, south-polar jets and 32.9-hour synchronous orbit. No visible atmosphere, invented plume animation, or interior lens is supplied.

## Orientation and sky

Sun, orbit and body-fixed orientation are prepared at the shared epoch 2026-09-04T00:00:00 TT using JPL Enceladus parent-relative elements, VSOP87 Saturn position and the IAU/WGCCRE Enceladus rotation.

## Source restoration

Raw source TIFFs are reacquired for preparation, not delivered to the browser. Prepared assets are local until an explicitly authorized publication step.

## B2 corrected v2 shape

NAIF states that images were reprocessed after errors in the original model. The 2024 original v1 DSK and the associated Zenodo spherical harmonics are excluded. The cited Park et al. paper (doi:10.1029/2023JE008054) describes the method; it is not a new publication validating the later corrected v2 release.

A pinned SpiceyPy 6.0.3/CSPICE N0067 acquisition operator extracts native kilometre coordinates. Exact duplicates are welded, with every original vertex-to-output mapping preserved. No epsilon weld, rotation, scale, smoothing or synthetic terrain is introduced. Raw DSK counts are 396,294 vertices and 786,432 plates. The actual converter produced 393,218 vertices: 3,076 exact duplicates were welded, with exact reconstruction of all original coordinates through the retained mapping. Target 602, frame 10040 (IAU_ENCELADUS), surface 20122, data type 2, class 1. The retained PCK/FK document the recommended body frame. Geometry is static; kernel 1950–2050 coverage is not an observation date or temporal terrain model.

Preparation requests 1,600 faces and a 1,000 m simplifier error ceiling. This is a requested approximation budget, not achieved accuracy. Original DSK radius extent is 247.68912735585084–257.59813481361255 km. The Shape view’s neutral gray distinguishes the geometry from observed imagery. The global family’s nominal 500 m resolution is not uniform detail in the selected Q256 model or the prepared mesh.

The existing Schenk elevation grid is retained: kilometres above a reference ellipsoid with semi-axes 256.2 × 251.4 × 248.6 km, not radius or full diameters. It must not be added to a sphere or to the JPL DSK.

Mesh error/topology, restored-source and prepared browser/visual gates remain pending. No readiness is claimed.

Its closed mesh has one component and Euler characteristic two.

<a id="cassini-spectral-surface-views"></a>

</details>
