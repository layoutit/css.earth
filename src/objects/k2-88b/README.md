# K2-88 b

## Sources

It is the only planet known around K2-88. Its orbit and size follow Crossfield et al. 2016's fit, the archive's default. This account was drafted from Crossfield et al. 2016's values; the sections below are the data's own.

**Size and mass.** Radius 0.10973325 Jupiter radii from Crossfield et al. 2016 (2016ApJS..226....7C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJS..226....7C/abstract): 7,845 km at 71,492 km per Jupiter radius. GM from the mass 0.00642 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): P 4.61244 d Crossfield et al. 2016 (2016ApJS..226....7C), via the NASA Exoplanet Archive ps table (pl_refname CROSSFIELD_ET_AL__2016): a/R* derived from its semi-major axis 0.0345 au and stellar radius 0.256 solar radii; Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): inclination 87.75 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): e 0.26 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): omega 72.02 degrees Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): transit mid-time 2457066.2177 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 137 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-88's measured colour (#ffc487, the colour lens of k2-88 (src/objects/k2-88/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-88's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (42, 43, 44), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-88b.json).


## Known problems

- **Orbit convention.** omega 72.02 degrees is taken as Dressing et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.26) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
