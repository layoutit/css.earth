# TOI-125 c

## Sources

It is one of 3 planets known around TOI-125. Its orbit and size follow Nielsen et al. 2020's fit, the archive's default. This account was drafted from Nielsen et al. 2020's values; the sections below are the data's own.

**Size and mass.** Radius 0.24614149 Jupiter radii from Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020MNRAS.492.5399N/abstract): 17,597.1 km at 71,492 km per Jupiter radius. GM from the mass 0.02086021 Jupiter masses (Nielsen et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020MNRAS.492.5399N), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020MNRAS.492.5399N/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 9.1549418 d Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive ps table (pl_refname NIELSEN_ET_AL__2020): a/R* 20.66; Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive ps table (pl_refname NIELSEN_ET_AL__2020): inclination 88.54 degrees Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive ps table (pl_refname NIELSEN_ET_AL__2020): e 0.066 Nielsen et al. 2020 (2020MNRAS.492.5399N), via the NASA Exoplanet Archive ps table (pl_refname NIELSEN_ET_AL__2020): omega 70 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460202.049893 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-125's measured colour (#ffe7d9, the colour lens of toi-125 (src/objects/toi-125/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-125's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-125c.json).


## Known problems

- **Orbit convention.** omega 70 degrees is taken as Nielsen et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.066) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
