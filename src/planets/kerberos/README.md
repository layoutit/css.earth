# Kerberos

## Sources

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

The shared astronomical frame uses an illustrative historical pole from the New Horizons flyby solution from [Weaver et al. (2016), Table 2](https://arxiv.org/abs/1604.05366): 5.31 ± 0.10 days, pole RA222°, Dec72°. Shared world navigation uses JPL orbits independently of the shape interpretation.

Surface, minimap, thumbnail and context portrait use the same no-coverage interpretation. Flood lighting and optional Shadows use the retained irregular-body geometry. No photographed terminator is attached to the mesh; no albedo detail, color, atmosphere or terrain is invented.

## Dataset survey

Surveyed 2026-09-08:

| Candidate | Disposition |
| --- | --- |
| PDS New Horizons LORRI calibrated FITS | OPUS body-geometry inventory returned 2,292 observations. The best ten belong to two resolved epochs. Original calibrated `lor_0299153805_0x630_sci.fit` and `lor_0299136735_0x636_sci.fit` were downloaded, decoded and inspected at original pixel scale. OPUS gives 1.96379 and 3.12732 km/pixel respectively. The body spans only a handful of independently sampled pixels, without a converged pole or cartographic registration. Excluded as a mapped albedo lens; the observations still constrain shape and integrated brightness. Metadata and exact inspected-product identities are pinned in `source/survey/`. |
| [NASA PIA20034, Kerberos Revealed](https://science.nasa.gov/photojournal/kerberos-revealed/) | A useful observational illustration. The Science paper's Figure S1 explains the interlacing, deconvolution and final cosmetic upsampling used for the small-moon portrait. A resampled press image is not a high-density surface map or a geometry solution. Excluded as a surface texture. |
| [Porter et al. 2025 fitted shapes](https://www.hou.usra.edu/meetings/plutosystem2025/pdf/7035.pdf) | Included: the presentation refines the rounded abstract dimensions and explicitly presents a single-triaxial alternative to a contact binary. No downloadable Kerberos vertex/facet release was located with this work. No screenshot tracing or hobbyist contour mesh is substituted. |
| [Porter & Canup 2023](https://arxiv.org/abs/2306.08602) | Historical qualification: two low-resolution resolved views did not permit detailed shape modeling. Its older approximate 19 × 10 × 9 km dimensions are superseded here by the explicitly labeled 2025 fit. |
| MVIC, LEISA, HST photometry and mapped-product searches | The flyby literature and PDS survey do not provide a qualified spatially registered Kerberos color, spectral, topographic or geological map. Integrated reflectivity/lightcurves are measurements, but do not supply a second surface dataset. No such map was located; this is a survey outcome, not a claim that no other observations exist. |

## Preparation and restoration

The acquisition plan restores the pinned external Inter font and ESO starfield; no private ignored input is needed for preparation. The context portrait is reproducible with the existing radial snapshot generator and the recipe in `preparation/navigation.json`.

</details>
