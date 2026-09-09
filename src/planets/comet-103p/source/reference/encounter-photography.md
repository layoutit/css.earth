# Encounter photography

These views contain spacecraft photographs, not albedo maps. Calibrated radiance is projected through the archived detector camera onto the original PDS mesh; it is then transferred to the unchanged simplified display mesh. The original acquisition shading is retained. A single bounded gain per image reduces display seams; it is not a physical phase correction. Gray grid regions have no accepted photograph/shape correspondence.

## Detector and surface validity

The reader verifies dimensions, instrument, target, time, filter, units and extension layout. NAVCAM QUALITY_MAP=0 and Deep Impact FLAGS=0 are accepted. The eight-pixel EPOXI/ITS overclock border is excluded separately: a zero quality byte does not make those detector bookkeeping pixels science data. Valid zero and negative radiance are retained. HRI uses MASK=1; RESIDUAL is recorded as a convergence diagnostic, not a new validity mask. Its values are not a license to accept saturated or rejected detector pixels.

Every one of the four bilinear contributors must be valid and intersect the same nearby original-mesh patch. Projection uses the closest source point in three dimensions; it does not assume a unique radial surface. Rays test visibility against the full source mesh. Estimated Wild 2 faces and source-flagged poorly constrained Tempel/Hartley faces are excluded. Source-distance, emission and footprint-separation bounds are in the recipe. Their values do not enlarge or alter the display geometry budget. Valid photographed shadows remain eligible; there is no sunlight-incidence cutoff because radiance is not divided by illumination.

Among qualifying observations, the finest nominal image scale wins, with source order breaking exact ties. This fixed priority avoids fine-scale source switching driven by the coarse mesh's facet normals. Emission and footprint limits still apply independently. No brightness threshold determines coverage or source choice. Overlap fits use positive radiance only because logarithmic ratios require it; that condition does not mask valid dark pixels in the displayed image.

## Registration checks

The JSON beside each photograph contains its body-to-J2000 matrix, a two-component detector pointing correction and the actual fit/holdout coordinates. Preparation reprojects all controls and recomputes residuals; declarations of RMS cannot approve a changed camera. Residual budgets are expressed at the source image scale, separately from the simplified-mesh distance bound. These are registration checks, not a claim of subpixel absolute cartography.

For Tempel and Hartley, 48 angular bins partition the projected limb. An outward normal comes from adjacent background pixels; the boundary is estimated half a pixel beyond the last model pixel center. Three parallel profiles search +/-12 pixels for the outward intensity drop. Measurable controls require an interior peak, positive contrast, positive inside radiance, and outside radiance below one quarter of the inside value. Unmeasurable controls are retained in the excluded list. Even bins fit the two translations; odd bins are withheld. The published orientation is held fixed. No residual-based outlier removal is used. Source-estimated faces are excluded before measurement.

Coverage reports use 32 equal-weight barycentric samples per retained triangle, weighted by triangle area in square metres. They are estimates of displayed surface-area coverage, not counts of atlas pixels or global image completeness. The lossless source-index raster records the chosen input for each atlas texel, including bleed. The report explicitly separates these two measurements.

## Hartley 2 source selection and frame

Included: MRI 6000001, 6000002 and 6000003 around closest approach, and the mission team's 50-iteration Richardson-Lucy restorations of HRI 5004004 and 5004008 from a few minutes earlier. Higher iteration counts were examined; their extra grain does not establish measured fine terrain. The HRI catalog explicitly warns that continued iteration amplifies noise in already-converged smooth regions. The 25-iteration alternative remains a softer source candidate. Several closer HRI frames miss most of the nucleus; stars, jets and ice grains outside the nucleus are not surface texture.

The published 2012 model gives three J2000 axes at 2010-11-04T13:59:47.7. Its rounded directions are orthogonalized once to a proper rotation. Hartley tumbles; the short observation sequence is not a full tumbling reconstruction, and the cartographic long axis is not a spin pole. Only pointing is fitted. Registration is bounded at 20 m RMS / 40 m maximum. The HRI pixel scale of 3.9-4.5 m is detector sampling, not a claim that restoration resolves terrain at that size. Both lenses retain the original acquisition shading and have independent coverage.
