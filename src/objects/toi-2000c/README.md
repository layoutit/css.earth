# TOI-2000 c

## Sources

It is one of 2 planets known around TOI-2000. Its orbit and size follow Sha et al. 2023's fit, the archive's default. This account was drafted from Sha et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.727 Jupiter radii from Sha et al. 2023 (2023MNRAS.524.1113S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.1113S/abstract): 51,974.7 km at 71,492 km per Jupiter radius. GM from the mass 0.257 Jupiter masses (Sha et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023MNRAS.524.1113S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.1113S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 9.1270519 d Sha et al. 2023 (2023MNRAS.524.1113S), via the NASA Exoplanet Archive ps table (pl_refname SHA_ET_AL_2023): a/R* 16.64; Sha et al. 2023 (2023MNRAS.524.1113S), via the NASA Exoplanet Archive ps table (pl_refname SHA_ET_AL_2023): inclination 87.86 degrees Sha et al. 2023 (2023MNRAS.524.1113S), via the NASA Exoplanet Archive ps table (pl_refname SHA_ET_AL_2023): e 0.063 Sha et al. 2023 (2023MNRAS.524.1113S), via the NASA Exoplanet Archive ps table (pl_refname SHA_ET_AL_2023): omega 196 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460086.660775 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2000's measured colour (#ffeade, the colour lens of toi-2000 (src/objects/toi-2000/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2000's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (64, 65, 90), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2000c.json).


## Known problems

- **Orbit convention.** omega 196 degrees is taken as Sha et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.063) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
