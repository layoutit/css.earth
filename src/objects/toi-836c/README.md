# TOI-836 c

## Sources

It is one of 2 planets known around TOI-836. Its orbit and size follow Hawthorn et al. 2023's fit, the archive's default. This account was drafted from Hawthorn et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.23079708 Jupiter radii from Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.520.3649H/abstract): 16,500.1 km at 71,492 km per Jupiter radius. GM from the mass 0.03020498 Jupiter masses (Hawthorn et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023MNRAS.520.3649H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023MNRAS.520.3649H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): P 8.59545 d Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): a/R* derived from its semi-major axis 0.075 au and stellar radius 0.665 solar radii; Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): inclination 88.7 degrees Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): e 0.078 Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): omega -28 degrees, stored as 332 Hawthorn et al. 2023 (2023MNRAS.520.3649H), via the NASA Exoplanet Archive ps table (pl_refname HAWTHORN_ET_AL_2023): transit mid-time 2458599.7623 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-836's measured colour (#ffc5a0, the colour lens of toi-836 (src/objects/toi-836/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-836's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-836c.json).


## Known problems

- **Orbit convention.** omega -28 degrees is taken as Hawthorn et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.078) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
