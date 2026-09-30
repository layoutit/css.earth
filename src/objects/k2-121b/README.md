# K2-121 b

## Sources

It is the only planet known around K2-121. Its orbit and size follow Howard et al. 2025's fit, the archive's default. This account was drafted from Howard et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.63877351 Jupiter radii from Howard et al. 2025 (2025ApJS..278...52H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract): 45,667.2 km at 71,492 km per Jupiter radius. GM from the mass 0.16046394 Jupiter masses (Howard et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025ApJS..278...52H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive ps table (pl_refname CASTRO_GONZ_AACUTE_LEZ_ET_AL__2022): P 5.1857539 d Howard et al. 2025 (2025ApJS..278...52H), via the NASA Exoplanet Archive ps table (pl_refname HOWARD_ET_AL__2025): a/R* derived by Kepler's third law from its period 5.1857539 d, stellar mass 0.71 and radius 0.675 solar units; Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): inclination 87.2 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.22 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 73 degrees Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive ps table (pl_refname CASTRO_GONZ_AACUTE_LEZ_ET_AL__2022): transit mid-time 2457143.5605812 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-121's measured colour (#ffcfb0, the colour dataset of k2-121 (src/objects/k2-121/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-121's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (46, 71, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-121b.json).


## Known problems

- **Orbit convention.** omega 73 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.22) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
