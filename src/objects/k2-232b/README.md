# K2-232 b

## Sources

It is one of 2 planets known around K2-232. Its orbit and size follow Ranshaw et al. 2026's fit, the archive's default. The introduction is generated from Ranshaw et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 1.037 Jupiter radii from Ranshaw et al. 2026 (2026arXiv260909077R), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260909077R/abstract): 74,137.2 km at 71,492 km per Jupiter radius. GM from the mass 0.427 Jupiter masses (Ranshaw et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026arXiv260909077R), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026arXiv260909077R/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 11.16844233 d Ranshaw et al. 2026 (2026arXiv260909077R), via the NASA Exoplanet Archive ps table (pl_refname RANSHAW_ET_AL_2026): a/R* 18.04; Ranshaw et al. 2026 (2026arXiv260909077R), via the NASA Exoplanet Archive ps table (pl_refname RANSHAW_ET_AL_2026): inclination 89.83 degrees Ranshaw et al. 2026 (2026arXiv260909077R), via the NASA Exoplanet Archive ps table (pl_refname RANSHAW_ET_AL_2026): e 0.245 Ranshaw et al. 2026 (2026arXiv260909077R), via the NASA Exoplanet Archive ps table (pl_refname RANSHAW_ET_AL_2026): omega -178.2 degrees, stored as 181.8 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458160.403851 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-232's measured colour (#fff5f8, the colour dataset of k2-232 (src/objects/k2-232/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-232's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (43, 44, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-232b.json).

## Known problems

- **Orbit convention.** omega -178.2 degrees is taken as Ranshaw et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.245) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
