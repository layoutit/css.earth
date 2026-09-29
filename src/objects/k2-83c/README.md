# K2-83 c

## Sources

It is one of 2 planets known around K2-83. Its orbit and size follow Crossfield et al. 2016's fit, the archive's default. This account was drafted from Crossfield et al. 2016's values; the sections below are the data's own.

**Size and mass.** Radius 0.1323044 Jupiter radii from Crossfield et al. 2016 (2016ApJS..226....7C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJS..226....7C/abstract): 9,458.7 km at 71,492 km per Jupiter radius. GM from the mass 0.00882 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): P 9.99791 d Crossfield et al. 2016 (2016ApJS..226....7C), via the NASA Exoplanet Archive ps table (pl_refname CROSSFIELD_ET_AL__2016): a/R* derived from its semi-major axis 0.07131 au and stellar radius 0.424 solar radii; Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): inclination 89.51 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): e 0.06 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): omega -19.35 degrees, stored as 340.65 Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): transit mid-time 2457066.2688 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 315 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-83's measured colour (#ffbc86, the colour lens of k2-83 (src/objects/k2-83/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-83's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (44, 70, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-83c.json).


## Known problems

- **Orbit convention.** omega -19.35 degrees is taken as Dressing et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.06) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
