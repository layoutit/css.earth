# Adrastea

## Sources

- The **Shape model** dataset uses a triaxial ellipsoid with semi-axes 10 × 8 × 7 km, from [NAIF pck00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), BODY515_RADII.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

- Galileo SSI frames resolve Adrastea across only 2.286–3.024 pixels, so no surface texture is prepared; see the [investigation ledger](investigations.json).

## Known problems

- This is a dimension-constrained approximation, not a detailed measured mesh. The standard gray cartographic grid marks the absence of observed surface imagery.

- The rotation model assumes synchronous rotation; the Galileo evidence is insufficient to establish it precisely.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="adrastea-sources-and-presentation"></a>

The long axis points toward Jupiter and the short axis is the pole. Units, sampling formula and constant neutral material are in source/measurements.json. The checked-in radius table is sampled at 10°; shared meshoptimizer reduces it before native raster-triangle preparation. The constant input is declared entirely no-data and rendered by the shared missing-coverage preparer; grid lines are not terrain or measured surface color. Flood displays the grid, while Shadows adds the shared fixed-epoch Sun lighting.

All surface pixels are marked as missing observational coverage on the approximate ellipsoid. The original science inputs remain separate from the prepared display assets. The surface, poles, thumbnail, small minimap and context portrait use the same standard grid.

</details>
