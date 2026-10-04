# HAT-P-36 b

## Sources

It is the only planet known around Tuiren. Its orbit and size follow Chakrabarty & Sengupta 2019's fit, the archive's default. The introduction is generated from Chakrabarty & Sengupta 2019's published values; the sections below are the data's own.

**Size and mass.** Radius 1.277 Jupiter radii from Chakrabarty & Sengupta 2019 (2019AJ....158...39C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract): 91,295.3 km at 71,492 km per Jupiter radius. GM from the mass 1.8482 Jupiter masses (Chakrabarty & Sengupta 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019AJ....158...39C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 1.327346813 d Chakrabarty & Sengupta 2019 (2019AJ....158...39C), via the NASA Exoplanet Archive ps table (pl_refname CHAKRABARTY__AMP__SENGUPTA_2019): a/R* 4.95; Chakrabarty & Sengupta 2019 (2019AJ....158...39C), via the NASA Exoplanet Archive ps table (pl_refname CHAKRABARTY__AMP__SENGUPTA_2019): inclination 87.13 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.063 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 51 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2457885.383994 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hat-p-36's measured color (#ffeee7, the color dataset of hat-p-36 (src/objects/hat-p-36/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Tuiren's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (22, 49, 76), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-36b.json).


## Known problems

- **Orbit convention.** omega 51 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.063) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-36" (revision 1374405757) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
