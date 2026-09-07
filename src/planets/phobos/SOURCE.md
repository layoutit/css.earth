# Phobos sources and preparation

## Selected views

Monochrome uses [Stooke's DLR-controlled multi-mission mosaic](https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m), distributed as a 14400 × 7200 byte GeoTIFF. Its 40 pixels/degree grid is about 4.84 m/pixel at the reference equator; effective image detail varies. North is up, longitude increases eastward and zero longitude is at the map center. The source reference sphere is 11.1 km. Exact GeoTIFF origin, scale and missing value are checked by the recipe.

This is an illuminated observation mosaic, not recovered albedo. Stooke explicitly describes artistic adjustments where opposing lighting meets and an approximate registration to DLR control. We retain that limitation and do not claim that local crater shadows have been removed. The source's zero no-data value is resolved before interpolation. Genuine dark observations are retained.

Elevation samples the newer Ernst/SBMT shape model, using radial height in kilometres above an authored 11.1 km reference sphere and a −3.5 to +3.5 km palette. This is radial height, not elevation above a geoid. Cartographic relief derives from the same measured model used for geometry; the app’s directional Shadows control remains separate.

## Shape and frame

The [Ernst et al. (2023) SPC shape](https://doi.org/10.1186/s40623-023-01814-7) is the 148 m version of the [SBMT March 2025 release](https://sbmt.jhuapl.edu/shared-files/), version 004. Its 98,306 XYZ vertices and 196,608 triangles are retained as a pinned OBJ archive. Coordinates are in kilometres in the source body-fixed frame. Preparation intersects rays with that mesh and simplifies the presentation to 1,216 triangles; there is no spherical substitute or invented terrain. This presentation is a low-resolution approximation of the released model, not the original scientific mesh.

Physical size, orbit and IAU rotation use the vendored astronomy package at the shared scene epoch. Shape and cartographic products have different source histories; their registration must be inspected at Stickney and the opposite hemisphere. A display mesh cannot remove the source mosaic's residual control errors.

## Dataset survey

| Candidate | Decision |
| --- | --- |
| Stooke DLR-controlled 5 m mosaic | Selected for the best broadly mapped image detail. Original source shading and variable resolution disclosed. |
| DLR Mars Express SRC 12 m global mosaic | Not an additional lens: overlapping monochrome content at lower map density. Its control underlies the selected mosaic. |
| HRSC/Viking 100 m terrain model | Inspected, then superseded by the newer SPC mesh for Elevation: shared shape registration and no discontinuity at the older DEM seam. |
| Ernst/SBMT 148 m shape and facet albedo | Shape and Elevation selected. The companion albedo is scientifically useful but much coarser than the image mosaic; it is retained in the local source trial, not substituted for HD observations or used to invent texture detail. |
| HiRISE/HRSC regional color images | Not included: perspective images are not a registered global color map. A controlled projection onto this irregular shape and per-observation photometry would need separate qualification. No color inferred from monochrome. |
| Thermal or mineralogical spectra | No qualified mapped surface product selected. Disk spectra are not surface lenses. |

Inputs, original URLs, byte lengths and SHA-256 pins are recorded in `source/manifest.json`. `source/observations/map-guide.html` is the upstream Stooke map documentation; the SBMT label accompanies the mesh. Prepared surface, lighting, minimap and navigation imagery must be generated from this same interpretation. Shared controls, camera and shell remain generic.
