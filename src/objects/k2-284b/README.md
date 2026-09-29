# K2-284 b

## Sources

It is the only planet known around K2-284. Its orbit and size follow David et al. 2018's fit, the archive's default. This account was drafted from David et al. 2018's values; the sections below are the data's own.

**Size and mass.** Radius 0.24801499 Jupiter radii from David et al. 2018 (2018AJ....156..302D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..302D/abstract): 17,731.1 km at 71,492 km per Jupiter radius. GM from the mass 0.0256 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 4.7948599 d David et al. 2018 (2018AJ....156..302D), via the NASA Exoplanet Archive ps table (pl_refname DAVID_ET_AL__2018): a/R* 16.84; David et al. 2018 (2018AJ....156..302D), via the NASA Exoplanet Archive ps table (pl_refname DAVID_ET_AL__2018): inclination 89 degrees David et al. 2018 (2018AJ....156..302D), via the NASA Exoplanet Archive ps table (pl_refname DAVID_ET_AL__2018): e 0.078 David et al. 2018 (2018AJ....156..302D), via the NASA Exoplanet Archive ps table (pl_refname DAVID_ET_AL__2018): omega 180.2 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458146.80246 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-284's measured colour (#ffc092, the colour lens of k2-284 (src/objects/k2-284/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-284's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (44, 45, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-284b.json).


## Known problems

- **Orbit convention.** omega 180.2 degrees is taken as David et al. 2018 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.078) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
