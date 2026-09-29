# TOI-1899 b

## Sources

It is the only planet known around TOI-1899. Its orbit and size follow Lin et al. 2023's fit, the archive's default. This account was drafted from Lin et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.99 Jupiter radii from Lin et al. 2023 (2023AJ....166...90L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...90L/abstract): 70,777.1 km at 71,492 km per Jupiter radius. GM from the mass 0.67 Jupiter masses (Lin et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166...90L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166...90L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 29.09023727744 d Lin et al. 2023 (2023AJ....166...90L), via the NASA Exoplanet Archive ps table (pl_refname LIN_ET_AL__2023): a/R* 54.01; Lin et al. 2023 (2023AJ....166...90L), via the NASA Exoplanet Archive ps table (pl_refname LIN_ET_AL__2023): inclination 89.64 degrees Lin et al. 2023 (2023AJ....166...90L), via the NASA Exoplanet Archive ps table (pl_refname LIN_ET_AL__2023): e 0.044 Lin et al. 2023 (2023AJ....166...90L), via the NASA Exoplanet Archive ps table (pl_refname LIN_ET_AL__2023): omega -53 degrees, stored as 307 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458711.959967 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1899's measured colour (#ffbe8a, the colour lens of toi-1899 (src/objects/toi-1899/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1899's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (75, 81, 82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1899b.json).


## Known problems

- **Orbit convention.** omega -53 degrees is taken as Lin et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.044) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
