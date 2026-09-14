# Surface places and label discovery

Use this when changing landmarks, their source frame or their discovery behavior.
For a body-only content change, check that body's affected places. Changes to
shared label discovery need representative sparse asteroid, comet and small-moon
checks; unrelated imagery or prose changes do not.

Surface places belong to a source frame. Use `source/preparation/features.json`
and its pinned `landmarks` document for mission-defined regions, paper coordinates,
or explicitly inferred model anatomy. Keep mission names distinct from IAU names.
Derive region anchors from the released map and check them against the unchanged
display mesh; a label point does not establish a region centre, size or boundary.
For alternative meshes, select the matching prepared `surfaceHit.lensRanges`
entry and expose those places only on that dataset. A shared body name does not
make coordinates transferable between models. Keep approximate placement visible
in the caption. Unresolved photograph-to-shape registration cannot establish a
terrain landmark; neither can a camera direction alone.

For a body explicitly prepared as a reference sphere, published geographic
landmarks can use that sphere without a triangle hit mesh. This exception does
not apply to missing irregular-body meshes or Cartesian model coordinates.

Check label discovery with no place selected: selection bypasses the zoom gate.
Inspect whole-body framing, a closer view and rotation on the affected bodies.
Physical size alone does not require a separate label rule: the shared camera
expresses zoom relative to the body. The shared feature preparer gives sparse
catalogues a count floor of 200 when assigning discovery tiers, so two names are
not stretched from minimum to maximum zoom. Explicit mission-landmark tiers
remain authored choices; broad regions should appear while the whole body is
still visible. Keep the existing screen-size, limb, overlap and label-cap checks,
and verify the smallest named features still need enough screen space. Do not
use a successful search-and-fly-to as proof that places can be discovered by
looking at the body.
