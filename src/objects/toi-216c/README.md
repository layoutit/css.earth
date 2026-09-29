# TOI-216 c

## Sources

It is one of 2 planets known around TOI-216. Its orbit and size follow Dawson et al. 2021's fit, the archive's default. This account was drafted from Dawson et al. 2021's values; the sections below are the data's own.

**Size and mass.** Radius 0.9010632 Jupiter radii from Dawson et al. 2021 (2021AJ....161..161D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..161D/abstract): 64,418.8 km at 71,492 km per Jupiter radius. GM from the mass 0.56 Jupiter masses (Dawson et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021AJ....161..161D), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....161..161D/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 34.5059318313 d Dawson et al. 2021 (2021AJ....161..161D), via the NASA Exoplanet Archive ps table (pl_refname DAWSON_ET_AL__2021): a/R* derived by Kepler's third law from its period 34.5059318313 d, stellar mass 0.77 and radius 0.748 solar units; Dawson et al. 2021 (2021AJ....161..161D), via the NASA Exoplanet Archive ps table (pl_refname DAWSON_ET_AL__2021): inclination 89.84 degrees Dawson et al. 2021 (2021AJ....161..161D), via the NASA Exoplanet Archive ps table (pl_refname DAWSON_ET_AL__2021): e 0.0046 Dawson et al. 2021 (2021AJ....161..161D), via the NASA Exoplanet Archive ps table (pl_refname DAWSON_ET_AL__2021): omega 190 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458331.488563 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-216's measured colour (#ffddc5, the colour lens of toi-216 (src/objects/toi-216/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-216's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-216c.json).


## Known problems

- **Orbit convention.** omega 190 degrees is taken as Dawson et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0046) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
