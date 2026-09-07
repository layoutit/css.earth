# Itokawa source record

## Selected data and survey

Included: the Gaskell shape derived from 775 Hayabusa AMICA images, using its documented black-rock prime meridian and released connectivity. The Aizu 5.04 shape was also considered; the selected PDS model supplies explicit body-frame and source-image documentation. Unresolved: a calibrated, registered global photographic/albedo mosaic. DARTS AMICA images and geometry and the Gaskell landmark-map literature were surveyed; individual images are not a ready global surface map. This package therefore presents measured elevation only. It does not claim unresolved terrain or a synthetic image to be an observation.

- Mapping release: https://sbn.psi.edu/pds/resource/doi/itokawashape_1.1.html
- Shape: https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-itokawa.shape-model/data/vertex/ver128q.tab
- Mission facts: https://science.nasa.gov/solar-system/asteroids/25143-itokawa/
- Pole and spin: source/reference/bundle_description.txt

## Preparation and interpretation

The source shape uses kilometers, right-handed body-fixed axes and east longitude. The shared preparer converts positions to meters and scales them by the independently sourced 0.165 km radius. Original connectivity is welded at exact position duplicates and simplified by meshoptimizer 1.2.0 before texture and lighting baking. The target is 800 native PolyCSS u triangles with 128px raster cells and a 6 m library error allowance. A regularized error estimate is not a guaranteed maximum surface deviation. The output has 794 faces; meshoptimizer reports 4.512 m estimated error. Exact coincident, oppositely wound pairs left by collapses are removed (2 faces), then every edge must have two opposite incidents. The result has one connected component and Euler characteristic two.

The shared frame is fixed at 2026-09-04 TT. Horizons osculating elements approximate TDB as TT; these conics are not long-term perturbation models. Rotation follows the pinned PDS bundle description. Shadows uses prepared diffuse lighting in that body frame, not runtime physics. Elevation is radial height above the 165 m sphere, not height above a gravitational equipotential. No geometry or image is synthesized at runtime.

## Reproduction

Restore source pins with `node tools/objects/dist/operations.js acquire itokawa`, then prepare with `node tools/objects/dist/prepare-authored.js itokawa --write`. Build the preparation tools first with `pnpm build:preparation`. Runtime installation is separate: `pnpm setup:assets --object=itokawa` consumes runtime-assets.json.

Elevation colors use the nearest positive radial intersection of the full source mesh, sampled into a bounded geographic grid. That scalar map cannot describe multiple surfaces on one ray; display geometry retains the released connectivity before simplification.

## Qualification limits

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 0.888 / 2.345 / 5.937 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

Headless Chrome 152 visual checks covered every lens with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom. Fine triangle-edge artifacts remain visible in smooth areas, particularly Itokawa elevation. They persisted in a flat-color diagnostic and existing PolyCSS overlap variants; they are a rendering limitation, not source terrain.
