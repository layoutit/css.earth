# K2-122 b

## Sources

It is the only planet known around K2-122. Its orbit and size follow Castro-González et al. 2022's fit, the archive's default. This account was drafted from Castro-González et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.10348845 Jupiter radii from Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.509.1075C/abstract): 7,398.6 km at 71,492 km per Jupiter radius. GM from the mass 0.00521 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive ps table (pl_refname CASTRO_GONZ_AACUTE_LEZ_ET_AL__2022): P 2.2193023 d Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive ps table (pl_refname CASTRO_GONZ_AACUTE_LEZ_ET_AL__2022): a/R* 13.61; Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): inclination 86.39 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): e 0.21 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): omega 60.8 degrees Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive ps table (pl_refname CASTRO_GONZ_AACUTE_LEZ_ET_AL__2022): transit mid-time 2457141.8300469 BJD, taken as BJD_TDB Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-122's measured colour (#ffc08b, the colour lens of k2-122 (src/objects/k2-122/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-122's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-122b.json).


## Known problems

- **Orbit convention.** omega 60.8 degrees is taken as Dressing et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.21) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
