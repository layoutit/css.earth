# Eros source record

## Selected data and survey

Included: the 2023 USGS/Golish deblurred, zero-phase 550 nm albedo mosaic and the matching Gaskell Eros shape family. The 128q shape has 196,608 released facets before simplification. The archive also supplies six other spectral filters and a sinusoidal projection; these are retained in the archive but excluded as redundant or requiring a separately justified spectral composite. Older NEAR MSI basemaps and NLR plate models were considered; the newer corrected mosaic and its registered shape take precedence.

- Mapping release: https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics
- Shape: https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-eros.shape-model/data/vertex/ver128q.tab
- Mission facts: https://science.nasa.gov/solar-system/asteroids/433-eros/
- Pole and spin: source/reference/eros_alex.tpc.txt

## Preparation and interpretation

The source shape uses kilometers, right-handed body-fixed axes and east longitude. The shared preparer converts positions to meters and scales them by the independently sourced 8.42 km radius. Original connectivity is welded at exact position duplicates and simplified by meshoptimizer 1.2.0 before texture and lighting baking. The target is 800 native PolyCSS u triangles with 128px raster cells and a 300 m library error allowance. A regularized error estimate is not a guaranteed maximum surface deviation. The output has 796 faces; meshoptimizer reports 238.584 m estimated error. Exact coincident, oppositely wound pairs left by collapses are removed (4 faces), then every edge must have two opposite incidents. The result has one connected component and Euler characteristic two.

The shared frame is fixed at 2026-09-03 TT. Horizons osculating elements approximate TDB as TT; these conics are not long-term perturbation models. Rotation follows the pinned mission PCK. Shadows use prepared diffuse lighting in that body frame, not runtime physics. Elevation is radial height above the 8420 m sphere, not height above a gravitational equipotential. No geometry or image is synthesized at runtime.

## Reproduction

Restore source pins with `node tools/objects/dist/operations.js acquire eros`, then prepare with `node tools/objects/dist/prepare-authored.js eros --write`. Build the preparation tools first with `pnpm build:preparation`. Archive members are extracted unmodified from a separately pinned ZIP. Runtime installation is separate: `pnpm setup:assets --object=eros` consumes runtime-assets.json.

The 550 nm GeoTIFF is equirectangular with center longitude 180 degrees, 10 m pixels and a 17 km projection radius. The archived detached label contains an inconsistent sinusoidal pointer; preparation verifies the actual GeoTIFF georeferencing. The display stretch is 0.05–0.40.

Elevation atlas colors use the nearest point on the full source triangle surface in three dimensions, with a maximum source-to-display distance of 300 m. The radius, barycentric position and facet normal belong to that same source surface; the height subtracts the stated reference-sphere radius. The distance allowance is enforced per prepared atlas texel, independently of meshoptimizer’s estimated error. Equidistant distinct surfaces or projections beyond the bound are withheld with the shared gray grid. No orientation heuristic substitutes a farther source branch. Raster bleed clamps to its retained triangle edge before projection.

The flat longitude/latitude preview cannot represent more than one source surface on a center ray, so ambiguous sample cells and their interpolation footprints are withheld. The three-dimensional Elevation atlas is baked directly from source-surface correspondence and does not paint this preview onto the body. Cartographic relief uses the matched source facet normal in a local east/north/up frame; optional Sun lighting uses that same normal. Full source connectivity is retained before simplification. Photographic/albedo datasets keep their original mapping and are not recalibrated by this scalar correction.

`node --test tools/objects/terrestrial-layers/source-surface.test.mjs` checks exact pinned-source facet regressions for Itokawa, Ryugu, Eros and Bennu. `python3 tools/objects/terrestrial-layers/verify-source-surface.py eros` (NumPy required) independently verifies the fixture against every triangle of the full original source using planar projection plus closest edges. These numerical checks establish scalar correspondence; they do not replace browser visual qualification.

## Qualification limits

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 52.033 / 132.260 / 275.739 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

Headless Chrome 152 visual checks covered every lens with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom. Fine triangle-edge artifacts remain visible in smooth areas, particularly Itokawa elevation. They persisted in a flat-color diagnostic and existing PolyCSS overlap variants; they are a rendering limitation, not source terrain.
