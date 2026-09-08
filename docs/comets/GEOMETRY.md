# Source-mesh comparison

The 1,000-face nuclei preserve released vertex positions and closed, outward-wound topology. Unit tests also check source bounds, source constraint flags, a non-radial neck on 67P, and volume retention (within 1% for 67P and 2% for the two PDS models).

The following comparison measures Euclidean distance to the closest triangle on the other mesh. Source-to-prepared samples include every original vertex and face centroid. Prepared-to-source samples include every prepared face centroid and its three edge midpoints. The statistics are unweighted by face area, and finite sampling is **not an exhaustive Hausdorff bound** or the uncertainty of the source observations. Each report binds the source and prepared geometry hashes.

| Comet | Direction | Samples | Mean, m | p95, m | Maximum sampled, m |
| --- | --- | --- | --- | --- | --- |
| 103p | Source → prepared | 48,062 | 1.99 | 4.95 | 10.46 |
| 103p | Prepared → source | 4,000 | 2.02 | 5.15 | 10.64 |
| 9p | Source → prepared | 48,062 | 7.44 | 19.34 | 38.90 |
| 9p | Prepared → source | 4,000 | 8.55 | 21.78 | 38.18 |
| 67p | Source → prepared | 156,290 | 11.69 | 30.85 | 81.35 |
| 67p | Prepared → source | 4,000 | 13.53 | 36.39 | 80.84 |

These measured distances are distinct from meshoptimizer's error estimates. In particular, 67P's maximum sampled distance is about 81 m, despite the simplifier's roughly 49 m estimate. The PoC does not claim a 50 m maximum physical error.

A second comparison casts 55,296 matched orthographic rays per comet from six ±X/±Y/±Z views. Each view uses a 96 × 96 pixel-centered grid over the source bounds with 4% padding. Reports retain both hit/miss disagreements and differences in the first-intersection depth. Some rays switch which part of the nucleus is foremost near silhouettes or overlapping terrain. The largest range jumps are 1.06 km (Hartley 2), 1.70 km (Tempel 1), and 2.78 km (67P); the two hit points on those particular rays are each within 12 m of the other mesh's surface. These are view-dependent occlusion changes, not kilometer-scale nearest-surface errors. They remain visible in the reports.

The source-only/reduced-only hit counts, out of 55,296 rays, are 162/44 for Hartley 2, 156/18 for Tempel 1, and 236/238 for 67P. This qualification accepts a simplified model for inspection; it does not promise identical silhouettes at every pixel or zoom.

Reports are [67P](evidence/67p-source-fit.json), [Hartley 2](evidence/103p-source-fit.json), and [Tempel 1](evidence/9p-source-fit.json). Reproduce with:

```sh
node --test tests/objects/unit/comet-67p/surface-distance.test.mjs
node tests/objects/browser/comets/source-fit.mjs
```

This source-geometry comparison is separate from browser/photograph visual parity. No matched spacecraft-camera reconstruction is claimed.
