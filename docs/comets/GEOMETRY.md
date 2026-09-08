# Source-mesh comparison

The 1,000-face nuclei of 67P, Hartley 2 and Tempel 1 preserve released vertex positions and closed, outward-wound topology. Unit tests also check source bounds, source constraint flags, a non-radial neck on 67P, and volume retention (within 1% for 67P and 2% for the two PDS models). Wild 2 is a 996-face open surface: all 348 boundary edges and eight edge-connected patches of the observed-only release remain. Two source faces are reversed to make shared-edge winding consistent. No vertex is moved and no unseen hemisphere is supplied.

The following comparison measures Euclidean distance to the closest triangle on the other mesh. Source-to-prepared samples include every original vertex and face centroid. Prepared-to-source samples include every prepared face centroid and its three edge midpoints. The statistics are unweighted by face area, and finite sampling is **not an exhaustive Hausdorff bound** or the uncertainty of the source observations. Each report binds the source and prepared geometry hashes.

| Comet | Direction | Samples | Mean, m | p95, m | Maximum sampled, m |
| --- | --- | --- | --- | --- | --- |
| 103p | Source → prepared | 48,062 | 1.99 | 4.95 | 10.46 |
| 103p | Prepared → source | 4,000 | 2.02 | 5.15 | 10.64 |
| 9p | Source → prepared | 48,062 | 7.44 | 19.34 | 38.90 |
| 9p | Prepared → source | 4,000 | 8.55 | 21.78 | 38.18 |
| 67p | Source → prepared | 156,290 | 11.69 | 30.85 | 81.35 |
| 67p | Prepared → source | 4,000 | 13.53 | 36.39 | 80.84 |
| 81p | Source → prepared | 18,946 | 11.74 | 31.17 | 139.84 |
| 81p | Prepared → source | 3,984 | 10.96 | 30.96 | 81.08 |

These measured distances are distinct from meshoptimizer's error estimates. In particular, 67P's maximum sampled distance is about 81 m, despite the simplifier's roughly 49 m estimate. The PoC does not claim a 50 m maximum physical error.

A second comparison casts 55,296 matched orthographic rays per comet from six ±X/±Y/±Z views. Each view uses a 96 × 96 pixel-centered grid over the source bounds with 4% padding. Reports retain both hit/miss disagreements and differences in the first-intersection depth. Some rays switch which part of the nucleus is foremost near silhouettes or overlapping terrain. The largest range jumps are 1.06 km (Hartley 2), 1.70 km (Tempel 1), and 2.78 km (67P); the two hit points on those particular rays are each within 12 m of the other mesh's surface. These are view-dependent occlusion changes, not kilometer-scale nearest-surface errors. They remain visible in the reports.

The source-only/reduced-only hit counts, out of 55,296 rays, are 162/44 for Hartley 2, 156/18 for Tempel 1, and 236/238 for 67P. This qualification accepts a simplified model for inspection; it does not promise identical silhouettes at every pixel or zoom.

Reports are [67P](evidence/67p-source-fit.json), [Hartley 2](evidence/103p-source-fit.json), and [Tempel 1](evidence/9p-source-fit.json). Reproduce with:

```sh
node --test tests/objects/unit/comet-67p/surface-distance.test.mjs
node tests/objects/browser/comets/source-fit.mjs
```

This source-geometry comparison is separate from browser/photograph visual parity. No matched spacecraft-camera reconstruction is claimed.

## Wild 2 geometry and drag tradeoff

The [Wild 2 source-fit report](evidence/81p-source-fit.json) uses the same finite samples and six-view ray method. It records 124 source-only and 158 reduced-only hits. The largest matched-ray depth difference is 3.59 km; this is a view-dependent first-hit comparison, distinct from the nearest-surface distances above. Geometry rays are two-sided; native painted-side visibility and browser targeting are checked separately.

Increasing Wild 2 to 1,292 faces lowered the largest sampled source-to-prepared distance to 78.70 m; 1,494 faces lowered it to 75.86 m. Those variants produced substantially slower draw cadence in the sequential development captures. The PoC therefore keeps 996 faces and discloses its 139.84 m sampled maximum. The archive's 50 m horizontal resolution and 6 m vertical precision describe the source model, not this reduced mesh's accuracy.

The [budget decision](evidence/81p-budget-decision.json) preserves all measured variants, source distances, exact code revisions and a contemporary 67P control. These are shared-workstation development measurements, not a controlled hardware comparison. Final production timing is recorded in [PERFORMANCE.md](PERFORMANCE.md).

## Wild 2 close-view limits

The [production close view](evidence/81p-close-flood.png) exposes reduced facets and texture-cell boundaries. These are rendering artifacts, not evidence of observed ridges or strata. The [lighting-edge audit](evidence/81p-lighting-edge-audit.json) compares 3,960 points on shared physical edges between incident triangles. Analytical source-lighting values agree exactly at those samples. Bilinear samples of the actual 64-pixel WebP cells differ by 0.82 red-channel levels on average, 2.96 at p95 and 23.40 at the largest sample, on a 0–255 scale. This finite diagnostic does not establish screen-space pixel parity or identify the cause of every visible line.

Of 14,940 samples strictly inside the physical triangles, 40 use the interpolated coarse normal because the source projection finds no nearby intersection. The full bake's larger fallback count includes unused portions of square texture cells and is not a visible-surface coverage percentage. Native triangle edge overlap and the finite geometry/texture budget also limit close inspection. The PoC does not present that detail as a new observation.
