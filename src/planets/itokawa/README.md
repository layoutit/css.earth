# Itokawa

## Sources

| View or property | Source and interpretation |
| --- | --- |
| AMICA mosaic | Three v-band observations from 24, 26 and 29 September 2005, with [Gaskell-controlled AMICA records](https://sbn.psi.edu/pds/resource/doi/itokawashape_1.1.html), original FITS and preflight flat. Relative detector brightness, not absolute radiance or albedo. |
| Shape and Elevation | [Gaskell ver128q](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-itokawa.shape-model/data/vertex/ver128q.tab), derived from 775 AMICA images. Elevation is source radius minus 165 m; the original black-rock prime meridian is retained. |

## Evidence

The controlled-camera holdouts reached maximum residuals of 0.00000842/0.00000876/0.00002017 px, testing agreement with archived Cartesian coordinates rather than absolute navigation. Source-mesh checks and independent image/flat/brightness anchors are retained below. Earlier Chrome 152 DPR 1/2 checks covered the then-selected lenses; that record does not establish qualification of the later three-image mosaic.

[Source checks](../../../tests/objects/unit/itokawa/source.test.mjs) define the package tests; this link is not a new test result.

## Known problems

Coverage is partial; the grid marks unavailable terrain. The lossy detector images lack a per-pixel quality plane. Disk normalization is approximate and does not restore stray light, temporal flat changes or shadowed terrain. Residual seams remain. Earlier browser checks found fine triangle-edge artifacts, particularly in Elevation; these are rendering defects, not terrain.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="itokawa-source-record"></a>
<a id="selected-data-and-survey"></a>
<a id="preparation-and-interpretation"></a>
<a id="reproduction"></a>
<a id="qualification-limits"></a>
<a id="amica-spacecraft-mosaic-2026-09-08"></a>

<details>
<summary>Methods and source notes</summary>

**Preparation and interpretation**

The source shape uses kilometers, right-handed body-fixed axes and east longitude. The shared preparer converts positions to meters and scales them by the independently sourced 0.165 km radius. Original connectivity is welded at exact position duplicates and simplified by meshoptimizer 1.2.0 before texture and lighting baking. The target is 800 native PolyCSS u triangles with 128 px raster cells and a 6 m library error allowance. A regularized error estimate is not a guaranteed maximum surface deviation. The output has 794 faces; meshoptimizer reports 4.512 m estimated error. Exact coincident, oppositely wound pairs left by collapses are removed (2 faces), then every edge must have two opposite incidents. The result has one connected component and Euler characteristic two.

The shared frame is fixed at 2026-09-03 TT. Horizons osculating elements approximate TDB as TT; these conics are not long-term perturbation models. Rotation follows the pinned PDS bundle description. Shadows use prepared diffuse lighting in that body frame, not runtime physics. Elevation is radial height above the 165 m sphere, not height above a gravitational equipotential. No geometry or image is synthesized at runtime.

**Reproduction**

Elevation atlas colors use the nearest point on the full source triangle surface in three dimensions, with a maximum source-to-display distance of 6 m. The radius, barycentric position and facet normal belong to that same source surface; the height subtracts the stated reference-sphere radius. The distance allowance is enforced per prepared atlas texel, independently of meshoptimizer’s estimated error. Equidistant distinct surfaces or projections beyond the bound are withheld with the shared gray grid. No orientation heuristic substitutes a farther source branch. Raster bleed clamps to its retained triangle edge before projection.

The flat longitude/latitude preview cannot represent more than one source surface on a center ray, so ambiguous sample cells and their interpolation footprints are withheld. The three-dimensional Elevation atlas is baked directly from source-surface correspondence and does not paint this preview onto the body. Cartographic relief uses the matched source facet normal in a local east/north/up frame; optional Sun lighting uses that same normal. Full source connectivity is retained before simplification. Photographic/albedo datasets keep their original mapping and are not recalibrated by this scalar correction.

`node --test tools/objects/terrestrial-layers/source-surface.test.mjs` checks exact pinned-source facet regressions for Itokawa, Ryugu, Eros and Bennu. `python3 tools/objects/terrestrial-layers/verify-source-surface.py itokawa` (NumPy required) independently verifies the fixture against every triangle of the full original source using planar projection plus closest edges. These numerical checks establish scalar correspondence; they do not replace browser visual qualification.

**Qualification limits**

The navigation context image uses the same three-dimensional source-surface sampler as the Elevation atlas. Its regeneration procedure and byte identities are in [the navigation recipe](source/preparation/navigation.json), [source manifest](source/manifest.json) and [object definition](object.json).

**AMICA spacecraft mosaic (2026-09-08)**

The atlas uses the existing closest-source-point sampler with the existing 6 m display-transfer allowance. All four interpolation contributors must be within 5 m of the same source point; full-source ray tests check camera visibility to 0.05 m. The lowest-emission eligible observation wins, with deterministic ties. Existing overlap matching yields gains 1, 1.006847 and 0.941577. Accepted overlap log-MAD values are below 0.048, and the accepted overlaps connect all three images. Invalid or ambiguous coverage remains the ordinary grid. The source observation-index raster, companion maps and reported sampled area coverage are produced by the existing shared preparer. Geometry remains the existing 794 native PolyCSS raster triangles.

Included: the Gaskell shape derived from 775 Hayabusa AMICA images, using its documented black-rock prime meridian and released connectivity. The Aizu 5.04 shape was also considered; the selected PDS model supplies explicit body-frame and source-image documentation. The package includes a partial, controlled three-image AMICA mosaic and the existing Elevation view. This is not a global photographic/albedo mosaic: the original observations and Gaskell Cartesian backplanes support only the qualified coverage described below. Unobserved terrain remains a grid.

- [Mapping release](https://sbn.psi.edu/pds/resource/doi/itokawashape_1.1.html)
- [Shape](https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-itokawa.shape-model/data/vertex/ver128q.tab)
- [Mission facts](https://science.nasa.gov/solar-system/asteroids/25143-itokawa/)
- Pole and spin: source/reference/bundle_description.txt

Three v-band observations from 24, 26 and 29 September 2005 use the original Gaskell-controlled AMICA DDR Cartesian backplanes, original image FITS companions and preflight v-band flat. Exact URLs, hashes and acquisition operations are in the source manifest. The archived detector frames are lossy 8-bit products with quality flag 0, no binning and paired SUM/near-zero-exposure DIFF images. Per Ishiguro et al. (2010), that onboard pairing removes bias, dark current and frame-transfer smear. Preparation verifies every DDR image sample against the vertically reversed original FITS array, then applies the identically oriented preflight flat and exposure normalization. Zero detector brightness remains eligible; clipped 255 values and defective flat pixels are withheld. No per-pixel detector-quality plane exists in this release.

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 0.888 / 2.345 / 5.937 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

The earlier source notes report Headless Chrome 152 checks of the then-selected lenses with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom.

Each controlled projective camera is fit using every 179th eligible XYZ pixel; all remaining eligible geometry pixels form a disjoint holdout. The three maximum pixel residuals are 0.00000842, 0.00000876 and 0.00002017 pixels. These establish consistency with the archived controlled coordinates, not independent absolute navigation accuracy. A separate every-13th-pixel source-mesh check finds maximum nearest-source distances of 1.07167, 1.30572 and 1.54820 m. The fitted Gaskell camera positions differ from the nominal SPICE-derived summary positions in the detached labels; the product's Cartesian backplanes own registration, as its catalog specifies.

The first usable views were inspected in 192 px source-surface snapshots before the full bake. The original-image / XYZ / flat-field correspondence and an independent Astropy-calculated brightness anchor at DDR pixel (563,498) are retained in the focused tests. That pixel contains DN 137, flat response 1.0011287927627563 and exposure-normalized brightness 1572.937123636729 before disk normalization.

Fine triangle-edge artifacts remain visible in smooth areas, particularly Itokawa elevation. They persisted in a flat-color diagnostic and existing PolyCSS overlap variants; they are a rendering limitation, not source terrain.

The view is relative detector brightness, not calibrated absolute radiance, measured albedo, natural color or a space-weathering abundance map. It does not restore lossy detail, stray light or temporal flat-field changes. A bounded Lommel–Seeliger disk correction follows the AMICA-specific use described by Li, Le Corre and Reddy, LPSC 2018 abstract 1957; it is an approximation, not their fitted Hapke solution. Incidence and emission are limited to 70 degrees and gain to 1.5. Photographed terrain shadows and residual seams remain. Shadows defaults off.

</details>
