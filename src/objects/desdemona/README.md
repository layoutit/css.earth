# Desdemona

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- [French et al. (2024), Table 3](https://arxiv.org/abs/2401.04634) reproduces the Voyager dimensions from [Karkoschka (2001), Table V](https://doi.org/10.1006/icar.2001.6597). The companion [HST study, Table IV](https://doi.org/10.1006/icar.2001.6596) provides the adopted prolate dimensions.

- Semiaxes are 45 × 27 × 27 km.

## Evidence

- The finest candidate vg-iss-2-u-c2675426 lists 37.49979 km/native pixel, but has no recorded Desdemona surface intersection or located pixel center. Its actual GEOMED raster and label were inspected.

## Known problems

- The third axis repeats the minor axis by the published prolate assumption. This is an analytic approximation, not a detailed measured terrain mesh. The reported projected radius is 35 ± 4 km and minor/major ratio 0.6 ± 0.2; these are not separate-axis error bars.

- No usable photographic map is qualified; query results, metadata, URLs and inspected input hash are retained in [source/survey](source/survey).

- All material samples are the shared no-data sentinel; the prepared standard gray grid marks missing surface data. It is not gray observed albedo.

- The shared display then advances the secular spin rate -760.053169°/day and freezes the small periodic correction. This is not a complete long-term rotation ephemeris or landmark registration.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="desdemona-source-record"></a>

## Included: measured Shape model

The full papers remain research inputs outside the package; factual measurements are transcribed in source/measurements.json.

Physical scale uses the derived volume-equivalent radius 32.01203974041056 km, preserving the stated axes.

## Investigation ledger

The source-survey dispositions and evidence are recorded in the [investigation ledger](investigations.json).
## Orientation and reproducibility

NASA/NAIF PCK00011 BODY710 supplies the pole and prime meridian. SPICE evaluates its full periodic terms at JD 2461286.5 TT: RA 257.4627329517684°, Dec -15.109741031832614°, W 157.17013601736184°. Obsolete spherical PCK radii are not used.

The analytic 5° radius table is checked in. The shared radial recipe and meshoptimizer reduce it to 480 native triangle leaves with a 1000 m library error allowance. The estimate is not a measured shape uncertainty or exhaustive surface-error bound. Context portrait, minimap and prepared lighting derive from the same shape/grid. All source inputs and documents are pinned in source/manifest.json; acquisition restores the font and PCK from their original URLs. Shared orbital elements are fitted to daily Horizons samples over 2020–2032 and checked at independent epochs; their residual is not a universal error bound.

</details>
