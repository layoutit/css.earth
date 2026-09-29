# K2-125 b

## Sources

It is the only planet known around K2-125. Its orbit and size follow Dressing et al. 2017's fit, the archive's default. This account was drafted from Dressing et al. 2017's values; the sections below are the data's own.

**Size and mass.** Radius 0.19448657 Jupiter radii from Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....154..207D/abstract): 13,904.2 km at 71,492 km per Jupiter radius. GM from the mass 0.017 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): P 21.750264 d Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): a/R* 63.31; Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): inclination 89.72 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): e 0.08 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): omega -3.74 degrees, stored as 356.26 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): transit mid-time 2457243.088 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 501 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-125's measured colour (#ffcb94, the colour lens of k2-125 (src/objects/k2-125/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-125's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-125b.json).


## Known problems

- **Orbit convention.** omega -3.74 degrees is taken as Dressing et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.08) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
