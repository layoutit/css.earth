# Mimas

Mimas shows two Cassini image mosaics, terrain, and a shape-linked map of relative surface brightness, on a shape model that keeps its oval silhouette and the broad Herschel depression.

## Sources

- [NASA 2017 monochrome map](https://science.nasa.gov/resource/mimas-global-map-june-2017/): Cassini ISS, 5760 × 2880, 16 pixels/degree, 216 m/pixel on the 198.2 km cartographic sphere.
- [NASA/JPL 2014 enhanced-color map](https://www.jpl.nasa.gov/images/pia18437-color-maps-of-mimas-2014/): 6356 × 3178, infrared–green–ultraviolet. The producer calibrated, registered and photometrically corrected the contributing observations.
- [Weirich, Gaskell, Palmer and Domingue (2025), Mimas SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichmimasshape.html), NASA PDS, DOI [10.26033/y8wv-r303](https://doi.org/10.26033/y8wv-r303). This bundle supplies the shape, radius and relative-albedo grids.
- The [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) supplies the 198.20 km mean radius.
- Named features come from the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile (retrieved 2026-09-11, public domain per its FGDC metadata). Two labelled names carry a caption note from the lead of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), credited in the caption beside the IAU naming year.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

**Photographs.** The monochrome map's labeled companion gives a 180° E left edge, so preparation rolls it by half its width into 0–360° E; the color map starts at 0° E. All supplied pixels are kept, including black crater shadows. There is no inpainting, color synthesis or patch blending. Both atlases sample the original grids directly with a 2 × 2 footprint onto the same 720 triangles, at `textureScale: 0.25` (a 1660 × 1773 image). Encoding uses the shared lossy WebP lane. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) explains sampling and encoding.

**Elevation.** The numeric radius GeoTIFF is 2222 × 1111 at 559.13 m grid spacing. Preparation converts radius into height: `radius * 0.001 - 198.2` km, above the archive's 198.2 km sphere. Color spans −12.5 to +12.5 km and includes the body's broad oval shape. Northwest relief shading uses no height exaggeration.

**Relative brightness.** The PDS product calls this quantity relative albedo: the brightness field solved together with the stereophotoclinometry shape, normalized around a map average of about 1. A cell at 0.9 is 10% darker than that average. It is not visible color, geometric albedo or calibrated reflectance. Values span 0.582471–1.407658; 98% fall between 0.889682 and 1.115714, so the display uses 0.9–1.1 and saturates the sparse extremes.

**Shape.** Geometry comes from the complete 2025 PDS Q128 OBJ: 98,306 vertices and 196,608 faces, with approximately 2.2 km source spacing. Meshoptimizer 1.2.0 simplifies it to 720 triangles with a 4 km error limit and no height exaggeration.

## Evidence

- Herschel is at roughly 1.38° S, 111.76° W (248.24° E), independently documented in the [IAU gazetteer](https://planetarynames.wr.usgs.gov/Feature/2478). Feature placement was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.
- On 1,800 independent viewing directions, the display shape differs from the Q128 surface by about 0.9 km at the median and 2.5 km at the 95th percentile; these are approximation errors, not measurement uncertainties.
- The relative-albedo GeoTIFF contains 2,468,642 valid cells. Three independently decoded [source anchors](source/validation/relative-albedo-anchors.json) check its byte layout, coordinates and values.
- On an iPad A16, Saturn → Mimas completed in 4.35 seconds, with a longest reported frame of 46.9 ms and no console errors.

## Known problems

- Published seams, residual shading, coarse inserts and limited-color regions remain; no detail is synthesized. Different control networks can leave positional differences between the two mosaics.
- The published rectangular display maps provide no validity mask or missing-value code.
- The photographic display texture is coarser than the source and adds no scientific resolution.
- **Elevation and relative brightness:** both GeoTIFF geotransforms end at 359.1517° E and 89.5759° S, short of the labels' nominal global bounds. Those narrow edge gaps show the shared gray grid. Relative brightness can be affected by terrain, shadows and the model solution.
- Every display atlas is 1,660 × 1,773 pixels, 64 × 64 texels a face, which reduces display detail, not the source data. Until 5 October 2026 the layout was four times those dimensions: the elevation atlas filled it (47 megapixels from a 2.5 megapixel grid) and the photographs were stored at a quarter of it and drawn enlarged, 346 to 398 ms a dataset switch on an iPad against 89 to 94 ms now.
- The surface is a coarse approximation of the source mesh; it does not reproduce every small crater. Lighting is baked from the mesh normals; photographed local shading is not reconstructed.
- Feature outlines trace a rim circle for craters and an extent box for other types; they are not published nomenclature boundaries.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
