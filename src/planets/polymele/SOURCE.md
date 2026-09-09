# Polymele

Polymele is a very flattened Jupiter Trojan and a Lucy target. This published ellipsoid is constrained by stellar occultations and its satellite's projected position. The grid marks unmapped terrain.

## Shape, scale and orientation

Published approximate ellipsoid from six stellar occultations, assuming the satellite's orbit is circular and equatorial. Full approximation dimensions: 27 × 24.4 × 10.4 km. The fitted pole assumes an equatorial satellite orbit. Rotation period and current longitude remain unqualified; the display meridian is arbitrary. The grid marks unmapped terrain.

Source: [Levison et al. (2023), ACM abstract 2184; Levison et al. (2025), Space Science Reviews 221, 70](https://occultations.org/publications/rasc/2023/2184Polymele1.pdf). Checked 2026-09-08. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The radius-table formula and pole conversion are in source/measurements.json. Reproduce authored geometry and its grid thumbnail with docs/lucy-targets/author.mjs; all scene geometry, texture and lighting are produced by the existing shared terrestrial preparer. Runtime uses retained native PolyCSS raster triangles.

## Source survey

- Included: published numerical shape constraints and matched pole evidence. Published approximate ellipsoid from six stellar occultations, assuming the satellite's orbit is circular and equatorial.
- Included: existing normal missing-data grid. No resolved registered surface mosaic was qualified for this pre-encounter target. Integrated spectra are not surface maps.
- Unresolved: The selected model does not establish a current rotational phase or an unambiguous period.
- Unresolved: The satellite is outside this standalone asteroid package.
- [Lucy mission summary](https://doi.org/10.1007/s11214-025-01173-7) supplies the mission context and complementary model descriptions.

## Orbit

JPL Horizons command "15094;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

## Reproduction

Restore pinned common inputs with the shared acquisition command and run the authored preparer for this object. No other body renderer or prepared scene is copied.
