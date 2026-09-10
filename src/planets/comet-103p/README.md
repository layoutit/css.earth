# 103P/Hartley 2

## Sources

- The original [Farnham & Thomas (2013) PDS dataset](https://pdssbn.astro.umd.edu/holdings/dif-c-hriv_mri-5-hartley2-shape-v1.0/dataset.shtml) supplies 16,022 planetocentric vertices and 32,040 zero-indexed triangles.

- The EPOXI mosaic combines three MRI images and two mission-restored HRI images from the short 4 November 2010 encounter sequence.

## Evidence

- The [constraint-grid qualification](../../../docs/comets/CONSTRAINT-GRIDS.md) records checks and captured views.

- The [shared qualification record](../../../docs/comets/QUALIFICATION.md) records verification.

## Known problems

- The default Source constraints lens uses solid gray for stereo control, blue for limb silhouettes, and the shared gray grid for poorly constrained regions. The grid means poorly constrained by those methods, not necessarily wholly unobserved. Neither view claims observed albedo.

- Coverage is about 56% of the displayed surface; the remaining grid has no accepted photograph/shape correspondence. Original shadows and restoration grain remain.

- The cartographic north direction follows the long axis at the 2010 encounter, not a spin pole. Hartley 2 tumbles; this display holds an arbitrary rotational phase and does not simulate that motion.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="103phartley-2-source-and-interpretation"></a>

Kilometres convert to metres; east-positive longitude and north-positive latitude define the released right-handed frame. Original table, label and catalogue bytes are pinned in source/manifest.json.

103P/Hartley 2 is the elongated, two-lobed comet visited by EPOXI in 2010. 244 stereo control points on about half the nucleus.

All published geometry is retained before simplification. Flag 1 means stereo control (7431 vertices), flag 2 limb silhouette (4745), and flag 3 not well constrained (3846). Flag counts are vertex counts, not surface-area percentages. Weak regions are the original authors' estimates, not additional cssEarth terrain. The Shape model view uses the same grid for flag 3 and neutral gray for flags 1 and 2. Nearest 2-degree grid sampling prepares the categorical map; raster filtering softens visual category boundaries and is not a quantitative uncertainty interpolation.

The published equivalent-volume radius 0.58 km supplies scale only; it does not replace the mesh. No measured mass or GM is claimed (the astronomy registry uses its existing zero-for-unknown convention). JPL Horizons elements at JD 2461286.5 supply heliocentric placement; the conic omits perturbations and outgassing. Lighting uses that common epoch and the declared display orientation, not a reconstruction of encounter photographs. No dust, tails, jets or tumble simulation is included.

Meshoptimizer retains original source vertices and closed, consistently wound connectivity, reduced to 1000 triangles. Estimated simplification error 6.463547706604004 m is neither a measurement uncertainty nor a Hausdorff bound. Original-mesh normals and cast shadows are baked into fixed atlases; no geometry, maps or illumination are computed at runtime.

The source grid is selected by categorical flags before raster filtering and lighting. Both atlases per lens, their thumbnails, the constraint minimap, and the model-view context image/navigation marker use the same preparation. Geometry, native triangle leaves, camera and lighting recipes are unchanged.

The finest accepted detector sampling supplies each patch; MRI fills regions outside the HRI footprints. The same source-mesh, registration and visibility limits apply to all five images. See [the photographic source record](source/reference/encounter-photography.md).

</details>
