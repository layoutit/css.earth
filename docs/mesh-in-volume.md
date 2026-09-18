# A body inside a volume

A proposal. Nothing here is built.

Every object this repository draws is either a **body** — a sphere or a shape model, opaque, with a surface — or a **volume**,
a cloud of emission with no surface. The two never share a scene. A star is a body; a nebula is a volume; an object is one or
the other.

Most evolved stars are both. The photosphere is a body, and the molecular atmosphere and dust shell around it are a volume,
and the first sits inside the second. This proposes the composition that draws them together: **a mesh inside a cube**.

## What exists today

Measured against the code on 18 September 2026, not assumed.

- **The volume frame already places a body.** `DensityVolumeFrame` (`packages/objects/src/density-volume.ts`) carries
  `originM`, the physical position of local `[0, 0, 0]`; `localToReferenceXyzw`, a right-handed orientation into the shared
  frame; `metersPerUnit`; and `boundsUnits` as a minimum and maximum. That is a box in physical space. A body with a known
  position and radius converts into volume units with the numbers already in the contract. **No new coordinate system is
  needed.**
- **The volume draws as axis-aligned stacks of leaves.** `PreparedVolumeStack` (`src/renderers/css/volume/types.ts`) states an
  `axis` of `x`, `y` or `z` and a list of `PreparedVolumeLeaf`, each with its own `centerUnits` and texture. Every slab's
  position inside the cube is therefore already known to the renderer.
- **Nothing is drawn inside a volume today.** The nearest thing is `mountCatalogueStars`
  (`labs/nebula/packages/volume-viewer/src/scene/catalogue-stars.ts`), which projects catalogue points to `{x, y, depth}` and
  draws them in a flat overlay at `z-index: 1`, shown when `depth > 0`. They are drawn *in front of* the volume, not within it.

So the gap is one thing: an opaque body, depth-ordered among the leaves.

## The composition

A body inside a volume is easier than two intersecting volumes, because **the body is opaque and convex**. Nothing behind it
contributes, and everything in front composites over it. There is no blending to resolve, only an order:

1. the leaves behind the body,
2. the body,
3. the leaves in front of it.

The active stack is already sorted along its axis, and each leaf states its `centerUnits`, so the split point is the body's
centre projected onto that axis. This is a list insertion, not a rendering change.

## The one hard part

CSS orders **elements**, not pixels. A leaf whose plane passes through the body is neither behind it nor in front, and drawing
it wholly on one side is wrong across the intersection.

The number of such leaves is not small. A leaf intersects a body of radius `R` when its axial distance from the body's centre
is under `R`, so the count is `2R` over the leaf spacing. For R Doradus — a 60 milliarcsecond photosphere inside an atmosphere
a few hundred milliarcseconds across — a cube sampled at a couple of milliarcseconds per leaf puts **tens of leaves through
the star**. This is the part to measure before building anything else.

**The proposed answer is occlusion baked at preparation, not masking at runtime.** The repository forbids runtime
`clip-path`, CSS masks and filters, and this needs none of them. A leaf at axial distance `d` from the body's centre meets the
body in a circle of radius `sqrt(R^2 - d^2)`; the gas behind an opaque photosphere is not visible anyway, so that circle is
cut from the leaf's texture when the volume is baked. Leaves fully in front of the body keep their texture whole. The
occlusion is then a property of the prepared asset, which is where this repository puts every other derived thing.

The cost is a coupling: the volume bake needs the body's radius and position. Both are known at preparation, and both are
already in the object's own records.

## What to measure first

In this order, because each answer can stop the next.

1. **How many leaves intersect the body**, for a real candidate, at the leaf spacing the bake actually produces. If the answer
   is two or three, per-element ordering alone may be enough and the bake need not change at all.
2. **Whether the artefact is visible** without the bake, at the default camera and while orbiting. The rendered inspection is
   the gate here as everywhere; a number is not a substitute.
3. **Whether a stack swap is stable.** The renderer chooses the axis most face-on to the camera, so orbiting swaps stacks. The
   body's insertion point has to be recomputed per stack, and the swap must not flicker.
4. **What the body does to the volume's own impostors.** `PreparedVolumeImpostors` states a `radiusUnits` and pixel thresholds
   for substituting a projected sprite for the cloud. A body inside the cloud has to survive that substitution or suppress it.

## What would use it

From the archive audits of 17 and 18 September. Beams across are computed from the resolution of the observation that exists,
capped by its maximum recoverable scale, which is what an interferometer actually delivers rather than what its baselines imply.

| Candidate | Structure | Beams across | Data | Filled? |
| --- | --- | ---: | ---: | --- |
| IRC+10216 (CW Leo) | Nested CO shells, 1.5 to 40 arcseconds | ~190–285 | 540 MB, calibrated | Fragmented: partial caps, drawn as arcs |
| AFGL 3068 (LL Peg) | Bifurcated spiral | ~123 | 336 MB, calibrated | Fragmented |
| R Sculptoris | Detached shell at 19.5 arcseconds | ~101 | 17.6 GB | Largely continuous |
| R Doradus | Inner atmosphere, ~0.3 arcseconds | ~20 | 19–56 GB | Compact, with one clump |

R Doradus is the worst ratio of the four and the only one this repository already ships. It is also the only one where the
body and the volume are the same object rather than a cloud that happens to contain a star, which is the case this composition
exists for. The others would each need a new body first.

**None of these is a reason to build the composition before the four measurements above.** A capability with no object through
it is scaffolding.

## What this is not

- **Not a way to show gas inside a star.** The photosphere is opaque; what lies inside the body and behind it is hidden,
  correctly.
- **Not a depth reconstruction.** A spectral cube's third axis is velocity, which is measured. Converting velocity to depth is
  a model, and a separate proposal, and for some emission — masers, where tangential amplification selects the tangent plane —
  it is not falsifiable at all.
- **Not a change to the volume format.** Everything above uses `PreparedVolumeStack` and `DensityVolumeFrame` as they stand.
