# Mimas sources and preparation

Mimas is a standalone Saturn moon using the generic object contract.

- [NASA 2017 monochrome map](https://science.nasa.gov/resource/mimas-global-map-june-2017/): Cassini ISS, 5760 × 2880, 16 pixels/degree, 216 m/pixel on the 198.2 km cartographic sphere. The labeled companion establishes a 180° E left edge. Preparation rolls the map by half its width into 0–360° E.
- [NASA/JPL 2014 enhanced-color map](https://www.jpl.nasa.gov/images/pia18437-color-maps-of-mimas-2014/): 6356 × 3178, infrared–green–ultraviolet. The LPI labeled companion establishes a 0° E left edge. The producer calibrated, registered and photometrically corrected the contributing observations. Published seams, residual shading, coarse inserts and limited-color regions remain; no detail is synthesized.

Both use north at the top. Herschel is at roughly 1.38° S, 111.76° W (248.24° E), independently documented in the [IAU gazetteer](https://planetarynames.wr.usgs.gov/Feature/2478). Different control networks can leave positional differences between mosaics.

The published rectangular display maps provide no validity mask or missing-value code. Preserve all supplied pixels, including black crater shadows; do not infer missing coverage from darkness. No inpainting, polar repetition, color synthesis, or patch blending is performed here.

The observation maps retain an 8192 × 4096 preparation raster: monochrome is sourced at 5760 × 2880 and color at 6356 × 3178. Preparation maps them onto 720 native PolyCSS raster triangles, with 256-pixel atlas cells (4096 × 11520). The texture allocation is independent of geometry reduction. Terminal atlases retain WebP quality 90 and lossless alpha. Flood and optional directional Shadows are baked from the mesh normals; photographed local shading is not reconstructed.

## Elevation

[Weirich, Gaskell, Palmer and Domingue (2025), Mimas SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichmimasshape.html), NASA PDS, DOI [10.26033/y8wv-r303](https://doi.org/10.26033/y8wv-r303). The Cassini-derived numeric radius GeoTIFF is 2222 × 1111 at 559.13 m grid spacing; effective detail and terrain-model uncertainty vary. Its original PDS XML label is retained beside the raster.

Preparation converts center-relative radius in meters into height in kilometers: `radius * 0.001 - 198.2`. The reference is the archive's 198.2 km sphere, not the astronomy package's 198.8 km mean radius. Color spans −12.5 to +12.5 km and includes the body's broad oval shape. Brightness shows northwest cartographic relief, using the source radius and latitude-dependent spacing, with no height exaggeration. Bilinear interpolation stays within the measured raster; the shared 8192 × 4096 texture layout adds no terrain detail. Shape-aware flood lighting and optional directional Shadows remain available, as on the other lenses.

All source cells are valid, but the GeoTIFF geotransform ends at 359.1517° E and 89.5759° S, short of the label's nominal global bounds. We honor the actual georeference and mark those narrow edge gaps with the shared gray grid. No stretching, extrapolation or gap filling is applied. Those texture-coverage gaps do not limit geometry: the separate, complete OBJ release supplies the surface shape.

## Geometry and scope

The astronomy package supplies a mean radius of 198.8 km, the Saturn-relative orbit, and the IAU body orientation at the shared epoch. Geometry comes from the complete 2025 PDS Q128 OBJ: 98,306 vertices and 196,608 triangular faces, with approximately 2.2 km source spacing. Shared preparation uses meshoptimizer 1.2.0 to simplify the released topology to 720 triangles, retaining original source positions with a 4 km simplifier error limit. It preserves the oval silhouette and broad Herschel depression without height exaggeration. On 1,800 independent viewing directions, the candidate differs from the Q128 surface by about 0.9 km at the median and 2.5 km at the 95th percentile; these are approximation errors, not measurement uncertainties. The shared renderer receives only the prepared native triangles; simplification runs during preparation. The surface is a coarse approximation of the source mesh; it does not reproduce every small crater. OBJ coordinates are kilometers in the source body-fixed frame, converted to meters without axis rotation. Independent sampling against the released radius GeoTIFF checks geography and scale. The original OBJ label and bundle description are checked in; the 17.7 MB OBJ is reacquired from its pinned PDS URL, rather than committed.

No atmosphere, plumes, cutaway, invented height model, or duplicate photographic lens is added.

Pinned URLs and hashes live in source/manifest.json. Restore with the shared acquisition command and prepare with the authored-object pipeline. The context portrait is rendered from the same simplified mesh and Monochrome source, showing the correct silhouette. Runtime uses only prepared assets.
