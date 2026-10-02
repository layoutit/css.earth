# TOI-181 b

## Sources

It is the only planet known around TOI-181. Its orbit and size follow Mistry et al. 2023's fit, the archive's default. The introduction is generated from Mistry et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.6339 Jupiter radii from Mistry et al. 2023 (2023MNRAS.521.1066M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.521.1066M/abstract): 45,318.8 km at 71,492 km per Jupiter radius. GM from the mass 0.1452 Jupiter masses (Mistry et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023MNRAS.521.1066M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023MNRAS.521.1066M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Mistry et al. 2023 (2023MNRAS.521.1066M), via the NASA Exoplanet Archive ps table (pl_refname MISTRY_ET_AL_2023): P 4.532 d Mistry et al. 2023 (2023MNRAS.521.1066M), via the NASA Exoplanet Archive ps table (pl_refname MISTRY_ET_AL_2023): a/R* 15.5641; Mistry et al. 2023 (2023MNRAS.521.1066M), via the NASA Exoplanet Archive ps table (pl_refname MISTRY_ET_AL_2023): inclination 88.28 degrees Mistry et al. 2023 (2023MNRAS.521.1066M), via the NASA Exoplanet Archive ps table (pl_refname MISTRY_ET_AL_2023): e 0.1543 Mistry et al. 2023 (2023MNRAS.521.1066M), via the NASA Exoplanet Archive ps table (pl_refname MISTRY_ET_AL_2023): omega -96.91 degrees, stored as 263.09000000000003 Mistry et al. 2023 (2023MNRAS.521.1066M), via the NASA Exoplanet Archive ps table (pl_refname MISTRY_ET_AL_2023): transit mid-time 2458358.12 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-181's measured color (#ffd7bd, the color dataset of toi-181 (src/objects/toi-181/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-181's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (69, 96, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-181b.json).

## Known problems

- **Orbit convention.** omega -96.91 degrees is taken as Mistry et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.1543) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
