# Albiorix source survey

## Selected shape

[Denk et al. (2018), Table 3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) reports a minimum equatorial axis ratio of **1.34:1** under a uniform-reflectivity ellipsoid interpretation of the lightcurve amplitude. The [author’s physical table](https://tilmanndenk.de/outersaturnianmoons/albiorix/) supplies the adopted 14.3 km reference radius and 13.33 ± 0.03 h rotation period. Uncertain NEOWISE thermal diameter; the author’s approximate 14.3 km reference radius supplies the display scale.

The model selects this lower-limit ratio and assumes equal short axes. It uses a volume-equivalent display radius of 14.3 km, giving semiaxes 17.380912 × 12.970830 × 12.970830 km. The equal-volume scaling is a display convention, not a measured volume. These are derived axes, not three observed dimensions. The formula and sampling are in source/measurements.json; the checked radius table is the reproducible preparation input.

The available lightcurves do not uniquely determine its three-dimensional shape. The approximation does not reproduce the measured lightcurve series. Unknown concavities, terrain and albedo patterns are not synthesized. The complete surface uses the shared missing-data grid. Shape bounds, maps, thumbnails and context markers derive from this same geometry.

## Dataset candidates

- **Cassini ISS:** [PDS archive](https://pds-rings.seti.org/cassini/iss/) and [author’s observations](https://tilmanndenk.de/outersaturnianmoons/albiorix/) provide unresolved images and lightcurve constraints. Selected for bulk shape evidence; not a registered photographic surface.
- **Native inversion model:** [Denk et al. (2026), section 4.2](https://tilmanndenk.de/wp-content/uploads/2026_SSR_DenkEtAl_IoMinorMoons.pdf) reports 13 calculated Saturnian models, with footnote 47 identifying papers in preparation. No downloadable model for Albiorix was qualified in the reviewed releases. This remains an unresolved replacement candidate, not evidence that no model exists.
- **Elevation and geology:** no registered terrain or geology product was qualified in the reviewed sources. Facets of the approximation are not measured relief.
- **JWST spectroscopy:** [Belyakov and Brown (2025)](https://arxiv.org/abs/2503.20046) provides unresolved 0.7–5.3 µm spectra. Useful for a future spectrum chart; not a spatial composition map or texture.

## Orientation and orbit

The display uses an arbitrary north-aligned ICRF pole, meridian and spin sense. This is not an observed attitude or synchronous rotation; display motion is illustrative. The reported rotation period is a separate observation, not a real-time attitude solution. Zero GM means unmodeled mass, not a measured physical zero.

Orbital positions use a Horizons-fitted precessing ellipse plus bounded periodic ICRF corrections: daily samples, fitted longitude harmonics and 512 cosine residual terms per axis. Actual sampled interval: 2020-01-01 through 2032-01-01. See source/validation/orbit-checks.json for exact queries and 43 independent vector epochs. The six committed fixture epochs have maximum position error 18473.58 km; 37 additional epochs have maximum 92772.09 km, angular error 0.1368 degrees and radial error 1.0514%. These are sampled fit residuals, not universal bounds or measured uncertainties. No precision tracking, endpoint velocity accuracy or extrapolation is claimed. At the prepared scene epoch the position residual is 274.05 km and velocity residual 109.14 km/day.
