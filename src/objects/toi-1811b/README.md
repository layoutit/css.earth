# TOI-1811 b

## Sources

It is the only planet known around TOI-1811. Its orbit and size follow Rodriguez et al. 2023's fit, the archive's default. This account was drafted from Rodriguez et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.994 Jupiter radii from Rodriguez et al. 2023 (2023MNRAS.521.2765R), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023MNRAS.521.2765R/abstract): 71,063 km at 71,492 km per Jupiter radius. GM from the mass 0.972 Jupiter masses (Rodriguez et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023MNRAS.521.2765R), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023MNRAS.521.2765R/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.7130701 d Rodriguez et al. 2023 (2023MNRAS.521.2765R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL_2023): a/R* 12.28; Rodriguez et al. 2023 (2023MNRAS.521.2765R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL_2023): inclination 86.48 degrees Rodriguez et al. 2023 (2023MNRAS.521.2765R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL_2023): e 0.052 Rodriguez et al. 2023 (2023MNRAS.521.2765R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL_2023): omega 21 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459661.050292 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1811's measured colour (#ffd5b9, the colour lens of toi-1811 (src/objects/toi-1811/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1811's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (22, 49), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1811b.json).


## Known problems

- **Orbit convention.** omega 21 degrees is taken as Rodriguez et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.052) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
