# Bennu source record

## Selected data and survey

Included: the 6.25 cm zero-phase albedo map on OLA v20, the separate 5 cm global PolyCam basemap, and OLA v20 PTM shape. The albedo poles are missing and remain marked; the photographic basemap is independently labeled. NASA SVS explicitly documents spherical mapping to this shape and the basemap/albedo distinction. Excluded: OLA v21 as the primary mesh, to keep the selected albedo’s v20 registration; centimeter-scale sample-site tiles are local products outside this global-body PR. The v20 Poisson model contains small disconnected components; meshoptimizer’s documented Prune flag is used within the authored error allowance.

- Mapping release: https://svs.gsfc.nasa.gov/5069
- Shape: https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005069/g_00880mm_alt_ptm_0000n00000_v020.obj
- Mission facts: https://science.nasa.gov/mission/osiris-rex/
- Pole and spin: source/reference/bennu_v17.tpc

## Spectral composite

The [USGS MapCam release](https://astrogeology.usgs.gov/search/map/bennu-osiris-rex-ocams-photometric-mosaics-25cm)
adds the published false-color composite from [DellaGiustina et al. (2020)](https://figshare.com/articles/journal_contribution/Maps_DellaGiustina_et_al_Science_2020_abc3660/12996494).
It is a separate lens. Red is x/v (847/550 nm), green is w-band strength near
698 nm, and blue is b′/v (473/550 nm), overlaid on v-band normal reflectance.
The authors filtered ratio maps with a 7 × 7 boxcar and removed shadows using
their v-band mask. Preparation does not recalculate ratios or infer minerals.

The release description calls the color product 8-bit, but its actual TIFF and
ISIS label specify four unsigned 16-bit bands. The mapped TIFF has grayscale
photometric tags and unspecified extra bands. An independent strip-byte audit
matches all four bands exactly to the original Figshare RGB TIFF, including its
associated alpha. The original embeds GIMP's sRGB profile. The recipe therefore
reads bands 0/1/2 as sRGB display codes and band 3 as alpha. Only full-alpha,
non-fill samples qualify; partial-alpha boundary pixels are withheld before
resampling. Fully opaque channels are divided by 257 for byte display, with no
new contrast curve. Individual zero channels remain valid; all-channel zero is
source fill. This interpretation is bound in the source audit, not inferred
from how an image looks.

The exact map is 6,284 × 2,268 with a 250 m cartographic radius, 0.25 m pixels,
origin (−785.5, 283.5) m and east-positive, planetocentric longitude. Its cropped
rows cover approximately ±65° and must not be stretched to the poles. Projection
offsets are 3141.5 / 1133.5 in the shared PDS pixel convention. The map's control
and cartographic radius do not replace the independently sized 241 m OLA mesh.
Local boulder alignment to that simplified silhouette remains approximate.

The four individual MapCam albedo bands and scalar ratio FITS products remain
outside this selection: the released composite supplies the intended spectral
view without creating a new palette. Original color bytes and map metadata are
pinned; the legacy albedo and PolyCam views retain their own data and coverage.

## Preparation and interpretation

The source shape uses kilometers, right-handed body-fixed axes and east longitude. The shared preparer converts positions to meters and scales them by the independently sourced 0.241 km radius. Original connectivity is welded at exact position duplicates and simplified by meshoptimizer 1.2.0 before texture and lighting baking. The target is 800 native PolyCSS u triangles with 128px raster cells and a 10 m library error allowance. A regularized error estimate is not a guaranteed maximum surface deviation. The output has 800 faces; meshoptimizer reports 9.372 m estimated error. Exact coincident, oppositely wound pairs left by collapses are removed (0 faces), then every edge must have two opposite incidents. The result has one connected component and Euler characteristic two.

The shared frame is fixed at 2026-09-03 TT. Horizons osculating elements approximate TDB as TT; these conics are not long-term perturbation models. Rotation follows the pinned mission PCK. Shadows use prepared diffuse lighting in that body frame, not runtime physics. Elevation is radial height above the 241 m sphere, not height above a gravitational equipotential. No geometry or image is synthesized at runtime.

## Reproduction

Restore source pins with `node tools/objects/dist/operations.js acquire bennu`, then prepare with `node tools/objects/dist/prepare-authored.js bennu --write`. Build the preparation tools first with `pnpm build:preparation`. Runtime installation is separate: `pnpm setup:assets --object=bennu` consumes runtime-assets.json.

The albedo view covers approximately 55 degrees south to 55 degrees north and marks missing poles. Its publisher stretch maps 0.002–0.007 albedo to codes 1–254. The monochrome basemap uses different phase normalization (Minnaert at 30 degrees) and source control (SPC v28), so it remains a separate view rather than filling the albedo gaps. Spherical mapping cannot register individual boulders perfectly to the simplified OLA silhouette.

Elevation atlas colors use the nearest point on the full source triangle surface in three dimensions, with a maximum source-to-display distance of 10 m. The radius, barycentric position and facet normal belong to that same source surface; the height subtracts the stated reference-sphere radius. The distance allowance is enforced per prepared atlas texel, independently of meshoptimizer’s estimated error. Equidistant distinct surfaces or projections beyond the bound are withheld with the shared gray grid. No orientation heuristic substitutes a farther source branch. Raster bleed clamps to its retained triangle edge before projection.

The flat longitude/latitude preview cannot represent more than one source surface on a center ray, so ambiguous sample cells and their interpolation footprints are withheld. The three-dimensional Elevation atlas is baked directly from source-surface correspondence and does not paint this preview onto the body. Cartographic relief uses the matched source facet normal in a local east/north/up frame; optional Sun lighting uses that same normal. Full source connectivity is retained before simplification. Photographic/albedo datasets keep their original mapping and are not recalibrated by this scalar correction.

`node --test tools/objects/terrestrial-layers/source-surface.test.mjs` checks exact pinned-source facet regressions for Itokawa, Ryugu, Eros and Bennu. `python3 tools/objects/terrestrial-layers/verify-source-surface.py bennu` (NumPy required) independently verifies the fixture against every triangle of the full original source using planar projection plus closest edges. These numerical checks establish scalar correspondence; they do not replace browser visual qualification.

## Qualification limits

An independent check used trimesh 4.8.3 closest_point_naive to measure 3,200 equal-area radial samples from the full source against every simplified triangle. Mean / 95th percentile / sampled maximum nearest-surface distances were 1.468 / 3.965 / 10.120 m. This is a one-direction sample, not an exhaustive Hausdorff bound. Radial distance alone is misleading near undercuts because the nearest ray intersection can switch surfaces.

Headless Chrome 152 visual checks covered every lens with Shadows off and on at DPR 1 and 2, plus opposite/polar poses and close zoom. Fine triangle-edge artifacts remain visible in smooth areas, particularly Itokawa elevation. They persisted in a flat-color diagnostic and existing PolyCSS overlap variants; they are a rendering limitation, not source terrain.
