# TOI-908 b

## Sources

It is the only planet known around TOI-908. Its orbit and size follow Hawthorn et al. 2023's fit, the archive's default. The introduction is generated from Hawthorn et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.28423637 Jupiter radii from Hawthorn et al. 2023 (2023MNRAS.524.3877H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.3877H/abstract): 20,320.6 km at 71,492 km per Jupiter radius. GM from the mass 0.05077268 Jupiter masses (Hawthorn et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023MNRAS.524.3877H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.3877H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hawthorn et al. 2023 (2023MNRAS.524.3877H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): P 3.183792 d Hawthorn et al. 2023 (2023MNRAS.524.3877H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): a/R* derived from its semi-major axis 0.041657 au and stellar radius 1.028 solar radii; Hawthorn et al. 2023 (2023MNRAS.524.3877H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): inclination 86.475 degrees Hawthorn et al. 2023 (2023MNRAS.524.3877H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): e 0.132 Hawthorn et al. 2023 (2023MNRAS.524.3877H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): omega 35.856 degrees Hawthorn et al. 2023 (2023MNRAS.524.3877H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): transit mid-time 2459384.292 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-908's measured colour (#fff0ea, the colour dataset of toi-908 (src/objects/toi-908/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-908's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (93, 94, 95), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-908b.json).

## Known problems

- **Orbit convention.** omega 35.856 degrees is taken as Hawthorn et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.132) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
