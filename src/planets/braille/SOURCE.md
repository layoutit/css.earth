# Braille

Deep Space 1 visited Braille in 1999. This approximate ellipsoid uses the published size estimate from flyby images and ground-based photometry. The grid marks unmapped terrain.

## Shape, scale and orientation

Ellipsoid approximation of the published 2.1 × 1 × 1 km size estimate combining Deep Space 1 images and ground-based photometry. The equal short axes are part of that coarse estimate; resolved local terrain is not represented. Full approximation dimensions: 2.1 × 1 × 1 km. Arbitrary display pole and meridian. The published 226.4 ± 1.3 h estimate is synodic and is not installed as a sidereal spin or an observed pole. The grid marks unmapped terrain.

Source: [Oberst et al. (2001), Icarus 153, 16–23; Buratti et al. (2004), Icarus 167, 129–135, Table 1](https://doi.org/10.1006/icar.2001.6648). Checked 2026-09-09. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The radius-table formula and pole conversion are in source/measurements.json. Reproduce authored geometry and its grid thumbnail with docs/lucy-targets/author.mjs --inputs=docs/asteroid-spacecraft-gaps/inputs.json; all scene geometry, texture and lighting are produced by the existing shared terrestrial preparer. Runtime uses retained native PolyCSS raster triangles.

## Source survey

- Included: published numerical shape constraints and explicitly qualified orientation. Ellipsoid approximation of the published 2.1 × 1 × 1 km size estimate combining Deep Space 1 images and ground-based photometry. The equal short axes are part of that coarse estimate; resolved local terrain is not represented.
- Included: existing normal missing-data grid. Deep Space 1 images and integrated spectra exist, but no registered global surface mosaic is qualified for this approximation. Integrated spectra are not surface maps.
- Unresolved: Original closed global mesh and registered surface imagery remain unresolved in the checked DS1 archive.
- Unresolved: Integrated infrared spectra constrain composition, not the position of surface texels.
- Unresolved: The quoted period is a probable synodic solution, not a qualified sidereal attitude model.
- Unresolved: The arbitrary display pole and meridian are not measured orientation.
- [Mission context](https://science.nasa.gov/mission/deep-space-1/).

## Orbit

JPL Horizons command "9969;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

## Reproduction

Restore pinned common inputs with the shared acquisition command and run the authored preparer for this object. No other body renderer or prepared scene is copied.
