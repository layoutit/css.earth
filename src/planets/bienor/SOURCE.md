# Bienor

Bienor is an elongated Centaur. Its smooth shape is constrained by stellar occultations and long-term photometry, while the grid marks its unmapped surface. The ellipsoid is a useful global approximation; unresolved shape, albedo or a companion may explain its asymmetric light curve.

## Shape, scale and orientation

Smooth triaxial ellipsoid fitted to stellar-occultation chords and rotational light curves, with semiaxes 127 ± 5, 55 ± 4 and 45 ± 4 km (Rizos et al. 2024). This is the study's global reference shape, not resolved terrain. It cannot explain all observed light-curve asymmetry; the paper also explores albedo, irregular-shape and satellite alternatives without uniquely resolving them. Full approximation dimensions: 254 × 110 × 90 km. The adopted prograde ecliptic pole is longitude 35° ± 8°, latitude +50° ± 3°. The 2024 study validates this pole over 22 years and uses its refined 9.1736 h period to compute rotational phase. Ecliptic J2000 coordinates are converted to ICRF using the established preparation recipe. The displayed longitude origin and absolute rotational phase are arbitrary. The grid marks unmapped terrain.

Source: [Rizos et al. (2024), Astronomy & Astrophysics 689, A82; pole solution from Fernández-Valenzuela et al. (2017), validated by the 2024 study.](https://doi.org/10.1051/0004-6361/202450833). Checked 2026-09-09. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The radius-table formula and pole conversion are in source/measurements.json. Reproduce authored geometry and its grid thumbnail with docs/lucy-targets/author.mjs --inputs=docs/centaur-population/inputs.json; all scene geometry, texture and lighting are produced by the existing shared terrestrial preparer. Runtime uses retained native PolyCSS raster triangles.

## Source survey

- Included: published numerical shape constraints and explicitly qualified orientation. Smooth triaxial ellipsoid fitted to stellar-occultation chords and rotational light curves, with semiaxes 127 ± 5, 55 ± 4 and 45 ± 4 km (Rizos et al. 2024). This is the study's global reference shape, not resolved terrain. It cannot explain all observed light-curve asymmetry; the paper also explores albedo, irregular-shape and satellite alternatives without uniquely resolving them.
- Included: existing normal missing-data grid. No resolved registered surface mosaic was qualified; integrated light curves do not provide mapped albedo. Integrated spectra are not surface maps.
- Unresolved: The smooth ellipsoid does not reproduce all observed light-curve asymmetry. The paper's irregular, contact-binary, albedo and satellite scenarios are alternatives rather than uniquely measured geometry.
- Unresolved: No ring or satellite is included because the selected occultations do not establish their geometry.
- [Mission context](https://doi.org/10.1051/0004-6361/202450833).

## Orbit

JPL Horizons command "54598;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

## Reproduction

Restore pinned common inputs with the shared acquisition command and run the authored preparer for this object. No other body renderer or prepared scene is copied.
