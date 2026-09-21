# Kerberos

## Sources

[Investigation ledger](investigations.json): recorded source decisions, evidence and conditions for revisiting them.

- Kerberos has one **Shape model** dataset. It represents the explicitly approximate single-triaxial solution in [Porter, Verbiscer and Canup's 2025 presentation](https://www.hou.usra.edu/meetings/plutosystem2025/presentations/Friday/1135_Porter.pdf), slide 7: full dimensions **14.5 × 8.2 × 7.2 km**, equivalent diameter about **9.5 km**.

## Evidence

- The shared radial-terrain preparer samples 5,040 source triangles and simplifies to **480 native PolyCSS `u` leaves**, with a 100 m simplifier-error setting. It returns one closed component with Euler characteristic 2 and an estimated simplifier error of 82.4 m. That estimate concerns display simplification, not scientific shape uncertainty or a maximum error for every ray.

- The compact radius table, constant material, context portrait and source evidence are checked in.

## Known problems

- Slide 8 compares a contact-binary alternative; the presentation does not establish a unique bilobate mesh or a converged pole. We use the reported triaxial interpretation openly, not a fabricated reconstruction of the possible two lobes.

- All mapped surface texels are unavailable. A constant source material tagged as no-data is painted with the existing neutral grid.

- The 2025 work does not converge on a unique pole. The display uses an arbitrary zero meridian and no predicted spin phase. Thus the displayed orientation is illustrative, not a precise present-day body-fixed prediction or a synchronous alignment toward Pluto.

- Browser results are not recorded in this source account.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="kerberos-sources-and-interpretation"></a>

The radius table samples the analytic ellipsoid every 5°. `measurements.json` records the exact formula, units and axes. The reference radius is 4.75 km, a scene-unit convention consistent with the reported equivalent diameter; the semi-axes remain 7.25, 4.1 and 3.6 km without rescaling. This is a three-axis shape fit, not a local elevation map. The existing radial preparation is applicable because this chosen ellipsoid has exactly one positive surface intersection per direction. No claim is made that an unconstrained contact-binary reconstruction has that property.

The shared astronomical frame uses an illustrative historical pole from the New Horizons flyby solution from [Weaver et al. (2016), Table 2](https://arxiv.org/abs/1604.05366): 5.31 ± 0.10 days, pole RA222°, Dec 72°. Shared world navigation uses JPL orbits independently of the shape interpretation.

Surface, minimap, thumbnail and context portrait use the same no-coverage interpretation. Flood lighting and optional Shadows use the retained irregular-body geometry. No photographed terminator is attached to the mesh; no albedo detail, color, atmosphere or terrain is invented.

## Dataset survey

Surveyed 2026-09-08:

Source selections and alternative products are recorded in the [investigation ledger](investigations.json).

## Preparation and restoration

The acquisition plan restores the pinned external Inter font; no private ignored input is needed for preparation. The context portrait is reproducible with the existing radial snapshot generator and the recipe in `preparation/navigation.json`.

</details>
