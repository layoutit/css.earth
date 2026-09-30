# WASP-50 b

## Sources

It is the only planet known around WASP-50. Its orbit and size follow Chakrabarty & Sengupta 2019's fit, the archive's default. This account was drafted from Chakrabarty & Sengupta 2019's values; the sections below are the data's own.

**Size and mass.** Radius 1.166 Jupiter radii from Chakrabarty & Sengupta 2019 (2019AJ....158...39C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract): 83,359.7 km at 71,492 km per Jupiter radius. GM from the mass 1.4688 Jupiter masses (Chakrabarty & Sengupta 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019AJ....158...39C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019AJ....158...39C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): P 1.955092447 d Chakrabarty & Sengupta 2019 (2019AJ....158...39C), via the NASA Exoplanet Archive ps table (pl_refname CHAKRABARTY__AMP__SENGUPTA_2019): a/R* 7.51; Chakrabarty & Sengupta 2019 (2019AJ....158...39C), via the NASA Exoplanet Archive ps table (pl_refname CHAKRABARTY__AMP__SENGUPTA_2019): inclination 84.88 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.009 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 44 degrees Yalçınkaya et al. 2024 (2024MNRAS.530.2475Y), via the NASA Exoplanet Archive ps table (pl_refname YALCINKAYA_ET_AL_2024): transit mid-time 2458411.09342 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by wasp-50's measured colour (#ffebde, the colour dataset of wasp-50 (src/objects/wasp-50/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-50's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (4, 31), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-50b.json).


## Known problems

- **Orbit convention.** omega 44 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.009) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
