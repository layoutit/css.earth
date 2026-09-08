# General prepared visibility ordering

PR #27 remains a draft; the operator owns the merge. The matched browser measurements below describe the 90-body snapshot based on 15227a0e. They are not benchmarks of the later registry.

## Current main integration

Main `1a5c996862115e1a2947052c3973ae279b59e2f1` has 155 bodies and 123 triangle surface contracts. Preparation accepts 85 surfaces; 27 have every group within the 64-face packing target. The independent oracle checks 427,632 rays, including 8,932 with multiple front-facing hits, without an order disagreement. Thirty-eight triangle contracts fail the source-face/rendered-leaf correspondence gate and retain native depth. The other 32 bodies have different presentation contracts and are unchanged by this compiler.

The [registry coverage report](prepared-depth-coverage.json) records each result, original face count, emitted group sizes, added wrapper count and final payload hash. Every checked runtime was compared deeply against the complete transported data, and all 155 payloads matched their descriptor hashes. Restoring each accepted source branch recovers its entire original definition, including geometry and assets.

Integration preserves main's asteroid orbit controls and epoch-correct physical frames. Epoch refresh first restores the canonical preparation branch, updates its original physical carrier, then allows the shared compiler to regenerate projection groups. It does not update duplicate carriers independently or add a runtime epoch repair.

## Architecture

Preparation builds a fixed face-priority graph using source triangles oriented by their actual CSS facing planes. Potential occlusion requires both face-plane relations; robust orientation predicates preserve tiny separations without an arbitrary epsilon. Strongly connected components retain native 3D sorting. The acyclic component order is packed into groups of up to 64 faces; larger inseparable components remain intact. Existing source-edge plane splits compose with these priorities. No face, texture or source geometry is added, cut or removed. Runtime interprets the prepared order and shares the existing camera transform; fixed priorities are published once.

This follows the fixed face-priority and cluster approach described in [Sutherland, Sproull and Schumacker (1974)](https://doi.org/10.1145/356625.356626). The application combines that approach with its existing source-edge partitioner. The robust predicate dependency is preparation-only.

## Earlier 90-body coverage and constraints

The registry audit found 37 compilable surfaces, of which 24 have every group at or below 64 faces. Previously only Deimos, Phobos and Phoebe qualified. The other accepted surfaces preserve irreducible native cores; 64 is a packing target, not a universal bound. Eligibility comes from the source geometry, rendered facing, CSS cascade and binding ownership; there is no body allowlist.

The independent ray oracle checked 162,672 rays including 4,835 rays with multiple front-facing hits, without a visibility-order disagreement. This is mathematical geometry evidence, separate from browser raster equivalence. Original source restoration, full variant/LOD CSS cascade equality, shared camera and retained input ownership remain required.

Haumea is **not improved** by this path. Its ring and camera-facing lighting share scene depth with its projective surface. A direct rendered-tile experiment also found no useful fixed decomposition for Makemake. Neither experiment is enabled. Preserving these layer interactions remains necessary before changing their presentation. Several triangle packages also fail the existing source-face/rendered-leaf correspondence check and retain native depth.

## Native browser evidence

Chrome Canary 155.0.8043.0, Apple M3 Max, ANGLE Metal, headless, DPR 2, 1995 x 1236 CSS pixels. The four before/after drag pairs ran sequentially with no preparation or other agent-owned browser capture running. Each used 180 native moves over approximately three seconds. All retained the same scene, world, input and face nodes, with no application or HTTP errors.

Loaded candidate runtime SHA-256: `14cefd9866dcb1426e952eed85acd8874ca7bea95d0db965ae3ce457d7369178`. Per-object payload hashes and input times are in the capture reports under `output/depth-prototype/general-depth/perf-*`. The later publish-once refinement is not included in these measured bytes and requires final-build verification.

| Body | Draw-pass p95 before / after (ms) | Mixed reports before / after | Added retained wrappers |
| --- | ---: | ---: | ---: |
| anthe | 6.090 / 2.970 | 0 / 0 | 32 |
| bennu | 12.411 / 6.722 | 178 / 0 | 16 |
| itokawa | 11.288 / 10.337 | 178 / 0 | 12 |
| vesta | 14.416 / 10.293 | 180 / 182 | 20 |

All eight runs reported zero dropped-only sequences. Mixed reports remain at 182/184 in Vesta's candidate despite lower draw cost; this is not a claim of perfect full-frame delivery. Frame-stage durations are not physical FPS or input-to-photon measurements.

Twenty-four paired views cover close geometry, drag, the actual available dataset, marker LOD, return and resize. Each pair reloads the exact same serialized camera, asserts deep camera equality, identifies both loaded payloads and checks the same source-face count. The Anthe model has only one dataset; that case is recorded rather than pretending it changes lenses.

Pixel equality is **not exact**: worst mean absolute channel delta is 0.125732/255, with 2.2753% changed pixels, at the enlarged Bennu resize view. Baseline repeats have worst mean 0.000009/255. Inspected full frames and difference images localize changes to thin facet and silhouette boundaries, with no broad missing or substituted texture regions. The zero-tolerance comparison remains marked failed; it has not been relabeled a pixel-equivalence pass.

## Reproduction

- `node tools/audit-prepared-depth.mjs output/depth-audit.json` inspects the live registry with a preparation-only graph and independent ray oracle.
- `site/test/prepared-depth-browser.mjs` captures native close-surface drags and loaded response hashes.
- `site/test/prepared-depth-visual-browser.mjs` compares both builds using each body's actual controls and prepared payload.

Focused compiler, visibility, ownership and typed validation tests are required alongside native evidence. A complete source/render closure and final-main browser pass must precede claiming the integrated build qualified.
