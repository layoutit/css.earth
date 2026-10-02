# TOI-1052 b

## Sources

It is one of 2 planets known around TOI-1052. Its orbit and size follow Armstrong et al. 2023's fit, the archive's default. The introduction is generated from Armstrong et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.25604469 Jupiter radii from Armstrong et al. 2023 (2023MNRAS.524.5804A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.5804A/abstract): 18,305.1 km at 71,492 km per Jupiter radius. GM from the mass 0.05317335 Jupiter masses (Armstrong et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023MNRAS.524.5804A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023MNRAS.524.5804A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 9.13980396599 d Armstrong et al. 2023 (2023MNRAS.524.5804A), via the NASA Exoplanet Archive ps table (pl_refname ARMSTRONG_ET_AL_2023): a/R* 15.51; Armstrong et al. 2023 (2023MNRAS.524.5804A), via the NASA Exoplanet Archive ps table (pl_refname ARMSTRONG_ET_AL_2023): inclination 87.53 degrees Armstrong et al. 2023 (2023MNRAS.524.5804A), via the NASA Exoplanet Archive ps table (pl_refname ARMSTRONG_ET_AL_2023): e 0.18 Armstrong et al. 2023 (2023MNRAS.524.5804A), via the NASA Exoplanet Archive ps table (pl_refname ARMSTRONG_ET_AL_2023): omega -119 degrees, stored as 241 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458332.941229 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 47 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-1052's measured color (#fdf7ff, the color dataset of toi-1052 (src/objects/toi-1052/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1052's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (101, 102, 103), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1052b.json).

## Known problems

- **Orbit convention.** omega -119 degrees is taken as Armstrong et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.18) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
