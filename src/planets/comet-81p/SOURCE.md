# 81P/Wild 2 sources

Farnham, T., Duxbury, T. and Li, J.-Y. (2005), SHAPE MODELS OF COMET WILD 2, SDU-C-NAVCAM-5-WILD2-SHAPE-MODEL-V2.1, NASA PDS.

The [observed-only Cartesian plate table](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/data/wild2_cart_vis.lbl) is selected. It has 6,432 vertices and 12,514 zero-indexed plates in meters. +Z follows the minor axis of the fitted ellipsoid (RA 112°, declination −17°); +X follows the long axis/prime meridian. The axis was assumed to correspond to the spin pole. Phase is arbitrary and fixed, not a current orientation.

The [catalogue](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/catalog/dataset.cat) reports roughly 50% coverage, 50 m horizontal resolution and 6 m vertical precision. The source contains eight edge-connected patches. Two plates need winding reversal to make their shared edges consistent; no positions change. Boundary-locked simplification retains 1,494 plates and all 348 source boundary edges. The library error estimate is about 35.43 m, not a guaranteed maximum distance or observation uncertainty.

Only the observed plates are rendered. Unseen regions remain absent. Neutral gray is an authored model material; it is not albedo or spacecraft imagery. Fixed-epoch solar shadows use only the available surface, so unseen terrain cannot cast a modeled shadow. Flood lights are illustrative.

Reference radius is the geometric mean of the catalogue's best-fitting ellipsoid semi-axes, cbrt(1.350 × 2.002 × 2.607) = 1.917106726261 km. This is an approximate navigation scale, not a measured global volume. No GM or uniform spin is invented.

## Survey and exclusions

The [Stardust mission archive](https://pdssbn.astro.umd.edu/data_sb/missions/stardust/index.shtml) identifies raw and calibrated NAVCAM v3.0 imagery, dust measurements, SPICE and the v2.1 shape model. The calibrated frames are observations with their own camera and illumination, not a registered global albedo map; no photographic texture lens is asserted. The visible Cartesian table preserves the observed mesh directly. Its planetocentric equivalent adds no distinct view.

The full-model product is excluded because it completes the unseen hemisphere with an assumed ellipsoid and connecting plates without physical meaning. Its exact label is preserved in reference/wild2_plan_full.lbl to make that exclusion reviewable.

Source labels and catalogue are checked in beside the manifest; the original plate table, common ESO panorama and Inter font are restorable from exact URL/hash pins. Context imagery is reproducibly prepared from the same reduced observed mesh.
