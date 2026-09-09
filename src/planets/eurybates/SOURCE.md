# Eurybates

Eurybates is a Jupiter Trojan and the largest remnant of a collisional family. This approximate ellipsoid preserves the published model's overall extents, while its irregular outline remains unresolved. The grid marks unmapped terrain.

## Shape, scale and orientation

Authored ellipsoid approximation constrained to the published convex model's maximum extents. These are not independently measured ellipsoid axes; the irregular convex outline and model volume are not reproduced. Full approximation dimensions: 77.5 × 71.3 × 61.8 km. Published retrograde pole, with an arbitrary display meridian. The approximation has no qualified current surface longitude. The grid marks unmapped terrain.

Source: [Mottola et al. (2023), The Planetary Science Journal 4, 18, Table 3](https://elib.dlr.de/194154/1/Mottola%20et%20al%202023_shapes%20of%20Eurybates%20and%20Orus.pdf). Checked 2026-09-08. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The radius-table formula and pole conversion are in source/measurements.json. Reproduce authored geometry and its grid thumbnail with docs/lucy-targets/author.mjs; all scene geometry, texture and lighting are produced by the existing shared terrestrial preparer. Runtime uses retained native PolyCSS raster triangles.

## Source survey

- Included: published numerical shape constraints and matched pole evidence. Authored ellipsoid approximation constrained to the published convex model's maximum extents. These are not independently measured ellipsoid axes; the irregular convex outline and model volume are not reproduced.
- Included: existing normal missing-data grid. No resolved registered surface mosaic was qualified for this pre-encounter target. Integrated spectra are not surface maps.
- Unresolved: The original 1454-facet convex reconstruction was not located in the checked paper's supporting release.
- Unresolved: The paper's 69.3 km surface-equivalent diameter is not a volume-equivalent diameter and is not used to rescale this approximation.
- Unresolved: Queta is outside this standalone asteroid package.
- [Lucy mission summary](https://doi.org/10.1007/s11214-025-01173-7) supplies the mission context and complementary model descriptions.

## Orbit

JPL Horizons command "3548;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

## Reproduction

Restore pinned common inputs with the shared acquisition command and run the authored preparer for this object. No other body renderer or prepared scene is copied.
