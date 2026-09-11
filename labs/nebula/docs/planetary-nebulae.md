# Planetary nebulae without a simulation density

The LMC workflow colors a supplied stellar-density model. A planetary nebula without that prior needs an additional **emission inference** stage. Its result may then use the same offline slice baker and retained PolyCSS renderer. Never silently replace LMC's fixed-density painting semantics with this method.

## Primary papers

- [Wenger et al., 2012 — Visualization of Astronomical Nebulae via Distributed Multi-GPU Compressed Sensing Tomography](https://doi.org/10.1109/TVCG.2012.281). [Author PDF](https://graphics.tu-bs.de/upload/publications/wenger2012visualization.pdf). Uses symmetry-derived virtual views with regularized tomography; these are assumed views, not additional observations.
- [Wenger, Lorenz & Magnor, 2013 — Fast Image-Based Modeling of Astronomical Nebulae](https://doi.org/10.1111/cgf.12216). [Author PDF](https://graphics.tu-bs.de/upload/publications/wenger2013fast.pdf). The baseline implements its normalized projection, FISTA updates and nonnegative weighted L-infinity group proximal operation (equations 1–7). Axial bins follow section 6.
- [SHAPE — A 3D Modeling Tool for Astrophysics](https://arxiv.org/abs/1003.2012). Follow this direction when morphology and velocity observations can constrain a more explicit physical model.

The 2013 paper demonstrates M2–9, but also shows failures: M57's nearly observer-facing axis leaves its depth unconstrained by symmetry; dust-rich NGC 6302 violates the simple emission assumptions. Radial banding remains a documented discretization artifact. This is not a general recovery algorithm for every nebula.

Both Wenger PDFs downloaded successfully in this session. The 2013 algorithm, results and limitations were read directly; the 2012 imaging and optimization sections were checked for comparison. PDF hashes: 2013 `d3f71465cff7dbc18ab8fb26bccde1ec94bf2dc56c654a41d333837217825ae9`; 2012 `1005ce30b5671b53ed54b399042b76473afe9a06d23baf82ac6629dfde2afd2f`.

The [author download page](https://graphics.tu-bs.de/publications/wenger2013fast) offers reconstructed HDF5 volumes for non-commercial use with citation, and requests contact for commercial use. Those volumes are **not included** in this implementation or its assets. No reusable solver source was found on that page. Our implementation follows the published equations independently.

## Active experiment

[M2–9 recipe, reproduction and limits](../models/m2-9/README.md). Object parameters stay in the recipe; generic inference lives in `src/reconstruction/emission-inference/`. Acquisition, masks, inference, projection checks and baking run from `src/cli/prepare-emission.ts`. React adds only a small read-only comparison panel; the existing TypeScript viewer handles the cloud.

The first run uses a small outreach image and explicit compact-source masks to test the volume method quickly. It does not supersede native NOX removal or provide a production-ready asset. There is no measured stellar catalogue or distance for this prototype.

## After the first visual decision

1. Decide whether the reconstructed side structure is useful. Keep an initial baseline and at most two controlled adjustments; compare identical camera poses and fixed exposure.
2. Acquire a larger, unannotated observation with documented band mapping. Reuse the existing native NOX pipeline; check that compact nebular knots and the central engine are not mistaken for foreground stars. Pin the selected diffuse image before inference.
3. Constrain axis inclination and physical extent with independent morphological/kinematic literature. An image alone does not supply this information. Record alternative priors as alternatives.
4. Compare front-projection error and side geometry across resolution/bin-width settings. Address radial artifacts in the inference discretization; address opacity/bank-handoff differences in the renderer. Exposure adjustments cannot repair incorrect geometry.
5. Only after an accepted small result: connect the solver to the lab's existing server-owned Preview jobs, progress, cancellation and saved recipes. Keep process initiation explicit. Do not build a second job framework.
6. For shells viewed along the symmetry axis or strongly asymmetric/dusty targets, use additional constraints or authored SHAPE-like models. Do not present guessed depth as recovered science.
