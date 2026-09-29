# TOI-1064 b

## Sources

It is one of 2 planets known around TOI-1064. Its orbit and size follow Wilson et al. 2022's fit, the archive's default. This account was drafted from Wilson et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.23079708 Jupiter radii from Wilson et al. 2022 (2022MNRAS.511.1043W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.511.1043W/abstract): 16,500.1 km at 71,492 km per Jupiter radius. GM from the mass 0.04247575 Jupiter masses (Wilson et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022MNRAS.511.1043W), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022MNRAS.511.1043W/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 6.4438657474 d Wilson et al. 2022 (2022MNRAS.511.1043W), via the NASA Exoplanet Archive ps table (pl_refname WILSON_ET_AL_2022): a/R* derived from its semi-major axis 0.06152 au and stellar radius 0.726 solar radii; Wilson et al. 2022 (2022MNRAS.511.1043W), via the NASA Exoplanet Archive ps table (pl_refname WILSON_ET_AL_2022): inclination 87.709 degrees Wilson et al. 2022 (2022MNRAS.511.1043W), via the NASA Exoplanet Archive ps table (pl_refname WILSON_ET_AL_2022): e 0.047 Wilson et al. 2022 (2022MNRAS.511.1043W), via the NASA Exoplanet Archive ps table (pl_refname WILSON_ET_AL_2022): omega 120 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458656.668478 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 9 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1064's measured colour (#ffd4b8, the colour lens of toi-1064 (src/objects/toi-1064/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1064's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (94, 104, 105), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1064b.json).


## Known problems

- **Orbit convention.** omega 120 degrees is taken as Wilson et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.047) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
