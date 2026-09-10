# Phobos

## Sources

- Monochrome uses [Stooke's DLR-controlled multi-mission mosaic](https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m), distributed as a 14400 × 7200 byte GeoTIFF.

- Elevation samples the newer Ernst/SBMT shape model, using radial height in kilometres above an authored 11.1 km reference sphere and a −3.5 to +3.5 km palette.

- Relative albedo preserves the archive scale without an absolute-albedo claim. Slope is gravity-relative under the source authors’ rotation, uniform-density and Mars-distance assumptions.

## Evidence

- Exact GeoTIFF origin, scale and missing value are checked by the recipe.

- Four barycentric samples per retained face gave a maximum distance of 201.67 m for Phobos; these are sampled rendering errors, not source measurement uncertainty or an exhaustive bound.

## Known problems

- This is an illuminated observation mosaic, not recovered albedo. Stooke explicitly describes artistic adjustments where opposing lighting meets and an approximate registration to DLR control. We retain that limitation and do not claim that local crater shadows have been removed.

- This is radial height, not elevation above a geoid. This presentation is a low-resolution approximation of the released model, not the original scientific mesh.

- **Relative albedo and slope:** Complete atlas transfer qualification remains a separate preparation check. The authored support policy withholds any facet whose released Albedo field is non-finite in both new views; this is not a complete photographic coverage mask.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="phobos-sources-and-preparation"></a>

## Selected views

Its 40 pixels/degree grid is about 4.84 m/pixel at the reference equator; effective image detail varies. North is up, longitude increases eastward and zero longitude is at the map center. The source reference sphere is 11.1 km.

The source's zero no-data value is resolved before interpolation. Genuine dark observations are retained.

Cartographic relief derives from the same measured model used for geometry; the app’s directional Shadows control remains separate.

## Shape and frame

The [Ernst et al. (2023) SPC shape](https://doi.org/10.1186/s40623-023-01814-7) is the 148 m version of the [SBMT March 2025 release](https://sbmt.jhuapl.edu/shared-files/), version 004. Its 98,306 XYZ vertices and 196,608 triangles are retained as a pinned OBJ archive. Coordinates are in kilometres in the source body-fixed frame. Preparation simplifies the original indexed mesh to a 1,600-face native triangle presentation; there is no radial remeshing, spherical substitute or invented terrain.

Physical size, orbit and IAU rotation use the vendored astronomy package at the shared scene epoch. Shape and cartographic products have different source histories; their registration must be inspected at Stickney and the opposite hemisphere. A display mesh cannot remove the source mosaic's residual control errors.

## Dataset survey

| Candidate | Decision |
| --- | --- |
| Stooke DLR-controlled 5 m mosaic | Selected for the best broadly mapped image detail. Original source shading and variable resolution disclosed. |
| DLR Mars Express SRC 12 m global mosaic | Not an additional lens: overlapping monochrome content at lower map density. Its control underlies the selected mosaic. |
| HRSC/Viking 100 m terrain model | Inspected, then superseded by the newer SPC mesh for Elevation: shared shape registration and no discontinuity at the older DEM seam. |
| Ernst/SBMT 148 m shape and facet attributes | Shape, Elevation, Relative albedo and Slope selected. The albedo view retains the archive scale and coarse facet support; it is separate from the image mosaic and does not recover absolute albedo or invent image detail. |
| HiRISE/HRSC regional color images | Not included: perspective images are not a registered global color map. A controlled projection onto this irregular shape and per-observation photometry would need separate qualification. No color inferred from monochrome. |
| Thermal or mineralogical spectra | No qualified mapped surface product selected. Disk spectra are not surface lenses. |

Inputs, original URLs, byte lengths and SHA-256 pins are recorded in `source/manifest.json`. `source/observations/map-guide.html` is the upstream Stooke map documentation; the SBMT label accompanies the mesh. Prepared surface, lighting, minimap and navigation imagery must be generated from this same interpretation. Shared controls, camera and shell remain generic.

## B2 facet science and terrain

Every one of the 196,608 source table rows is registered to its source triangle. Display colors use the nearest full-source triangle within the authored distance limit; they are not interpolated across facets. Original table row IDs are retained in the preparation atlas index.

The full source mesh now supplies a 1,600-face native triangle presentation. The authored transfer limit is 250 m.

The facet-science flat preview is explicitly 640 × 320, with nearest, lossless packing for its minimap and temporary projective textures. It makes 204,800 unique-ray queries per lens; ambiguous radial intersections remain missing. This is a display-preview resolution, not a new scientific grid. The complete 196,608-row source tables, native triangle atlas dimensions and original-row atlas indices are unchanged. Native material colors still query the full source surface directly and never sample this reduced flat preview.

</details>

## Catalogue attribution

The Stooke mosaic retains its collective Viking-orbiter capture credit. Its source record now marks the individual mission and vehicle identities as unresolved. The separate Viking mission and vehicle catalogue records do not establish which orbiter supplied this mosaic’s observations. See the [shared catalogue contract](../../../docs/architecture/exploration-catalog.md) and this body’s [source manifest](source/manifest.json). Dataset bytes and rendering are unchanged by this metadata migration.
