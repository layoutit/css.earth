# Deimos sources and preparation

## Selected views

Monochrome uses [Stooke's Viking/MRO mosaic in the PDS Small Bodies Maps archive](https://sbn.psi.edu/pds/resource/stookemaps.html). The original JPEG is 7200 × 3600, north up and east-positive, with zero longitude at the center. Stooke's map guide identifies the added HiRISE observations ESP_012065_9000 and ESP_012068_9000 and revised control near 60°E. The 20 pixels/degree grid is approximately 5.4 m/pixel at a 6.2 km equator; much of the map has markedly poorer effective resolution.

The map retains photographed shading, seam adjustments and polar interpolation from its author. It has no supplied validity mask; dark values and blurred areas are not treated as missing solely from their brightness or appearance. We do not claim uniform observed global coverage, remove shadows by arbitrary brightness scaling, or create new terrain. These limitations are shown with the lens.

Elevation samples radius from the [Ernst et al. (2023) SPC model](https://doi.org/10.1186/s40623-023-01814-7), referenced to a 6.2 km sphere and displayed over −2.5 to +2.5 km. This is radial height, not elevation above a geoid. Facets whose corresponding released Albedo attribute is NaN are conservatively withheld from the scientific lens. This support rule does not claim a complete image-coverage mask. Incomplete interpolation footprints remain gaps. The recipe derives relief and preserves the shared Shadows control.

## Shape and frame

The [SBMT March 2025 release](https://sbmt.jhuapl.edu/shared-files/) supplies version 002 at 83 m spacing: 98,306 vertices and 196,608 triangles, with matching per-facet attributes. Its XYZ coordinates are in kilometres in the source body-fixed frame. Preparation samples the mesh directly and simplifies the presentation to 1,216 triangles. The full shape includes less-constrained regions; only part of Deimos has detailed SPC support. Do not describe the entire mesh as equally measured or infer new detail from it.

The vendored astronomy package supplies Mars-relative orbit, size and IAU orientation at the shared scene date. The newer shape and older mosaic have separate control histories, so geographic registration and shape extremities require visual inspection.

## Dataset survey

| Candidate | Decision |
| --- | --- |
| Stooke Viking/MRO 7200 × 3600 mosaic | Selected. Best mapped version in this release; its mixed detail and remaining source illumination are disclosed. |
| Earlier Stooke 3600 × 1800 mosaic | Superseded by the selected version; not a duplicate lens. |
| Ernst/SBMT 83 m shape and matching facet attributes | Selected for shape and the supported Elevation view. |
| Original Viking and MRO frames | Available mission observations; the selected mosaic already integrates the identified useful HiRISE images. |
| Hope EXI and TGO/CaSSIS color observations | Regional/perspective observations, not a qualified registered global color raster for this shape. Excluded from this PR rather than extrapolated over the surface. |
| Thermal/spectral measurements | No qualified mapped product selected; disk spectra do not become texture lenses. |

Exact originals and acquisition URLs are pinned in `source/manifest.json`. The map guide and SBMT label remain beside the package. Prepared textures, minimaps and shape-correct navigation images share the same source interpretation. No private controller or body-specific shell is introduced.
