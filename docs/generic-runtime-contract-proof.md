# Generic runtime contract proof

All eleven existing objects now bind the same prepared runtime. Their packages
supply literal scene records, material addresses, selection variants and control
content. One shared implementation builds scenes, publishes materials, resolves
demand, owns the camera and manages selection, resources, playback and disposal.
No new object was introduced as proof.

**Architectural ownership is demonstrated on the recorded qualification source.
Full visual equivalence and merge readiness are not established.** The final
integration includes later zoom, sky-input, panel and legend changes. The full
suite was not repeated after that integration at the user's request.

## Evidence boundary

The implementation commit is `cf45c49540d581c63f618de35dcf6824038d274b`.
Its 1,217-file application source manifest hashes to
`e8e38941baa22d9e12d27b2f90cec38aabf15e554efc602e31a34745c6deefdb`.
That final source has not had another aggregate run.

The completed native run used source
`534c4e9d1811bc7bb5cda2c16cdcc8bd40dd4f2bf82ab7ecf5154673ca0a4e2d`
in real Chrome 152.0.7977.76 at DPR 1 and 2. It observed one actual camera per full
session and the common publisher for every declared material target. Static
closure checks separately followed the real registry loaders and rejected private
owners, executable prepared records, extra cameras and shared object-ID dispatch.

The [machine-readable record](prepared-presentation-evidence.json) identifies the
source, report hashes, preparation timings, comparison counts and delivery limits.
Raw captures and failed runs remain in the local evidence directory
`output/presentation-generalization/260905-001/`. A later successful diagnostic
never overwrites an earlier failed result.

| Check | Recorded result | Limit |
| --- | --- | --- |
| Strict ownership and prepared-presentation audits | All 11 objects passed; 41 negative/closure regression tests passed | Recorded source, not a rerun of the final integration. |
| Native ownership | 22/22 cases passed | One camera and common native writers at both DPRs. |
| Shared browser conformance | 143/143 cases passed | Recorded source. |
| Native playback | 22/22 cases passed | Recorded source. |
| Unit aggregate plus remaining-package diagnostics | 1,093/1,095 passed | Two obsolete preparation-command assertions failed. Their corrected focused batch passed; no claim of a green full aggregate. |
| Compound selection and failure handling | Corrected harness passed 6/6 at DPR 1/2 | The original aggregate stopped on its obsolete Saturn dual-selection assertion. BFCache and package smoke were not reached. |
| Production build | Passed at source `534c4e9d`; 2,558 files, 912,160,492 bytes | Final panel/control integration was not rebuilt. |
| All-object production payload capture | 44 measurements completed with no errors | Earlier production sources; does not establish final frame-time budgets. |

## Actual differences between adapters

This table comes from the actual prepared definitions joined with observed native
owners. Node counts cover prepared scene nodes, not the complete application DOM.
All objects use exclusive lens selection and the same accumulated-matrix camera
implementation.

| Object | Prepared nodes | Lenses | Variants | Material transport | Additional prepared content |
| --- | ---: | ---: | ---: | --- | --- |
| Sun | 1,034 | 4 | 4 | Static selection writes | Coupled surface, limb and corona textures. |
| Mercury | 1,804 | 4 | 8 | Angle rotation; one lighting bank | Interior pose animation and symmetric row prewarming. |
| Venus | 904 | 3 | 24 | Angle rotation; one composite bank | Phase remap, atmosphere and stars settings. |
| Earth | 2,012 | 5 | 20 | Planar rotation; separate lighting and atmosphere banks | Two paged map layers, bounded page pools and destinations. |
| Moon | 921 | 3 | 3 | Static selection writes | Surface and pole texture banks. |
| Mars | 1,037 | 3 | 6 | Angle rotation; one composite bank | Two directional ranges, both containing atmosphere. |
| Jupiter | 1,565 | 3 | 12 | Planar rotation; one lighting bank | Directional row prewarming, rings and moons. |
| Saturn | 1,908 | 5 | 20 | Shared ellipsoid projection; 16 exterior and 4 interior banks | Prepared ring/shadow geometry and exclusive cross-section. |
| Uranus | 2,128 | 3 | 12 | Planar rotation; three lighting banks | Three-row neighborhoods protected by six slots. |
| Neptune | 1,454 | 3 | 12 | Planar rotation; three lighting banks | View-sensitive row demand and static-variant transition slots. |
| Pluto | 921 | 3 | 3 | Static selection writes | Surface and pole texture banks. |

Radii, frame counts, addresses, fallback rules, resource capacities, labels and
optional map records differ as data. They do not select private implementations.
The [architecture inventory](shared-runtime-architecture-proposal.md#remaining-adapter-differences-are-data)
describes those parameters in more detail.

Saturn's cross-section uses the common single-lens reducer. Selecting it replaces
an exterior lens; selecting an exterior lens exits it; clicking it again keeps it
selected. Rings and Shadows remain settings. The shared ellipsoid helper matches
96 independent native camera/roll transforms and 900 analytic support cases.
Those checks do not substitute for full-scene pixel qualification.

## Preparation is part of the refactor

`pnpm prepare:planets` uses one bounded registry-derived scheduler and verifies
input, toolchain and output hashes before reusing an object. A failed producer
cannot seal a receipt. Shared dependency changes invalidate reuse. Saturn prepares
its normal material masters once; the composition phase verifies and consumes them.
`pnpm prepare:planets:full` explicitly bypasses reuse.

| Measured command | Wall time | Result |
| --- | --- | --- |
| Previous serial preparation | 44m39s | Reference run. |
| Optimized forced run 1 | 18m24s | All 11 objects regenerated. |
| Optimized forced run 2 | 19m28s | All 3,498 source/output/receipt files identical to run 1. |
| Unchanged ordinary preparation | 44s | 11 verified cache hits; zero objects rebuilt. |

All 2,531 accepted image encodings were preserved in those forced runs. Earth's
25.4 GB pinned geometry input accounted for about 38 seconds of the unchanged
run. These are measurements on this host before the later panel/control
integration; they are not timing promises for another machine or source revision.

The incoming lens legends are also prepared offline. Editable per-object content
recipes feed one compiler, and runtime imports literal control data. The compiler
runs before presentation preparation. The new Mercury legend retains its pinned
USGS source and the incoming 2,072-byte prepared raster.

## Visual and performance limits

Completed comparisons retain strict failures. Sun and Pluto's compared frames are
pixel-exact, but their reference repeatability failures still prevent an overall
strict pass. Other objects contain differences that require qualification; Venus's
isolated empty-style correction is proven, while its final whole-source receipt
remains unsealed after the later input and panel changes.

A bounded Earth experiment established paint-history dependence for one rotated
case: repainting the unchanged reference reproduced every original candidate
value at all 31,939 changed pixels in each of its six phases. Computed styles,
bounding rectangles and all 917 compositor layer identities stayed unchanged;
only paint counts changed. This explains that difference set. It does not establish
whole-frame parity or explain differences in other cases or objects.

Saturn's first desktop DPR 2 scene readback visibly lacks sections of the back
rings: 213,328 pixels differ, with a maximum channel difference of 241. The next
five readbacks match. That first-frame failure remains unexplained and prevents a
claim that the rendered result is fully qualified.

No masks, relaxed tolerances or favorable-frame selection were used. Strict
failures remain failures. The exact comparison counts and residual qualifications
are recorded in the machine-readable evidence and retained diagnostic receipts.

Final production performance workloads and the complete aggregate on the combined
integration were not run. Earlier baseline budget failures remain disclosed in the
existing evidence. The PR stays open and unmerged; this document makes no final
pixel-parity, frame-budget or merge-readiness claim.
