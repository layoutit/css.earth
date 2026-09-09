# Cressida

## Sources

- [French et al. (2024), Table 3](https://arxiv.org/abs/2401.04634) reproduces the Voyager dimensions from [Karkoschka (2001), Table V](https://doi.org/10.1006/icar.2001.6597). The companion [HST study, Table IV](https://doi.org/10.1006/icar.2001.6596) provides the adopted prolate dimensions.

- Semiaxes are 46 × 37 × 37 km.

## Evidence

- The finest candidate vg-iss-2-u-c2684646 lists 10.52882 km/native pixel, but has no recorded Cressida surface intersection or located pixel center. Its actual GEOMED raster and label were inspected.

## Known problems

- The third axis repeats the minor axis by the published prolate assumption. This is an analytic approximation, not a detailed measured terrain mesh. The reported projected radius is 41 ± 2 km and minor/major ratio 0.8 ± 0.3; these are not separate-axis error bars.

- No usable photographic map is qualified; query results, metadata, URLs and inspected input hash are retained in [source/survey](source/survey).

- All material samples are the shared no-data sentinel; the prepared standard gray grid marks missing surface data. It is not gray observed albedo.

- The shared display then advances the secular spin rate -776.581632°/day and freezes the small periodic correction. This is not a complete long-term rotation ephemeris or landmark registration.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="cressida-source-record"></a>

## Included: measured Shape model

The full papers remain research inputs outside the package; factual measurements are transcribed in source/measurements.json.

Physical scale uses the derived volume-equivalent radius 39.78509749046438 km, preserving the stated axes.

Cressida’s GM is 0.01227 ± 0.00141 km³/s² and inferred mass (1.839 ± 0.212) × 10¹⁷ kg, from Table 3 footnote b and Section 9.2 of French et al. This is a ring-mode inference with model assumptions; the assumed-density row is not used.

## Source survey and lens decisions

- **Voyager ISS photographic products:** [PDS archive](https://pds-rings.seti.org/voyager/iss/), surveyed in OPUS by Cressida center sampling. Center-resolution metadata alone does not qualify a surface. A separate non-null surface-intersection query returns 3 observations, with best listed sampling 162.59793 km/pixel.

- **Published shape/photometry:** included as the measured model above. Voyager point-spread-function fitting and HST integrated photometry constrain dimensions and elongation; they do not provide new surface texels.

- **Keck near-infrared photometry:** [2023 primary study](https://www.sciencedirect.com/science/article/pii/S0019103522004237), integrated photometry rather than a spatial spectral map. Excluded as a duplicate surface lens.

- **JWST/HST system images:** unresolved moon detections do not establish cartographic coverage. No texture is derived from them.

- **DEM/geology/composition maps:** no qualified spatial product was located in the inspected mission releases and cited studies. This is the survey outcome, not a claim that no other data exist.

No terrain, rings or atmosphere are invented. Both shared Flood and Shadows controls remain available.

## Orientation and reproducibility

NASA/NAIF PCK00011 BODY709 supplies the pole and prime meridian. SPICE evaluates its full periodic terms at JD 2461286.5 TT: RA 257.2701451471836°, Dec -15.176595487262244°, W 29.18192090694761°. Obsolete spherical PCK radii are not used.

The analytic 5° radius table is checked in. The shared radial recipe and meshoptimizer reduce it to 480 native triangle leaves with a 1000 m library error allowance. The estimate is not a measured shape uncertainty or exhaustive surface-error bound. Context portrait, minimap and prepared lighting derive from the same shape/grid. All source inputs and documents are pinned in source/manifest.json; acquisition restores the panorama, font and PCK from their original URLs. Shared orbital elements are fitted to daily Horizons samples over 2020–2032 and checked at independent epochs; their residual is not a universal error bound.

</details>
