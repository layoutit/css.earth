# Ryugu

## Sources

| View or property | Source and interpretation |
| --- | --- |
| V-band reflectance | JAXA ONC v06 corrected numeric map. Its 0–0.035 display is distinct from the brightness-matched color composite. |
| Color composite | [Hirata et al. 2026 ONC mapping release](https://doi.org/10.7910/DVN/WW3IH0). Channels p/v/ul are false color, not natural color. |
| Shape and Elevation | [March 2020 SPC DSK](https://data.darts.isas.jaxa.jp/pub/pds4/data/hyb2/hyb2_spice/spice_kernels/dsk/ryugu_shape_spc_200k_v20200323.bds), selected for registration. Elevation is radius minus 448 m, not gravitational height. |

## Evidence

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 2.775 / 7.243 / 19.166 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

The earlier source notes report Headless Chrome 152 checks of the then-selected lenses with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom.

[Source test definitions](../../../tests/objects/unit/ryugu/source.test.mts).

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ryugu (retrieved 2026-09-12, public domain as USGS-produced data; the export ships no FGDC record, so the pin cites the USGS Copyrights and Credits statement) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table (no projection file or metadata: the authored radius scales outline sizes), drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries.

Named features run of 2026-09-12 (this version): the catalogue labels 13 IAU names on the hit mesh (nothing skipped); `tests/objects/unit/surface-features.test.mts` verifies the pinned bytes, the body-frame anchors and the hit-mesh radius band, and a headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page, selected every lens and pinned Urashima from the sidebar search with no console errors or failed requests.

Fine triangle-edge artifacts remain visible in smooth areas, particularly Itokawa elevation. They persisted in a flat-color diagnostic and existing PolyCSS overlap variants; they are a rendering limitation, not source terrain.

The 64-bit JAXA v-band map uses geographic degrees (0.2 degrees/pixel), a 448 m reference sphere and -1 no-data. Its displayed reflectance stretch is 0–0.035. Missing coverage, residual photographed shadows and longitude seams remain visible; the color mosaic is a separately corrected and brightness-matched product.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="ryugu-source-record"></a>
<a id="selected-data-and-survey"></a>
<a id="preparation-and-interpretation"></a>
<a id="reproduction"></a>
<a id="qualification-limits"></a>

<details>
<summary>Methods and source notes</summary>

**Preparation and interpretation**

The source shape uses kilometers, right-handed body-fixed axes and east longitude. The shared preparer converts positions to meters and scales them by the independently sourced 0.448 km radius. Original connectivity is welded at exact position duplicates and simplified by meshoptimizer 1.2.0 before texture and lighting baking. The target is 800 native PolyCSS u triangles with 128 px raster cells and a 16 m library error allowance. A regularized error estimate is not a guaranteed maximum surface deviation. The output has 790 faces; meshoptimizer reports 12.922 m estimated error. Exact coincident, oppositely wound pairs left by collapses are removed (10 faces), then every edge must have two opposite incidents. The result has one connected component and Euler characteristic two.

The shared frame is fixed at 2026-09-03 TT. Horizons osculating elements approximate TDB as TT; these conics are not long-term perturbation models. Rotation follows the pinned mission PCK. Shadows use prepared diffuse lighting in that body frame, not runtime physics. Elevation is radial height above the 448 m sphere, not height above a gravitational equipotential. No geometry or image is synthesized at runtime.

**Reproduction**

Archive members are extracted unmodified from a separately pinned ZIP. Regenerate the checked gzip OBJ with `python tools/objects/acquisition/export-dsk.py src/planets/ryugu/source/shape/ryugu_shape_spc_200k_v20200323.bds src/planets/ryugu/source/shape/ryugu_shape_spc_200k_v20200323.obj.gz` using spiceypy==7.0.0. CSPICE preserves all source vertices and plates.

Elevation atlas colors use the nearest point on the full source triangle surface in three dimensions, with a maximum source-to-display distance of 16 m. The radius, barycentric position and facet normal belong to that same source surface; the height subtracts the stated reference-sphere radius. The distance allowance is enforced per prepared atlas texel, independently of meshoptimizer’s estimated error. Equidistant distinct surfaces or projections beyond the bound are withheld with the shared gray grid. No orientation heuristic substitutes a farther source branch. Raster bleed clamps to its retained triangle edge before projection.

The flat longitude/latitude preview cannot represent more than one source surface on a center ray, so ambiguous sample cells and their interpolation footprints are withheld. The three-dimensional Elevation atlas is baked directly from source-surface correspondence and does not paint this preview onto the body. Cartographic relief uses the matched source facet normal in a local east/north/up frame; optional Sun lighting uses that same normal. Full source connectivity is retained before simplification. Photographic/albedo datasets keep their original mapping and are not recalibrated by this scalar correction.

`node --test tools/objects/terrestrial-layers/source-surface.test.mjs` checks exact pinned-source facet regressions for Itokawa, Ryugu, Eros and Bennu. `python3 tools/objects/terrestrial-layers/verify-source-surface.py ryugu` (NumPy required) independently verifies the fixture against every triangle of the full original source using planar projection plus closest edges. These numerical checks establish scalar correspondence; they do not replace browser visual qualification.

**Qualification limits**

Included: the JAXA ONC v06 corrected v-band map, the controlled global ONC color mosaic associated with Hirata et al. (2026), and the March 2020 SPC shape family used by the new mapping work. The color channels are p/v/ul, not natural color. The author’s more strongly enhanced PNG and nine-band GeoTIFF are retained as source candidates but do not add duplicate views. The 2018 SfM OBJ release was considered; the newer SPC model is chosen for registration. Local landing-site maps, global resolution maps, and geological shapefiles were surveyed and excluded from this global surface package. The numeric v-band map remains distinct from the brightness-matched composite.

- [Mapping release](https://doi.org/10.7910/DVN/WW3IH0)
- [Shape](https://data.darts.isas.jaxa.jp/pub/pds4/data/hyb2/hyb2_spice/spice_kernels/dsk/ryugu_shape_spc_200k_v20200323.bds)
- [Mission facts](https://global.jaxa.jp/projects/sas/hayabusa2/index.html)
- Pole and spin: source/reference/ryugu_v10.tpc

</details>
