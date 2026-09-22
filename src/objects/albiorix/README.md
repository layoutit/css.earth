# Albiorix

## Sources

- [Denk et al. (2018), Table 3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) reports a minimum equatorial axis ratio of **1.34:1** under a uniform-reflectivity ellipsoid interpretation of the lightcurve amplitude. The [author’s physical table](https://tilmanndenk.de/outersaturnianmoons/albiorix/) supplies the adopted 14.3 km reference radius and 13.33 ± 0.03 h rotation period. Uncertain NEOWISE thermal diameter; the author’s approximate 14.3 km reference radius supplies the display scale.

## Evidence

- Actual sampled interval: 2020-01-01 through 2032-01-01. See [source/validation/orbit-checks.json](source/validation/orbit-checks.json) for exact queries and 43 independent vector epochs. The six committed fixture epochs have maximum position error 18473.58 km; 37 additional epochs have maximum 92772.09 km, angular error 0.1368 degrees and radial error 1.0514%. These are sampled fit residuals, not universal bounds or measured uncertainties.

## Known problems

- The model selects this lower-limit ratio and assumes equal short axes. The equal-volume scaling is a display convention, not a measured volume.

- The available lightcurves do not uniquely determine its three-dimensional shape. The complete surface uses the shared missing-data grid.

- The display uses an arbitrary north-aligned ICRF pole, meridian and spin sense. This is not an observed attitude or synchronous rotation; display motion is illustrative.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="albiorix-source-survey"></a>

## Selected shape

It uses a volume-equivalent display radius of 14.3 km, giving semiaxes 17.380912 × 12.970830 × 12.970830 km. These are derived axes, not three observed dimensions. The formula and sampling are in source/measurements.json; the checked radius table is the reproducible preparation input.

The approximation does not reproduce the measured lightcurve series. Unknown concavities, terrain and albedo patterns are not synthesized. Shape bounds, maps, thumbnails and context markers derive from this same geometry.

## Investigation record

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

## Orientation and orbit

The reported rotation period is a separate observation, not a real-time attitude solution. Zero GM means unmodeled mass, not a measured physical zero.

Orbital positions use a Horizons-fitted precessing ellipse plus bounded periodic ICRF corrections: daily samples, fitted longitude harmonics and 512 cosine residual terms per axis. No precision tracking, endpoint velocity accuracy or extrapolation is claimed. At the prepared scene epoch the position residual is 274.05 km and velocity residual 109.14 km/day.

The radius table, neutral no-data material and reviewed context image are checked in. The Inter font is restored by its pinned acquisition plan. Shape assumptions and context-camera parameters live beside those inputs.

</details>
