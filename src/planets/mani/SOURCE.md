# Máni

Formerly 2002 MS4, Máni has an outline measured through many stellar occultations. One event revealed a large depression along its edge, but its global terrain and three-dimensional shape remain unresolved.

Silhouette-constrained oblate approximation: the observed 824 × 770 km projected ellipse is represented by full axes 824 × 824 × 770 km. The equal equatorial depth and equator-on interpretation are assumptions; true flattening may be larger. Illustrative pole RA 0°, declination 90° and arbitrary meridian; the occultation position angle does not determine an inertial spin pole. The grid marks unmapped terrain.

Source: [Rommel et al. (2023), A&A 678, A167; nine stellar-occultation campaigns](https://arxiv.org/abs/2308.08062). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: Measured elliptical silhouette and local limb features Numeric silhouette anchors the smooth assumed-depth model. No crater or limb-feature extrusion. https://arxiv.org/abs/2308.08062
- Included-as-context: Same study’s thermal-size comparison and preference for an oblate interpretation Thermal size is not substituted for the directly observed outline; the pole and true flattening remain undetermined. https://doi.org/10.1051/0004-6361/202346892
- Included: Official name assignment Use current name Máni while preserving the provisional designation as a search alias. https://www.wgsbn-iau.org/files/Bulletins/V005/WGSBNBull_V005_011.pdf

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
