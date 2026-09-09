# Enceladus corrected v2 source-only geometry trial

The regularized candidate is the stronger starting point for visual review: 2,000 closed faces, one component and Euler characteristic 2. Four barycentric points per face project to the complete original source without missing correspondences. Maximum sampled deviation is 1,822.01 m, 95th percentile 1,076.54 m and RMS 641.87 m. Its Cartesian extrema lie within 533 m of the original mesh extrema. The source-preserving simplifier retains native vertex coordinates; it does not move them to the reference ellipsoid.

Without regularization, a candidate reaches 1,996 closed faces after canceling four exact opposite faces. It has similar surface deviation (maximum 1,828.75 m), slightly lower RMS, and worse extremity loss (up to 871 m). The original tighter 1,000 m candidate missed the 2,000-face limit and is retained as a failed trial.

The selected source radii are 247.689–257.598 km. Comparing all source vertices with the older reference ellipsoid, whose **semi-axes** are 256.2 × 251.4 × 248.6 km, gives directional radial differences of −2.647 to +2.209 km. The 1.374 km absolute-residual 95th percentile is vertex-weighted, not area-weighted. Different source/control solutions make this a geometric comparison, not a measured uncertainty or a new elevation datum.

These are source-only measurements. Four samples per face do not prove a Hausdorff bound, image-to-shape registration or rendered visual fidelity. Keep the existing Schenk height product’s own ellipsoidal datum separate. Source-derived detail smaller than the final mesh cannot be claimed visible merely because the DSK contains it.

The Node process exited 0 in 6.07 seconds, with a 3 GiB heap cap and about 1.09 GiB peak resident memory. No prepared asset or browser was materialized. Output ZIP pins, converter provenance, full source counts, tool hashes, exact candidate face hashes and all failures are retained in the JSON report. A system-wide compressor increase exceeded this process’s peak; root was notified before any further heavy work.
