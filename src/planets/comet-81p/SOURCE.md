# 81P/Wild 2 sources

Farnham, T., Duxbury, T. and Li, J.-Y. (2005), SHAPE MODELS OF COMET WILD 2, SDU-C-NAVCAM-5-WILD2-SHAPE-MODEL-V2.1, NASA PDS.

The [full Cartesian plate model](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/data/wild2_cart_full.lbl) is selected: 8,761 vertices and 17,518 zero-indexed plates in meters. The archive completes the hidden/unilluminated side using a fitted triaxial ellipsoid; we use its published vertices and connections, without synthesizing terrain. The original label is checked in beside the table's exact acquisition pin.

The source flags distinguish 6,432 observed vertices and 2,329 ellipsoid vertices. Of its plates, 12,364 join observed vertices, 4,338 belong to the ellipsoid, and 816 connect the two. The label explicitly gives the connecting plates no physical meaning beyond joining the segments. Each of the 6,432 observed-only vertices has a distinct full-model counterpart within 11.22 mm (mean 3.49 mm), but the releases have different connectivity along their joins; it is not the earlier open mesh with an arbitrary cap attached.

The prepared material maps those original plate flags into a 512 × 256 equirectangular raster before filtering or lighting. Observed plates (flag 0) retain neutral gray; ellipsoid plates (1) and joining plates (2) receive cssEarth's shared gray coverage grid. The grid identifies missing observations on published estimated geometry. It does not imply a measured surface texture. The radial projection preserves observed-versus-estimated classification at all 17,518 source plate centers; this finite check is not an exhaustive subpixel boundary proof. Raster resolution, filtering and mesh reduction limit boundary precision. Both lighting atlases, the thumbnail, context image and navigation marker derive from the same material. This model lens has no minimap.

The full source is one closed, consistently outward-wound component with Euler characteristic 2. Reduction retains 992 triangles and original published positions, closed topology, and volume within 3% of the source full model. The simplifier's 55 m allowance produces a 54.33 m library error estimate, not a measured maximum or observational uncertainty. The previous 996-leaf open-surface qualification is historical; current source-fit, browser and drag evidence is recorded in [the completion record](../../../docs/comets/WILD2-COMPLETION.md).

The [catalogue](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/catalog/dataset.cat) reports roughly half-nucleus observation coverage, 50 m horizontal resolution and 6 m vertical precision. Those values describe the observed source terrain, not the inferred side or this reduced display. The viewer labels the completed shape and explicitly identifies the estimated far side. Neutral gray is a model material, not albedo or spacecraft imagery. Close-view facets and texture-cell artifacts are not observed geological detail.

+Z follows the fitted ellipsoid's minor axis (RA 112°, declination −17°); +X follows the long axis/prime meridian. The source assumes this axis corresponds to the spin pole. Phase is arbitrary and fixed, not a current orientation. Fixed-epoch solar shadows use the full source mesh, including estimated terrain; flood lights are illustrative.

Reference radius is the geometric mean of the catalogue's fitted ellipsoid semi-axes, cbrt(1.350 × 2.002 × 2.607) = 1.917106726261 km. This is an approximate navigation scale, not a measured global volume. No GM or uniform spin is invented.

## Source survey

The [Stardust mission archive](https://pdssbn.astro.umd.edu/data_sb/missions/stardust/index.shtml) provides raw and calibrated NAVCAM v3.0 imagery, dust measurements, SPICE and the v2.1 shape model. Calibrated frames have their own cameras and illumination; no registered global albedo map or photographic texture lens is asserted. The full Cartesian and planetocentric tables are equivalent source products, not separate views. The observed-only Cartesian table remains pinned for direct source-comparison tests.

The original tables, common ESO panorama and Inter font are restorable from exact URL/hash pins. Context imagery is reproducibly prepared from the same completed, reduced mesh. Source labels and catalogue retain their original bytes.
