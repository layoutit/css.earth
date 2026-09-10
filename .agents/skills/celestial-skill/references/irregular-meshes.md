# Preparing irregular meshes

Use this guidance for a new textured triangle-mesh presentation, source-shape
repair or face-budget reduction. Keep already-qualified unrelated body paths
intact. Implementation owners are in the [implementation map](implementation-map.md).

## Choose a shape the recipe can represent

Bind units, axes, body frame, longitude convention and scale to the shape source.
A radial model supplies one surface radius per direction from its origin. Check
that this represents the relevant shape; it cannot preserve multiple boundary
intersections along one ray. A source OBJ routed through a radial sampler is
still resampled radial geometry. For undercuts or other features that need full
mesh connectivity, inspect the current shared recipe's actual support and extend
that capability only if needed. Do not silently substitute an ellipsoid or fill
missing source radii.

## Simplify before baking

For a reduction, use the existing meshoptimizer preparation path rather than a
new simplifier. Start from adequate source detail; simply reducing latitude and
longitude counts retains the grid's uneven face density, especially near poles.
Inspect redundancy and source-fit error instead of assuming every face is useful.

The radial recipe samples the pinned source, canonicalizes poles, welds repeated
positions with `generatePositionRemap`, and physically compacts the indexed mesh
with `compactMesh` before `MeshoptSimplifier.simplify`. Reuse that owner. Its
position-only weld is appropriate before Vesta's UV baking; for an already
textured mesh, preserve meaningful UV/material/normal boundaries when selecting
a simplification path.

Set a target face count and a source-unit error allowance in authored data. The
current recipe converts meters to scene units and records the library version,
flags, source/output counts and estimated error. Its `ErrorAbsolute` and optional
`RegularizeLight` settings are selectable implementation choices. A regularized
library error estimate is not a guaranteed maximum surface deviation; do not
silently relax the requested budget or error setting when the target is missed.

Check for degeneracy, consistent winding and the expected topology. The radial
helper requires two oppositely directed incidents per edge and Euler
characteristic two for its closed genus-zero surface; that is not a universal
topology rule for all source meshes. A face normal's dot product with its position
alone is not a general winding test on an irregular surface.

Compare the simplified mesh with independent source anchors and representative
surface samples, and inspect limbs and distinctive features at matched framing.
The existing ray-intersection helper supports radius-error checks for radial
models. Report mean, tail and maximum sampled error with the sampling method;
keep sampled error distinct from an exhaustive bound or source measurement
accuracy. Prove surface hits, background misses and extremities against the
rendered shape; smooth trackball rotation does not prove shape-aware targeting.

## Keep native raster triangles and prepared lighting

Use the shared PolyCSS native `u` triangle path with raster sizing for this
presentation. Vesta explicitly selects `primitive: "u"`; leaving it unset selects
the older rectangular path in that revision. Reuse `computeSolidTrianglePlan`
through the existing preparer, including its native coverage and seam overlap.
Keep planner overlap in the correct coordinate units. The leaf dimensions match
the prepared raster cell, while the inverse basis scaling preserves the intended
geometry. Verify the emitted DOM and transformed triangle footprint, not only
the authored primitive flag. Do not invent replacement triangle or lighting
techniques when this shared path supplies the capability.

After finalizing geometry, recompute the appropriate shared normals and bake
texture sampling and lighting into the triangle atlases through the existing
material preparer. Interpolated normals preserve smooth lighting without adding
geometry. Inspect native coverage and texels across shared edges at close zoom.
Preserve source texture detail while reducing faces; fewer faces do not by
themselves require lower-resolution source maps.

Inspect each lens with its supported lighting states. Keep the light attached to
the source body frame during camera rotation and document fixed-epoch or diffuse
approximations. Reuse unchanged normalized maps only after checking their pins;
regenerate geometry-dependent atlases, lighting, targeting data and companion
images through their existing owners. Runtime consumes those prepared assets.

Finish with the [matched visual and drag checks](qualification.md#measure-mesh-changes).
Vesta at `1979293e` reached 800 faces from 16,128 source-sampled triangles using
meshoptimizer 1.2.0, retaining 128px raster cells. Those are measured choices for
that source and workload, not defaults for every irregular body.
