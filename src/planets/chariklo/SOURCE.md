# Chariklo

Chariklo is a Centaur moving among the giant planets. Its smooth shape approximates stellar-occultation measurements; the grid marks its unmapped surface. Its two narrow rings are shown schematically from measured dimensions, with a fixed display opacity rather than a model of reflected light.

## Shape, scale and orientation

Triaxial ellipsoid fitted jointly to eleven stellar occultations in 2013–2020, with semiaxes 143.8, 135.2 and 99.1 km (Morgado et al. 2021, Table 6). The smooth approximation does not resolve topography. The axes are model estimates, rather than three independently measured diameters. Full approximation dimensions: 287.6 × 270.4 × 198.2 km. The ICRS ring-plane normal is RA 151.03° ± 0.14°, Dec +41.81° ± 0.07°. The body spin axis is assumed to share that normal, as in the published shape fit. The direction of angular momentum is unknown; the positive-declination pole is the paper's arbitrary choice. The photometric period is an approximate spin rate, not a precise sidereal rotational ephemeris. The displayed longitude origin and rotational phase are arbitrary. The grid marks unmapped terrain.

Source: [Morgado et al. (2021), Astronomy & Astrophysics 652, A141; Santos-Sanz et al. (2025), arXiv:2510.06366v1 for the 2022 JWST ring measurements.](https://doi.org/10.1051/0004-6361/202141543). Checked 2026-09-09. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The radius-table formula and pole conversion are in source/measurements.json. Reproduce authored geometry and its grid thumbnail with docs/lucy-targets/author.mjs --inputs=docs/centaur-population/inputs.json; all scene geometry, texture and lighting are produced by the existing shared terrestrial preparer. Runtime uses retained native PolyCSS raster triangles.

## Source survey

- Included: published numerical shape constraints and explicitly qualified orientation. Triaxial ellipsoid fitted jointly to eleven stellar occultations in 2013–2020, with semiaxes 143.8, 135.2 and 99.1 km (Morgado et al. 2021, Table 6). The smooth approximation does not resolve topography. The axes are model estimates, rather than three independently measured diameters.
- Included: existing normal missing-data grid. No resolved registered surface mosaic was qualified. JWST spectra constrain integrated material signatures, not surface texels. Integrated spectra are not surface maps.
- Unresolved: Local surface topography is not recoverable from the selected global ellipsoid fit.
- Unresolved: The rings vary with longitude, wavelength and epoch. Two concentric circular annuli approximate the 2022 JWST first-contact dimensions; widths and fixed display opacities are not a view-dependent scattering model.
- Unresolved: The body spin direction and absolute rotational phase are not measured by these inputs.
- [Mission context](https://science.nasa.gov/blogs/webb/2023/01/25/webb-spies-chariklo-ring-system-with-high-precision-technique/).

## Orbit

JPL Horizons command "10199;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

## Reproduction

Restore pinned common inputs with the shared acquisition command and run the authored preparer for this object. No other body renderer or prepared scene is copied.
