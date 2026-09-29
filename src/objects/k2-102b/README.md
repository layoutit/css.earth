# K2-102 b

## Sources

It is the only planet known around K2-102. Its orbit and size follow Mann et al. 2017's fit, the archive's default. This account was drafted from Mann et al. 2017's values; the sections below are the data's own.

**Size and mass.** Radius 0.11597823 Jupiter radii from Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153...64M/abstract): 8,291.5 km at 71,492 km per Jupiter radius. GM from the mass 0.00705 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): P 9.915615 d Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): a/R* 25.3; Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): inclination 89 degrees Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): e 0.1 Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): omega -1 degrees, stored as 359 Mann et al. 2017 (2017AJ....153...64M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL__2017): transit mid-time 2457139.65518 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 686 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-102's measured colour (#ffd2b3, the colour lens of k2-102 (src/objects/k2-102/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-102's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (45, 46, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-102b.json).


## Known problems

- **Orbit convention.** omega -1 degrees is taken as Mann et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.1) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
