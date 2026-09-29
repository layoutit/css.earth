# Mimas

Mimas shows two Cassini image mosaics, terrain, and a shape-linked map of relative surface brightness.

## Sources

- [NASA 2017 monochrome map](https://science.nasa.gov/resource/mimas-global-map-june-2017/): Cassini ISS, 5760 × 2880, 16 pixels/degree, 216 m/pixel on the 198.2 km cartographic sphere.

- [NASA/JPL 2014 enhanced-color map](https://www.jpl.nasa.gov/images/pia18437-color-maps-of-mimas-2014/): 6356 × 3178, infrared–green–ultraviolet.

- [Weirich, Gaskell, Palmer and Domingue (2025), Mimas SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichmimasshape.html), NASA PDS, DOI [10.26033/y8wv-r303](https://doi.org/10.26033/y8wv-r303). This bundle supplies the shape, radius and relative-albedo grids.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

The photographic atlases sample the original source grids directly with a 2 × 2 texel footprint. They retain the source frame, coverage policy and fixed-epoch lighting. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains sampling and encoding. The current reduced atlas dimensions and real-device checks are recorded under Preparation below; earlier full-size atlas byte counts do not describe this delivery.

- Herschel is at roughly 1.38° S, 111.76° W (248.24° E), independently documented in the [IAU gazetteer](https://planetarynames.wr.usgs.gov/Feature/2478).

- On 1,800 independent viewing directions, the candidate differs from the Q128 surface by about 0.9 km at the median and 2.5 km at the 95th percentile; these are approximation errors, not measurement uncertainties.

- The native relative-albedo GeoTIFF contains 2,468,642 valid cells from 0.582471 to 1.407658. Three independently decoded [source anchors](source/validation/relative-albedo-anchors.json) check its byte layout, coordinates and values before preparation.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Mimas (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

Feature notes: 2 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Published seams, residual shading, coarse inserts and limited-color regions remain; no detail is synthesized.

- The published rectangular display maps provide no validity mask or missing-value code.

- **Elevation and relative brightness:** All source cells are valid, but both GeoTIFF geotransforms end at 359.1517° E and 89.5759° S, short of the labels’ nominal global bounds. We honor the actual georeference and mark those narrow edge gaps with the shared gray grid.

- The surface is a coarse approximation of the source mesh; it does not reproduce every small crater. Flood and optional directional Shadows are baked from the mesh normals; photographed local shading is not reconstructed.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="mimas-sources-and-preparation"></a>

Mimas is a standalone Saturn moon using the generic object contract.

- The labeled companion establishes a 180° E left edge. Preparation rolls the map by half its width into 0–360° E.

- The LPI labeled companion establishes a 0° E left edge. The producer calibrated, registered and photometrically corrected the contributing observations.

Both use north at the top. Different control networks can leave positional differences between mosaics.

Preserve all supplied pixels, including black crater shadows; do not infer missing coverage from darkness. No inpainting, polar repetition, color synthesis, or patch blending is performed here.

The monochrome source is 5760 × 2880 and the enhanced-color source is 6356 × 3178. Both photographic atlases sample those original grids directly with a 2 × 2 footprint onto the same 720 retained triangles. Their prepared `textureScale: 0.25` writes a 1660 × 1773 image against the canonical 6640 × 7092 atlas layout; CSS addressing, geometry and lighting coordinates remain unchanged. Each decoded RGBA photograph is 11.2 MiB. Encoding uses the shared lossy WebP lane, including its quality constant; numeric and categorical assets keep their own existing sampling and lossless encoding. This display texture is coarser than the source and does not add scientific resolution.

The [iPad A16 arrival checks](evidence/ipad-atlas-footprint.json) on 2026-09-28 (`tablet-saturn-mimas-rebaked-atlas-normal-2026-09-28T22-32-04-192Z`, based on `be56785c42` plus the photographic-scale repair) completed Saturn → Mimas in 4.35 seconds, with a longest reported frame of 46.9 ms and no console errors. The native filmstrip and final device screenshot were inspected. The preceding full-size atlas had multi-second compositor stalls. The same repair rebaked all Mimas assets together: the previous inventory paired a 6640 × 7092 layout with a 6611 × 7078 image. Publication now checks surface records against the image inventory and dimensions.

## Elevation

The Cassini-derived numeric radius GeoTIFF is 2222 × 1111 at 559.13 m grid spacing; effective detail and terrain-model uncertainty vary. Its original PDS XML label is retained beside the raster.

Preparation converts center-relative radius in meters into height in kilometers: `radius * 0.001 - 198.2`. The reference is the archive's 198.2 km sphere, not the astronomy package's 198.8 km mean radius. Color spans −12.5 to +12.5 km and includes the body's broad oval shape. Brightness shows northwest cartographic relief, using the source radius and latitude-dependent spacing, with no height exaggeration. Bilinear interpolation stays within the measured raster; the shared 8192 × 4096 texture layout adds no terrain detail. Shape-aware flood lighting and optional directional Shadows remain available, as on the other lenses.

No stretching, extrapolation or gap filling is applied. Those texture-coverage gaps do not limit geometry: the separate, complete OBJ release supplies the surface shape.

## Relative brightness

The PDS product calls this quantity relative albedo. It is the brightness field solved together with the Cassini stereophotoclinometry shape model, normalized around a map average of about 1. A cell at 0.9 is 10% darker than that average; a cell at 1.1 is 10% brighter. It is not visible color, geometric albedo or calibrated reflectance. Terrain, shadows and the model solution can affect it.

The native `mimas_albedo_g.tif` grid is 2,222 × 1,111 float cells at 559.13 m spacing. Every stored cell is valid. Values span 0.582471–1.407658; 98% fall between 0.889682 and 1.115714. The display uses 0.9–1.1 so the broad pattern is visible and saturates the sparse extremes. Preparation uses the GeoTIFF’s actual 180° E centered geotransform, bilinear source sampling and the shared missing-data grid for the narrow eastern and southern areas outside the raster. It does not stretch or fill the source. This lens uses the supported quarter-density atlas: its 2,048 × 1,024 working raster closely matches the native grid instead of oversampling a lossless numeric layer.

## Geometry and scope

The astronomy package supplies the [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 198.20 km, which the recipe sphere also uses, the Saturn-relative orbit, and the IAU body orientation at the shared epoch. Geometry comes from the complete 2025 PDS Q128 OBJ: 98,306 vertices and 196,608 triangular faces, with approximately 2.2 km source spacing. Shared preparation uses meshoptimizer 1.2.0 to simplify the released topology to 720 triangles, retaining original source positions with a 4 km simplifier error limit. It preserves the oval silhouette and broad Herschel depression without height exaggeration. The shared renderer receives only the prepared native triangles; simplification runs during preparation. OBJ coordinates are kilometers in the source body-fixed frame, converted to meters without axis rotation. Independent sampling against the released radius GeoTIFF checks geography and scale. The original OBJ label and bundle description are checked in; the 17.7 MB OBJ is reacquired from its pinned PDS URL, rather than committed.

No atmosphere, plumes, cutaway, invented height model, or duplicate photographic lens is added.

Pinned URLs and hashes live in source/manifest.json. The context portrait is rendered from the same simplified mesh and Monochrome source, showing the correct silhouette. Runtime uses only prepared assets.

</details>
