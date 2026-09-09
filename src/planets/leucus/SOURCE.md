# Leucus

Leucus is an elongated Jupiter Trojan with an unusually slow rotation. This ellipsoid approximates the dimensions of the published light-curve and occultation model; its irregular outline is unresolved here. The grid marks unmapped terrain.

## Shape, scale and orientation

Ellipsoid approximation using the published convex model's maximum dimensions, as summarized by the Lucy mission paper. It does not reproduce the original irregular convex mesh or occultation silhouettes. Full approximation dimensions: 60.8 × 39.1 × 27.8 km. Published prograde pole, with an arbitrary display meridian. The approximation has no qualified current surface longitude. The grid marks unmapped terrain.

Source: [Mottola et al. (2020), The Planetary Science Journal 1, 73; Levison et al. (2025), Space Science Reviews 221, 70](https://elib.dlr.de/139387/1/Mottola_2020_Planet._Sci._J._1_73.pdf). Checked 2026-09-08. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The radius-table formula and pole conversion are in source/measurements.json. Reproduce authored geometry and its grid thumbnail with docs/lucy-targets/author.mjs; all scene geometry, texture and lighting are produced by the existing shared terrestrial preparer. Runtime uses retained native PolyCSS raster triangles.

## Source survey

- Included: published numerical shape constraints and matched pole evidence. Ellipsoid approximation using the published convex model's maximum dimensions, as summarized by the Lucy mission paper. It does not reproduce the original irregular convex mesh or occultation silhouettes.
- Included: existing normal missing-data grid. No resolved registered surface mosaic was qualified for this pre-encounter target. Integrated spectra are not surface maps.
- Unresolved: The original Mottola 2020 convex mesh was not located in the checked paper's supporting release.
- Unresolved: DAMIT models 6692 and 6693 have different poles and no matched absolute scale; their geometry is not mixed with this solution.
- [Lucy mission summary](https://doi.org/10.1007/s11214-025-01173-7) supplies the mission context and complementary model descriptions.

## Orbit

JPL Horizons command "11351;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

## Reproduction

Restore pinned common inputs with the shared acquisition command and run the authored preparer for this object. No other body renderer or prepared scene is copied.
