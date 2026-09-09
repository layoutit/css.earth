# Annefrank

Stardust visited Annefrank in 2002. This approximate ellipsoid shows the minimum dimensions inferred from the flyby; its angular outline and local terrain are unresolved. The grid marks unmapped terrain.

## Shape, scale and orientation

Published preliminary ellipsoid using minimum full dimensions from Stardust flyby images. It does not reproduce the observed angular outline or establish a complete global shape. Full approximation dimensions: 6.6 × 5 × 3.4 km. Arbitrary display pole and meridian. The flyby did not establish a spin pole or current surface longitude; the display orientation is not a measured attitude. The grid marks unmapped terrain.

Source: [Duxbury et al. (2004), Journal of Geophysical Research: Planets 109, E02002](https://doi.org/10.1029/2003JE002108). Checked 2026-09-09. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The radius-table formula and pole conversion are in source/measurements.json. Reproduce authored geometry and its grid thumbnail with docs/lucy-targets/author.mjs --inputs=docs/asteroid-spacecraft-gaps/inputs.json; all scene geometry, texture and lighting are produced by the existing shared terrestrial preparer. Runtime uses retained native PolyCSS raster triangles.

## Source survey

- Included: published numerical shape constraints and explicitly qualified orientation. Published preliminary ellipsoid using minimum full dimensions from Stardust flyby images. It does not reproduce the observed angular outline or establish a complete global shape.
- Included: existing normal missing-data grid. Stardust images exist, but no registered global surface mosaic is qualified for this approximation. Integrated spectra are not surface maps.
- Unresolved: Original closed scientific mesh and registered surface mosaic were not located in the checked Stardust archive.
- Unresolved: The reported 6.6 × 5.0 × 3.4 km dimensions are minimum extents from limited viewing, not three exact global axis measurements.
- Unresolved: The real body has angular surfaces that this preliminary ellipsoid does not reproduce.
- Unresolved: Neither the arbitrary display pole nor its zero meridian is an observed physical orientation.
- [Mission context](https://science.nasa.gov/mission/stardust/).

## Orbit

JPL Horizons command "5535;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

## Reproduction

Restore pinned common inputs with the shared acquisition command and run the authored preparer for this object. No other body renderer or prepared scene is copied.
