# Ophelia

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- [Karkoschka (2001), Table IV, printed page 55](https://doi.org/10.1006/icar.2001.6596) adopts a prolate spheroid with radius axes A=27 km and B=19 km.

- [French et al. (2024), Table 3, PDF page 10](https://arxiv.org/abs/2401.04634) reproduces the Voyager paper's Table V: projected √(AB) radius 23 ± 4 km and B/A=0.7 ± 0.3.

## Evidence

- The inspected image is research only, pinned by identity in [source/survey/native-inspection.json](source/survey/native-inspection.json).

- The shared orbital fit samples daily JPL states over 2020–2032. Its maximum residual at six independent evaluation epochs is 2.01270499 km, a sampled result rather than a uniform error bound or a current-ephemeris guarantee.

## Known problems

- Ophelia, Uranus’s outer epsilon-ring shepherd, uses one **Shape model** dataset with the standard no-coverage grid. The third axis is a model assumption, not an independent measurement. These are not independent uncertainties on the three axes.

- All material pixels are no-data; the existing grid generates surface atlases, thumbnail, minimap and context. It does not assert albedo or observed terrain.

- The body-owned rotation source evaluates [NAIF PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) BODY707 at JD2461286.5 TT, including its U2 terms. Shared runtime advances the linear meridian while the small pole/periodic correction stays fixed at that prepared epoch. This is a display approximation, not a full long-term nutation ephemeris.

- Combining the mass with uncertain shape volume gives density 0.87(+0.89/−0.30) g/cm³; the broad density uncertainty is volume-dominated. It is not a direct compositional measurement.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="ophelia-sources-and-interpretation"></a>

A points toward Uranus, with B in both perpendicular directions. The resulting dimensions are 54 × 38 × 38 km. The analytic radius table preserves these axes without rescaling.

The derived volume-equivalent radius ∛(AB²)=21.3611 km is the reference scale; the projected radius is not substituted for it.

The **footnote-b row** in French Table 3 gives GM=(2.38 ± 0.22)×10⁻³ km³/s² and mass=(3.57 ± 0.32)×10¹⁶ kg. This dynamical inference uses forced normal-mode amplitudes in the gamma ring (6:5 inner Lindblad resonance) and the epsilon ring's outer edge (14:13 inner Lindblad resonance). It is separate from the assumed-density row GM=(2.45 ± 1.24)×10⁻³, which is not adopted. Sections 9.1–9.2 explain the ring-forcing interpretation.

Coordinates are east-positive body longitude, with the modeled long axis at 0°/180°. Old PCK spherical radii are not used for shape.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

Only compact numeric measurements, our summary, PCK rotation data and archival image metadata are versioned. Copyrighted paper PDFs stay in ignored research; preparation does not depend on fetching papers.

Flood and Shadows use the same mesh and shared lighting. Preparation targets 480 native `u` leaves and introduces no body-specific controller or preparer.

The analytic radius table, no-data sentinel and context portrait are versioned inputs; the font has a pinned download recipe.

</details>
