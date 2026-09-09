# Three lightcurve-based comet shapes

137P/Shoemaker–Levy 2, 143P/Kowal–Mrkos and 162P/Siding Spring extend the comet collection from seven to ten objects. Each has one **Shape approximation** dataset, an 800-triangle nucleus, two facts and a short explanation. The shared missing-imagery grid covers the entire surface. Shadows start off and can be enabled in Settings.

The [Donaldson thesis](https://era.ed.ac.uk/items/cf7f5ebf-4f32-4f86-95d2-b8dd2e37c8ad) supplies physical axis proportions and nominal poles. [SEPPCoN](https://doi.org/10.1016/j.icarus.2013.07.021) supplies thermal radii. These are smooth approximations, not the original convex meshes. No local terrain, photographic texture or present rotation phase is claimed.

| Object | Physical a/b | Physical b/c | Thermal radius | Rotation |
| --- | ---: | ---: | ---: | ---: |
| 137P | 1.06 | 1.30 | 4.04 km | 7.7883 h |
| 143P | 1.21 | 1.24 | 4.79 km | 17.1988 h |
| 162P | 1.60 | 2.20 | 7.03 km | 32.864 h |

The thermal radius is used as a volume-equivalent display radius. This explicit convention does not establish a measured volume or absolute axis lengths. The source packages retain uncertainties and alternative-model dispositions. 137P uses Model 1 while documenting the valid mirror solution. The rejected 143P mirror model is excluded. For 162P, the physical extents are kept separate from its inertia-equivalent axis ratios.

137P’s ecliptic pole is repeated consistently in the detailed thesis results, but Table 5.2 prints an inconsistent right ascension. Preparation converts the ecliptic coordinates directly; the package records that discrepancy. All three attitudes hold an illustrative fixed meridian at the shared 3 September 2026 epoch.

## Preparation and validation

The shared parameter loader subdivides an octahedron and scales it to the authored ellipsoid. The established meshoptimizer path reduces 2,048 triangles to 800, preserving a closed surface. Both material banks and the grid are baked into 64-pixel atlas cells. There is no runtime geometry, texture generation or extra scene owner.

Numerical checks use the published ratios, independent Horizons vectors and analytic ellipsoid surfaces. The sampled distance bounds use projected analytic surface points, covering every retained vertex, edge midpoint and face centre. They bound nearest-surface distance for those samples; they are neither exhaustive bounds nor observational accuracy. The fixed pole conversion is independently inverted to recover the published coordinates. Existing Tuttle geometry checks cover the extracted common tessellation.

Delivery, browser results and gate receipts are recorded with the final reviewed assets below.
