# WASP-34 b

## Sources

It is the only planet known around WASP-34. Its orbit and size follow Stassun et al. 2017's fit, the archive's default. This account was drafted from Stassun et al. 2017's values; the sections below are the data's own.

**Size and mass.** Radius 1 Jupiter radii from Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract): 71,492 km at 71,492 km per Jupiter radius. GM from the mass 0.56 Jupiter masses (Stassun et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153..136S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 4.31768411 d Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): a/R* 12.07; Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): inclination 85.2 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.038 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 319.8 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458654.3645 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by wasp-34's measured colour (#fff1ed, the colour lens of wasp-34 (src/objects/wasp-34/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-34's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (63, 90, 100), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-34b.json).


## Known problems

- **Orbit convention.** omega 319.8 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.038) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
