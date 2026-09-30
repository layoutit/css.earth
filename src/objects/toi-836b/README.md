# TOI-836 b

## Sources

It is one of 2 planets known around TOI-836. Its orbit and size follow Hawthorn et al. 2023's fit, the archive's default. The introduction is generated from Hawthorn et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.15202096 Jupiter radii from Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.520.3649H/abstract): 10,868.3 km at 71,492 km per Jupiter radius. GM from the mass 0.01425297 Jupiter masses (Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023MNRAS.520.3649H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.8167262 d Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): a/R* derived from its semi-major axis 0.0422 au and stellar radius 0.665 solar radii; Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): inclination 87.57 degrees Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): e 0.053 Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): omega 9 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459355.705342 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 9 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Charts.** The orbits of TOI-836's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (11, 38, 91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-24 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-836b.json).

## Known problems

- **Orbit convention.** omega 9 degrees is taken as Hawthorn et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
