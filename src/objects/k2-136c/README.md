# K2-136 c

## Sources

It is one of 3 planets known around K2-136. Its orbit and size follow Mayo et al. 2023's fit, the archive's default. This account was drafted from Mayo et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.26764253 Jupiter radii from Mayo et al. 2023 (2023AJ....165..235M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..235M/abstract): 19,134.3 km at 71,492 km per Jupiter radius. GM from the mass 0.05694897 Jupiter masses (Mayo et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....165..235M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....165..235M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 17.3070631 d Mayo et al. 2023 (2023AJ....165..235M), via the NASA Exoplanet Archive ps table (pl_refname MAYO_ET_AL_2023): a/R* derived from its semi-major axis 0.1185 au and stellar radius 0.677 solar radii; Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): inclination 89.3 degrees Mayo et al. 2023 (2023AJ....165..235M), via the NASA Exoplanet Archive ps table (pl_refname MAYO_ET_AL_2023): e 0.047 Mayo et al. 2023 (2023AJ....165..235M), via the NASA Exoplanet Archive ps table (pl_refname MAYO_ET_AL_2023): omega 124 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460253.01276 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-136's measured colour (#ffc7a2, the colour lens of k2-136 (src/objects/k2-136/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-136's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (44, 70, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-136c.json).


## Known problems

- **Orbit convention.** omega 124 degrees is taken as Mayo et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.047) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
