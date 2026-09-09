# Patroclus

Patroclus and Menoetius form a large Trojan binary that Lucy will visit in the trailing swarm. This published ellipsoid represents Patroclus alone. The grid marks unmapped terrain.

## Shape, scale and orientation

Published primary-component ellipsoid combining occultation and light-curve constraints. Its full axes differ from the two-dimensional occultation limb and from the unresolved binary system's radiometric diameter. Full approximation dimensions: 127 × 117 × 98 km. Synchronous spin-axis approximation using the same 2024 orbital pole as Menoetius; arbitrary display meridian. A physical mutual-event phase is not claimed. The grid marks unmapped terrain.

Source: [Buie et al. (2015), The Astronomical Journal 149, 113; existing JPL#82 Patroclus-Menoetius source closure](https://www2.boulder.swri.edu/~buie/biblio/pub099.html). Checked 2026-09-08. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The radius-table formula and pole conversion are in source/measurements.json. Reproduce authored geometry and its grid thumbnail with docs/lucy-targets/author.mjs; all scene geometry, texture and lighting are produced by the existing shared terrestrial preparer. Runtime uses retained native PolyCSS raster triangles.

## Source survey

- Included: published numerical shape constraints and matched pole evidence. Published primary-component ellipsoid combining occultation and light-curve constraints. Its full axes differ from the two-dimensional occultation limb and from the unresolved binary system's radiometric diameter.
- Included: existing normal missing-data grid. No resolved registered surface mosaic was qualified for this pre-encounter target. Integrated spectra are not surface maps.
- Unresolved: Local shape deviations and a physical mutual-event rotational phase remain unqualified.
- Unresolved: The existing Menoetius package supplies the retained primary-specific heliocentric state; the system barycentre is not substituted for Patroclus.
- [Lucy mission summary](https://doi.org/10.1007/s11214-025-01173-7) supplies the mission context and complementary model descriptions.

## Orbit

JPL Horizons command "920000617"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude. The existing Menoetius primary-specific JPL#82 state overrides the conic at this epoch for a consistent binary origin.

## Reproduction

Restore pinned common inputs with the shared acquisition command and run the authored preparer for this object. No other body renderer or prepared scene is copied.
