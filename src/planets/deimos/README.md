# Deimos

## Sources

- Monochrome uses [Stooke's Viking/MRO mosaic in the PDS Small Bodies Maps archive](https://sbn.psi.edu/pds/resource/stookemaps.html).

- Elevation samples radius from the [Ernst et al. (2023) SPC model](https://doi.org/10.1186/s40623-023-01814-7), referenced to a 6.2 km sphere and displayed over −2.5 to +2.5 km.

- Relative albedo preserves the archive scale without an absolute-albedo claim. Slope is gravity-relative under the source authors’ rotation, uniform-density and Mars-distance assumptions.

## Evidence

- Stooke's map guide identifies the added HiRISE observations ESP_012065_9000 and ESP_012068_9000 and revised control near 60°E.

- Four barycentric samples per retained face gave a maximum distance of 69.40 m for Deimos; these are sampled rendering errors, not source measurement uncertainty or an exhaustive bound.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Deimos (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

- The map retains photographed shading, seam adjustments and polar interpolation from its author. It has no supplied validity mask; dark values and blurred areas are not treated as missing solely from their brightness or appearance. We do not claim uniform observed global coverage, remove shadows by arbitrary brightness scaling, or create new terrain.

- This is radial height, not elevation above a geoid. Facets whose corresponding released Albedo attribute is NaN are conservatively withheld from the scientific lens. This support rule does not claim a complete image-coverage mask.

- Complete atlas transfer qualification remains a separate preparation check.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="deimos-sources-and-preparation"></a>

## Selected views

The original JPEG is 7200 × 3600, north up and east-positive, with zero longitude at the center. The 20 pixels/degree grid is approximately 5.4 m/pixel at a 6.2 km equator; much of the map has markedly poorer effective resolution.

These limitations are shown with the lens.

Incomplete interpolation footprints remain gaps. The recipe derives relief and preserves the shared Shadows control.

## Shape and frame

The [SBMT March 2025 release](https://sbmt.jhuapl.edu/shared-files/) supplies version 002 at 83 m spacing: 98,306 vertices and 196,608 triangles, with matching per-facet attributes. Its XYZ coordinates are in kilometres in the source body-fixed frame. Preparation simplifies the original indexed mesh to a 1,600-face native triangle presentation. The full shape includes less-constrained regions; only part of Deimos has detailed SPC support. Do not describe the entire mesh as equally measured or infer new detail from it.

The vendored astronomy package supplies Mars-relative orbit, size and IAU orientation at the shared scene date. The newer shape and older mosaic have separate control histories, so geographic registration and shape extremities require visual inspection.

## Dataset survey

| Candidate | Decision |
| --- | --- |
| Stooke Viking/MRO 7200 × 3600 mosaic | Selected. Best mapped version in this release; its mixed detail and remaining source illumination are disclosed. |
| Earlier Stooke 3600 × 1800 mosaic | Superseded by the selected version; not a duplicate lens. |
| Ernst/SBMT 83 m shape and matching facet attributes | Selected for shape, supported Elevation, Relative albedo and gravity-relative Slope. Missing albedo support remains withheld in the scientific views. |
| Original Viking and MRO frames | Available mission observations; the selected mosaic already integrates the identified useful HiRISE images. |
| Hope EXI and TGO/CaSSIS color observations | Regional/perspective observations, not a qualified registered global color raster for this shape. Excluded from this PR rather than extrapolated over the surface. |
| Thermal/spectral measurements | No qualified mapped product selected; disk spectra do not become texture lenses. |

Exact originals and acquisition URLs are pinned in `source/manifest.json`. The map guide and SBMT label remain beside the package. Prepared textures, minimaps and shape-correct navigation images share the same source interpretation. No private controller or body-specific shell is introduced.

## B2 facet science and terrain

Every one of the 196,608 source table rows is registered to its source triangle. Display colors use the nearest full-source triangle within the authored distance limit; they are not interpolated across facets. Original table row IDs are retained in the preparation atlas index.

The full source mesh now supplies a 1,600-face native triangle presentation. The authored transfer limit is 100 m. Deimos facets with missing albedo remain withheld in both new views.

The facet-science flat preview is explicitly 640 × 320, with nearest, lossless packing for its minimap and temporary projective textures. It makes 204,800 unique-ray queries per lens; ambiguous radial intersections remain missing. This is a display-preview resolution, not a new scientific grid. The complete 196,608-row source tables, native triangle atlas dimensions and original-row atlas indices are unchanged. Native material colors still query the full source surface directly and never sample this reduced flat preview.

</details>

## Catalogue attribution

The Stooke mosaic retains separate capture statements for its collective Viking-orbiter credit and its Mars Reconnaissance Orbiter contribution. The Viking identities remain unresolved; MRO remains an explicit spacecraft/mission pair. Membership in a Viking mission does not attribute the image to a lander. See the [shared catalogue contract](../../../docs/architecture/exploration-catalog.md) and this body’s [source manifest](source/manifest.json). Dataset bytes and rendering are unchanged by this metadata migration.
