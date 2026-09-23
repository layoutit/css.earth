# Belinda

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- [Karkoschka (2001), DOI 10.1006/icar.2001.6596](https://doi.org/10.1006/icar.2001.6596), Table IV, printed page 55, provides A=64 km and B=32 km.

- **Shape:** Its semiaxes are **64 × 32 × 32 km**. Both short axes are equal by the published model assumption.

## Evidence

- The retained OPUS query sorted 3,275 candidate observations by nominal Belinda center sampling. C2673019 is 46.77632 km/native pixel, phase 13.801°, with a 15.36-second clear-filter exposure and 5:1 scan mode. The actual geometric-product label and OPUS metadata/files are retained in [source/survey/](source/survey/).

- The shared orbital model fits daily source positions over 2020–2032. Its maximum residual at six independently checked epochs is 28.49 km, which is a sampled residual rather than an error bound or guarantee of current ephemeris accuracy.

## Known problems

- The single **Shape model** view is a measured prolate ellipsoid approximation, not resolved terrain. Every material sample is unavailable and becomes the shared gray grid; the displayed brightness is shared Flood/Shadows illumination of this shape.

- The table's sigma column describes magnitude uncertainty, not an axis error. The original Voyager uncertainty table was not directly accessible; the inspected 2024 primary research table explicitly reproduces it.

- No camera-registered photographic lens is qualified.

- **Rotation:** The shared linear rotation retains −577.362817°/day and freezes the small periodic terms after that epoch. [source/preparation/rotation.json](source/preparation/rotation.json) records the evaluation matrix and source elements; this does not imply landmark registration.

- Browser results are not recorded in this source account.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="belinda-source-record"></a>

The source long axis points toward Uranus.

## Measurements and uncertainty

The adjacent text defines the prolate convention. Hubble photometry supports the marked elongation.

[French et al. (2024), Table 3](https://arxiv.org/abs/2401.04634) reproduces the Voyager measurements from Karkoschka's separate paper, DOI [10.1006/icar.2001.6597](https://doi.org/10.1006/icar.2001.6597): projected equivalent radius √(AB)=45±8 km and B/A=0.5±0.1. These are separate reported quantities, not independent errors on each semiaxis. The volume-equivalent radius used for scale is calculated as ∛(AB²)=40.3174735966 km. No assumed density or mass is presented as measured.

`source/measurements.json` is our factual transcription and contains the complete analytic radius formula. The copyrighted full 2001 PDF stays in ignored research; no paper or copied figure is redistributed. Its public Northwestern mirror has a certificate hostname mismatch and is not a required acquisition dependency.

## Investigation ledger

The source-survey dispositions and evidence are recorded in the [investigation ledger](investigations.json).
## Rotation, scale and preparation

`source/kernels/pck00011.tpc` supplies NAIF body **714 / IAU_BELINDA**. Its legacy 33-km spherical radius is excluded in favor of the later published prolate model. SPICE evaluates the pole and prime meridian, including periodic terms, at JD 2461286.5 TT: RA 257.3371803794°, Dec −15.1673024814°, W 197.5872640108°.

The analytic 5° radius table has 2,522 vertices and 5,040 triangles. The shared meshoptimizer retains **480 native `u` triangles**, a closed single-component mesh (Euler characteristic 2), with estimated simplification error 705.03 m. This is display tessellation of the measured approximation, not additional observed detail. The minimap and 512-pixel context portrait use the same grid and shape. The title uses actual Inter font glyphs through `createObjectTitleSource`.

All source bytes are pinned by `source/manifest.json`; acquisition operations restore the Inter font and NAIF text kernels by their real source URLs. The authored table and compact evidence are checked in. Runtime scene assets are produced only by the shared object preparer.

See [NOTICE.md](NOTICE.md) for credits and reuse.

</details>
