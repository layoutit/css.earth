# Juliet

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- [Karkoschka (2001), Table IV, printed page 55](https://doi.org/10.1006/icar.2001.6596) adopts radius axes A=75 km and B=37 km in a prolate model: A points toward Uranus and both perpendicular radii equal B.

- [French et al. (2024), Table 3, PDF page 10](https://arxiv.org/abs/2401.04634) reproduces the Voyager paper's Table V: projected √(AB) radius 53 ± 4 km and B/A=0.5 ± 0.1.

## Evidence

- The archived image identity, sampling and label are retained under [source/survey/](source/survey/); the research-only IMG is not a runtime or preparation input.

- The shared orbital model fits daily JPL states over 2020–2032. Its maximum residual at six independent evaluation epochs is 119.87 km; that sampled residual is not an all-time error bound or a current-ephemeris guarantee.

## Known problems

- The third axis is assumed by that model, not independently measured. These uncertainties are not independent errors on each axis.

- Every material pixel is explicitly no-data. The shared grid supplies surface, thumbnail, minimap and context imagery. It does not assert gray albedo, craters, photometric correction or an observed texture.

- [source/shape/rotation.json](source/shape/rotation.json) evaluates the NAIF PCK00011 BODY711 IAU rotation at the prepared epoch, JD2461286.5 TT. Its small U6 pole/meridian corrections are fixed at that epoch while the shared runtime advances the linear meridian. This is a display approximation, not a complete long-term nutation ephemeris.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="juliet-sources-and-interpretation"></a>

Juliet uses one **Shape model** dataset and the shared missing-coverage grid. Thus the displayed dimensions are 150 × 74 × 74 km. The analytic radius table preserves these axes without rescaling.

The reference radius ∛(AB²)=46.8261 km is derived from the adopted volume; it is distinct from the reported projected radius.

The PCK's old 42 km spherical radii are deliberately not used for geometry. The body coordinates are east-positive longitude with the modeled long axis at 0°/180° longitude. Shared Flood and Shadows shade the same retained mesh.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

The original Voyager paper's full table is paywalled; the 2024 primary study explicitly reproduces it. The accessible HST paper independently lists the adopted axes. A compact measured-data transcription is checked in; preparation does not depend on downloading papers or the Northwestern mirror's invalid TLS certificate.

Preparation targets 480 native `u` leaves; input, lighting, preparation and rendering use the existing owners.

The compact analytic radius table, no-data sentinel and context portrait are versioned inputs; the font has a pinned download recipe.

</details>
