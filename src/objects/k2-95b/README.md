# K2-95 b

## Sources

It is the only planet known around K2-95. Its orbit and size follow Castro-González et al. 2022's fit, the archive's default. This account was drafted from Castro-González et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.29529893 Jupiter radii from Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.509.1075C/abstract): 21,111.5 km at 71,492 km per Jupiter radius. GM from the mass 0.0345 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive ps table (pl_refname CASTRO_GONZ_AACUTE_LEZ_ET_AL__2022): P 10.1346454 d Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive ps table (pl_refname CASTRO_GONZ_AACUTE_LEZ_ET_AL__2022): a/R* 28.28; Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): inclination 89.4 degrees Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): e 0.16 Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): omega -2 degrees, stored as 358 Castro-González et al. 2022 (2022MNRAS.509.1075C), via the NASA Exoplanet Archive ps table (pl_refname CASTRO_GONZ_AACUTE_LEZ_ET_AL__2022): transit mid-time 2457140.7422121 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 7 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-95's measured colour (#ffc98f, the colour lens of k2-95 (src/objects/k2-95/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-95's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-95b.json).


## Known problems

- **Orbit convention.** omega -2 degrees is taken as Mann et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.16) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
