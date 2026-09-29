# TOI-561 c

## Sources

It is one of 4 planets known around TOI-561. Its orbit and size follow Piotto et al. 2024's fit, the archive's default. This account was drafted from Piotto et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.25559862 Jupiter radii from Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.535.2763P/abstract): 18,273.3 km at 71,492 km per Jupiter radius. GM from the mass 0.01865787 Jupiter masses (Piotto et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024MNRAS.535.2763P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024MNRAS.535.2763P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): P 10.778838 d Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): a/R* 22.4; Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): inclination 89.61 degrees Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): e 0.023 Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): omega 219 degrees Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): transit mid-time 2459238.46284 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-561's measured colour (#ffede4, the colour lens of toi-561 (src/objects/toi-561/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-561's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (45, 46, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-561c.json).


## Known problems

- **Orbit convention.** omega 219 degrees is taken as Piotto et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.023) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
